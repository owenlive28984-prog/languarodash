// Health check endpoint for Vercel Serverless Function

export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
}
