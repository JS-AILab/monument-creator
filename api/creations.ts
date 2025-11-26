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

// Rate limiting configuration
const RATE_LIMIT_WINDOW_HOURS = 1; // 1 hour window
const RATE_LIMIT_MAX_REQUESTS_PER_HOUR = 10; // Max 10 per hour
const RATE_LIMIT_MAX_REQUESTS_PER_DAY = 50; // Max 50 per day

// In-memory storage for rate limiting (resets on server restart)
interface RateLimitEntry {
  timestamps: number[]; // Array of request timestamps
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get client IP address from request headers
 */
function getClientIP(req: IncomingMessage): string {
  // Try various headers that might contain the real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (typeof realIP === 'string') {
    return realIP;
  }
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  // Fallback to socket address
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Check if the client has exceeded rate limits
 * Returns { allowed: boolean, retryAfter?: number (seconds) }
 */
function checkRateLimit(clientIP: string): { allowed: boolean; retryAfter?: number; message?: string } {
  const now = Date.now();
  const oneHourAgo = now - (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  // Get or create entry for this IP
  let entry = rateLimitStore.get(clientIP);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(clientIP, entry);
  }

  // Clean up old timestamps (older than 24 hours)
  entry.timestamps = entry.timestamps.filter(ts => ts > oneDayAgo);

  // Count requests in the last hour
  const recentRequests = entry.timestamps.filter(ts => ts > oneHourAgo);
  const dailyRequests = entry.timestamps.length;

  // Check hourly limit
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS_PER_HOUR) {
    const oldestRecentTimestamp = Math.min(...recentRequests);
    const retryAfter = Math.ceil((oldestRecentTimestamp + (60 * 60 * 1000) - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      message: `Rate limit exceeded. You've created ${recentRequests.length} monuments in the last hour. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
    };
  }

  // Check daily limit
  if (dailyRequests >= RATE_LIMIT_MAX_REQUESTS_PER_DAY) {
    const oldestDailyTimestamp = Math.min(...entry.timestamps);
    const retryAfter = Math.ceil((oldestDailyTimestamp + (24 * 60 * 60 * 1000) - now) / 1000);
    return {
      allowed: false,
      retryAfter,
      message: `Daily limit exceeded. You've created ${dailyRequests} monuments today. Please try again tomorrow.`
    };
  }

  // Add current timestamp
  entry.timestamps.push(now);

  return { allowed: true };
}

/**
 * Verify reCAPTCHA token with Google
 */
async function verifyRecaptcha(token: string): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY not configured');
    return { success: false, error: 'reCAPTCHA not configured on server' };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    if (!data.success) {
      console.warn('reCAPTCHA verification failed:', data['error-codes']);
      return { 
        success: false, 
        error: 'reCAPTCHA verification failed' 
      };
    }

    // For reCAPTCHA v3, check the score (0.0 = bot, 1.0 = human)
    const score = data.score || 0;
    const minScore = 0.5; // Threshold for allowing requests

    if (score < minScore) {
      console.warn(`reCAPTCHA score too low: ${score}`);
      return {
        success: false,
        score,
        error: 'Suspicious activity detected. Please try again.'
      };
    }

    console.log(`reCAPTCHA verified successfully. Score: ${score}`);
    return { success: true, score };

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return { 
      success: false, 
      error: 'Failed to verify reCAPTCHA' 
    };
  }
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
      // Get client IP for rate limiting
      const clientIP = getClientIP(req);
      console.log(`POST request from IP: ${clientIP}`);

      // Check rate limit first (before parsing body to save resources)
      const rateLimitResult = checkRateLimit(clientIP);
      if (!rateLimitResult.allowed) {
        res.statusCode = 429; // Too Many Requests
        res.setHeader('Retry-After', String(rateLimitResult.retryAfter));
        res.write(JSON.stringify({ 
          error: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfter
        }));
        return res.end();
      }

      // Parse request body
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      const { monumentPrompt, scenePrompt, imageUrl, latitude, longitude, recaptchaToken } = JSON.parse(body);

      // Validate incoming data
      if (!monumentPrompt || !scenePrompt || !imageUrl || latitude === undefined || longitude === undefined) {
        res.statusCode = 400;
        res.write(JSON.stringify({ error: 'Missing required fields: monumentPrompt, scenePrompt, imageUrl, latitude, and longitude are all necessary.' }));
        return res.end();
      }

      // Verify reCAPTCHA token
      if (!recaptchaToken) {
        res.statusCode = 400;
        res.write(JSON.stringify({ error: 'reCAPTCHA token missing. Please refresh and try again.' }));
        return res.end();
      }

      const recaptchaResult = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaResult.success) {
        res.statusCode = 403; // Forbidden
        res.write(JSON.stringify({ 
          error: recaptchaResult.error || 'Bot detection failed. Please try again.',
          score: recaptchaResult.score 
        }));
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

      console.log(`Monument created successfully. ID: ${result.rows[0].id}, IP: ${clientIP}, reCAPTCHA score: ${recaptchaResult.score}`);

      // Return the newly created record
      res.statusCode = 201;
      res.write(JSON.stringify(result.rows[0]));
      return res.end();
    } else if (req.method === 'GET') {
      // Handle retrieving all creations (no rate limiting needed for GET)
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
      res.write(JSON.stringify({ error: `Method ${req.method} Not Allowed` }));
      return res.end();
    }
  } catch (error) {
    res.statusCode = 500;
    console.error('Server error:', error);
    res.write(JSON.stringify({ error: 'An unexpected server error occurred. Please check database connection and schema. Details: ' + (error instanceof Error ? error.message : String(error)) }));
    return res.end();
  }
}