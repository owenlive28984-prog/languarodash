// Batch sessions endpoint for Vercel Serverless Function
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
  return pool;
}

module.exports = async (req, res) => {
  // Enable CORS for Tauri app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessions, user_id } = req.body;

  if (!sessions || !Array.isArray(sessions)) {
    return res.status(400).json({ error: 'Invalid sessions payload' });
  }

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;

    for (const session of sessions) {
      try {
        const result = await client.query(
          `INSERT INTO sessions (
            session_id, user_id, session_start, session_end,
            active_time_seconds, idle_time_seconds, features_used, translations_count
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (session_id) 
           DO UPDATE SET
             session_end = EXCLUDED.session_end,
             active_time_seconds = EXCLUDED.active_time_seconds,
             idle_time_seconds = EXCLUDED.idle_time_seconds,
             features_used = EXCLUDED.features_used,
             translations_count = EXCLUDED.translations_count,
             updated_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            session.session_id,
            session.user_id || user_id,
            session.session_start,
            session.session_end || null,
            session.active_time_seconds || 0,
            session.idle_time_seconds || 0,
            JSON.stringify(session.features_used || []),
            session.translations_count || 0
          ]
        );

        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error('Session insert error:', err);
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      inserted,
      updated,
      total: sessions.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch sessions error:', error);
    res.status(500).json({
      error: 'Failed to process sessions',
      details: error.message
    });
  } finally {
    client.release();
  }
}
