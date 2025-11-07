// Health check endpoint for Vercel Serverless Function

module.exports = async (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
};
