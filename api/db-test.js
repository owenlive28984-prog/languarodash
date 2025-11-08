// Database connection test
module.exports = async (req, res) => {
  try {
    const { Pool } = require('pg');
    
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      return res.status(500).json({
        error: 'DATABASE_URL not set',
        env_vars: Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES'))
      });
    }

    const pool = new Pool({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });

    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    await pool.end();

    return res.status(200).json({
      success: true,
      database_connected: true,
      current_time: result.rows[0].now,
      message: 'Database connection successful!'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      env_check: {
        has_database_url: !!process.env.DATABASE_URL,
        node_version: process.version
      }
    });
  }
};
