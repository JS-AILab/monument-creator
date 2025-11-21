// Simple working API - returns empty history
export default async function handler(req, res) {
  // Set all headers first
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Handle GET - return empty array
    if (req.method === 'GET') {
      return res.status(200).json([]);
    }
    
    // Handle POST - return mock success
    if (req.method === 'POST') {
      const body = req.body || {};
      
      // Basic validation
      if (!body.monumentPrompt || !body.scenePrompt || !body.imageUrl) {
        return res.status(400).json({ 
          error: 'Missing required fields: monumentPrompt, scenePrompt, and imageUrl' 
        });
      }
      
      // Return mock saved creation
      return res.status(201).json({
        id: Date.now(),
        monument_prompt: body.monumentPrompt,
        scene_prompt: body.scenePrompt,
        image_url: body.imageUrl,
        created_at: new Date().toISOString()
      });
    }
    
    // Method not allowed
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}