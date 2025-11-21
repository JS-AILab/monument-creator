import type { VercelRequest, VercelResponse } from '@vercel/node';

// Don't initialize pool at module level - create it per request to avoid connection issues
let Pool: any;
let pool: any;

async function getPool() {
  if (!pool) {
    // Dynamically import pg to avoid issues with bundling
    const pg = await import('pg');
    Pool = pg.Pool;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
      },
      // Connection pool settings
      max: 10, // Maximum number of clients
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

/**
 * Handles API requests for monument creations.
 * Supports POST to save a new creation and GET to retrieve all creations.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    return res.status(500).json({ 
      error: 'Database configuration error. DATABASE_URL environment variable is not set.' 
    });
  }

  try {
    const dbPool = await getPool();

    if (req.method === 'POST') {
      console.log('POST request received');
      
      // Parse body
      const { monumentPrompt, scenePrompt, imageUrl } = req.body || {};

      console.log('Request data:', {
        hasMonumentPrompt: !!monumentPrompt,
        hasScenePrompt: !!scenePrompt,
        imageUrlLength: imageUrl?.length || 0
      });

      // Validate incoming data
      if (!monumentPrompt || !scenePrompt || !imageUrl) {
        console.error('Missing required fields');
        return res.status(400).json({ 
          error: 'Missing required fields: monumentPrompt, scenePrompt, and imageUrl are all required.' 
        });
      }

      // Truncate image URL for storage if it's too large
      // Most databases have limits on text field sizes
      const truncatedImageUrl = imageUrl.length > 100000 
        ? imageUrl.substring(0, 100000) + '...[truncated]'
        : imageUrl;

      console.log('Attempting database insert...');
      
      // Insert the new creation into the database
      const result = await dbPool.query(
        `INSERT INTO creations(monument_prompt, scene_prompt, image_url, created_at) 
         VALUES($1, $2, $3, NOW()) 
         RETURNING id, monument_prompt, scene_prompt, image_url, created_at`,
        [monumentPrompt, scenePrompt, truncatedImageUrl]
      );
      
      console.log('Database insert successful, ID:', result.rows[0].id);
      
      return res.status(201).json(result.rows[0]);
      
    } else if (req.method === 'GET') {
      console.log('GET request received');
      
      // Fetch all creations, ordered by creation date (newest first)
      const result = await dbPool.query(
        `SELECT id, monument_prompt, scene_prompt, image_url, created_at 
         FROM creations 
         ORDER BY created_at DESC 
         LIMIT 50`
      );
      
      console.log(`Retrieved ${result.rows.length} creations`);
      
      return res.status(200).json(result.rows);
      
    } else {
      console.log('Unsupported method:', req.method);
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ 
        error: `Method ${req.method} Not Allowed` 
      });
    }
  } catch (error: any) {
    console.error('Error in handler:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    
    // Check for specific database errors
    if (error.code === 'ECONNREFUSED') {
      return res.status(500).json({ 
        error: 'Database connection refused. Please check your DATABASE_URL.' 
      });
    }
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Database table "creations" does not exist. Please run the setup SQL.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'An unexpected server error occurred.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}