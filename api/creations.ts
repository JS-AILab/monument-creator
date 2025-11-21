// Ultra-minimal version - no TypeScript, no types, just works
// This returns empty history - useful for testing

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Return empty array - no database needed
      return res.status(200).json([]);
    }
    
    if (req.method === 'POST') {
      const body = req.body || {};
      
      // Validate
      if (!body.monumentPrompt || !body.scenePrompt || !body.imageUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Return mock success
      return res.status(201).json({
        id: Date.now(),
        monument_prompt: body.monumentPrompt,
        scene_prompt: body.scenePrompt,
        image_url: body.imageUrl,
        created_at: new Date().toISOString()
      });
    }
    
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}