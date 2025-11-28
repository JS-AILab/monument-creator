import { Pool } from 'pg';
import type { IncomingMessage, ServerResponse } from 'http';

// Initialize pool lazily to ensure DATABASE_URL is available and prevent global crashes
let pool: Pool | null = null;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set. Please configure it in Vercel.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

/**
 * Handles API requests for monument creations.
 * Supports POST to save a new creation and GET to retrieve all creations (without images for performance).
 * Use query parameter ?id=X to get a single creation with image.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  let currentPool: Pool;
  try {
    currentPool = getPool();
  } catch (initError: any) {
    res.statusCode = 500;
    res.write(JSON.stringify({ error: initError.message }));
    return res.end();
  }

  try {
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      const { monumentPrompt, scenePrompt, imageUrl, latitude, longitude } = JSON.parse(body);

      // Validate incoming data
      if (!monumentPrompt || !scenePrompt || !imageUrl || latitude === undefined || longitude === undefined) {
        res.statusCode = 400;
        res.write(JSON.stringify({ error: 'Missing required fields: monumentPrompt, scenePrompt, imageUrl, latitude, and longitude are all necessary.' }));
        return res.end();
      }

      // Convert latitude and longitude to numbers explicitly
      const lat = Number(latitude);
      const lng = Number(longitude);

      // Validate that they converted properly
      if (isNaN(lat) || isNaN(lng)) {
        res.statusCode = 400;
        res.write(JSON.stringify({ error: 'Invalid latitude or longitude values. Must be valid numbers.' }));
        return res.end();
      }

      // Insert the new creation into the database
      const result = await currentPool.query(
        'INSERT INTO creations(monument_prompt, scene_prompt, image_url, latitude, longitude) VALUES($1, $2, $3, CAST($4 AS REAL), CAST($5 AS REAL)) RETURNING id, monument_prompt, scene_prompt, image_url, CAST(latitude AS REAL) as latitude, CAST(longitude AS REAL) as longitude, created_at',
        [monumentPrompt, scenePrompt, imageUrl, lat, lng]
      );
      
      res.statusCode = 201;
      res.write(JSON.stringify(result.rows[0]));
      return res.end();
      
    } else if (req.method === 'GET') {
      // Parse URL to check for query parameters
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const monumentId = url.searchParams.get('id');

      if (monumentId) {
        // Get single monument WITH image
        const result = await currentPool.query(
          'SELECT id, monument_prompt, scene_prompt, image_url, CAST(latitude AS REAL) AS latitude, CAST(longitude AS REAL) AS longitude, created_at FROM creations WHERE id = $1',
          [monumentId]
        );
        
        if (result.rows.length === 0) {
          res.statusCode = 404;
          res.write(JSON.stringify({ error: 'Monument not found' }));
          return res.end();
        }
        
        res.statusCode = 200;
        res.write(JSON.stringify(result.rows[0]));
        return res.end();
      } else {
        // Get all monuments WITHOUT images (for performance)
        // This makes the initial map load MUCH faster since we're not sending 25+ MB of base64 data
        const result = await currentPool.query(
          'SELECT id, monument_prompt, scene_prompt, CAST(latitude AS REAL) AS latitude, CAST(longitude AS REAL) AS longitude, created_at FROM creations ORDER BY created_at DESC'
        );
        
        res.statusCode = 200;
        res.write(JSON.stringify(result.rows));
        return res.end();
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.statusCode = 405;
      res.write(JSON.stringify({ error: `Method ${req.method} Not Allowed` }));
      return res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    console.error('Server error:', error);
    res.write(JSON.stringify({ error: 'An unexpected server error occurred. Details: ' + (error instanceof Error ? error.message : String(error)) }));
    return res.end();
  }
}