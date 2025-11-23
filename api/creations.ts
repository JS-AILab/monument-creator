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
 * Supports POST to save a new creation and GET to retrieve all creations.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  let currentPool: Pool;
  try {
    currentPool = getPool(); // Attempt to get or initialize the pool, handles DATABASE_URL check
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

      // Validate incoming data including new latitude and longitude
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

      // Insert the new creation into the database with latitude and longitude
      // Using CAST to ensure PostgreSQL treats them as REAL (float) types
      const result = await currentPool.query(
        'INSERT INTO creations(monument_prompt, scene_prompt, image_url, latitude, longitude) VALUES($1, $2, $3, CAST($4 AS REAL), CAST($5 AS REAL)) RETURNING id, monument_prompt, scene_prompt, image_url, CAST(latitude AS REAL) as latitude, CAST(longitude AS REAL) as longitude, created_at',
        [monumentPrompt, scenePrompt, imageUrl, lat, lng]
      );
      // Return the newly created record
      res.statusCode = 201;
      res.write(JSON.stringify(result.rows[0]));
      return res.end();
    } else if (req.method === 'GET') {
      // Handle retrieving all creations
      // Fetch all creations, ordered by creation date (newest first), including latitude and longitude
      // Explicitly CAST latitude and longitude to REAL (float) to ensure they are returned as numbers by pg driver
      const result = await currentPool.query(
        'SELECT id, monument_prompt, scene_prompt, image_url, CAST(latitude AS REAL) AS latitude, CAST(longitude AS REAL) AS longitude, created_at FROM creations ORDER BY created_at DESC'
      );
      // Return the list of creations
      res.statusCode = 200;
      res.write(JSON.stringify(result.rows));
      return res.end();
    } else {
      // Handle unsupported HTTP methods
      res.setHeader('Allow', ['GET', 'POST']);
      res.statusCode = 405; // Method Not Allowed
      res.write(JSON.stringify({ error: `Method ${req.method} Not Allowed` })); // Consistent JSON error response
      return res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    // Provide a generic error message to the client, but ensure more details are logged internally if possible
    res.write(JSON.stringify({ error: 'An unexpected server error occurred. Please check database connection and schema. Details: ' + (error instanceof Error ? error.message : String(error)) }));
    return res.end();
  }
}