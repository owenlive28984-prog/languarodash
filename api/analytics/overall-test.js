// Test version - returns fake data without database connection
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return fake data to test if the endpoint structure works
    res.status(200).json({
      dau: 0,
      mau: 0,
      avg_session: 0,
      translations_week: 0,
      top_pairs: {},
      ocr: 0,
      clipboard: 0,
      _test: true,
      _message: 'This is test data - database not connected yet'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Test endpoint failed',
      details: error.message
    });
  }
};
