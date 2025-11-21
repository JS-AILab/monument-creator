import { Pool } from 'pg';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Handles API requests for monument creations.
 * Supports POST to save a new creation and GET to retrieve all creations.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ 
      error: 'DATABASE_URL environment variable is not set.' 
    });
  }

  try {
    if (req.method === 'POST') {
      const { monumentPrompt, scenePrompt, imageUrl } = req.body;

      // Validate incoming data
      if (!monumentPrompt || !scenePrompt || !imageUrl) {
        return res.status(400).json({ 
          error: 'Missing required fields: monumentPrompt, scenePrompt, and imageUrl are all necessary.' 
        });
      }

      // Insert the new creation into the database
      const result = await pool.query(
        'INSERT INTO creations(monument_prompt, scene_prompt, image_url) VALUES($1, $2, $3) RETURNING id, monument_prompt, scene_prompt, image_url, created_at',
        [monumentPrompt, scenePrompt, imageUrl]
      );
      
      return res.status(201).json(result.rows[0]);
      
    } else if (req.method === 'GET') {
      // Fetch all creations, ordered by creation date (newest first)
      const result = await pool.query(
        'SELECT id, monument_prompt, scene_prompt, image_url, created_at FROM creations ORDER BY created_at DESC'
      );
      
      return res.status(200).json(result.rows);
      
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ 
        error: `Method ${req.method} Not Allowed` 
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ 
      error: 'An unexpected server error occurred. Please check database connection and schema.' 
    });
  }
}