// Simple test endpoint - no database, just returns fake data
module.exports = async (req, res) => {
  res.status(200).json({
    test: 'working',
    timestamp: new Date().toISOString(),
    env_check: {
      has_database_url: !!process.env.DATABASE_URL,
      node_version: process.version
    }
  });
};
