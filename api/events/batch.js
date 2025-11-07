// Batch events endpoint for Vercel Serverless Function
import { Pool } from 'pg';

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

export default async function handler(req, res) {
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

  const { events, user_id } = req.body;

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid events payload' });
  }

  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    for (const event of events) {
      try {
        const result = await client.query(
          `INSERT INTO events (event_id, user_id, event_type, timestamp, metadata, session_id, app_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (event_id) DO NOTHING
           RETURNING id`,
          [
            event.event_id,
            event.user_id || user_id,
            event.event_type,
            event.timestamp,
            JSON.stringify(event.metadata || {}),
            event.session_id,
            event.app_version || '0.1.0'
          ]
        );
        if (result.rowCount > 0) inserted++;
      } catch (err) {
        console.error('Event insert error:', err);
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      inserted,
      total: events.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch events error:', error);
    res.status(500).json({
      error: 'Failed to process events',
      details: error.message
    });
  } finally {
    client.release();
  }
}
