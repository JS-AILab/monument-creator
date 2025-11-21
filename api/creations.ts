import { Pool } from 'pg';
import type { IncomingMessage, ServerResponse } from 'http';

// Initialize a PostgreSQL connection pool
// This connection string must be provided via an environment variable, e.g., DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Handles API requests for monument creations.
 * Supports POST to save a new creation and GET to retrieve all creations.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Always set header for JSON responses immediately
  res.setHeader('Content-Type', 'application/json');

  if (!process.env.DATABASE_URL) {
    res.statusCode = 500;
    res.write(JSON.stringify({ error: 'DATABASE_URL environment variable is not set.' }));
    return res.end();
  }

  try {
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      const { monumentPrompt, scenePrompt, imageUrl } = JSON.parse(body);

      // Validate incoming data
      if (!monumentPrompt || !scenePrompt || !imageUrl) {
        res.statusCode = 400;
        res.write(JSON.stringify({ error: 'Missing required fields: monumentPrompt, scenePrompt, and imageUrl are all necessary.' }));
        return res.end();
      }

      // Insert the new creation into the database
      const result = await pool.query(
        'INSERT INTO creations(monument_prompt, scene_prompt, image_url) VALUES($1, $2, $3) RETURNING id, monument_prompt, scene_prompt, image_url, created_at',
        [monumentPrompt, scenePrompt, imageUrl]
      );
      // Return the newly created record
      res.statusCode = 201;
      res.write(JSON.stringify(result.rows[0]));
      return res.end();
    } else if (req.method === 'GET') {
      // Handle retrieving all creations
      // Fetch all creations, ordered by creation date (newest first)
      const result = await pool.query(
        'SELECT id, monument_prompt, scene_prompt, image_url, created_at FROM creations ORDER BY created_at DESC'
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
    // This catch block handles any unexpected errors during database interaction or logic execution.
    // It's crucial to NOT log to console.error here if stdout is being captured for HTTP response.
    // In a real production environment, you would log `error` to a dedicated logging service.
    res.statusCode = 500;
    res.write(JSON.stringify({ error: 'An unexpected server error occurred. Please check database connection and schema.' }));
    return res.end();
  }
}