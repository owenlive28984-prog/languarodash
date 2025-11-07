// Overall analytics endpoint for Vercel Serverless Function
import { Pool } from 'pg';

// Create a connection pool (Vercel will reuse across warm starts)
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await getPool().connect();

  try {
    // Initialize tables if they don't exist (first run)
    await initializeTables(client);

    // Calculate DAU (users active in last 24 hours)
    const dauResult = await client.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE session_start >= NOW() - INTERVAL '24 hours'
    `);
    const dau = parseInt(dauResult.rows[0]?.count || 0);

    // Calculate MAU (users active in last 30 days)
    const mauResult = await client.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM sessions
      WHERE session_start >= NOW() - INTERVAL '30 days'
    `);
    const mau = parseInt(mauResult.rows[0]?.count || 0);

    // Average session length (in seconds)
    const avgSessionResult = await client.query(`
      SELECT AVG(active_time_seconds) as avg
      FROM sessions
      WHERE session_start >= NOW() - INTERVAL '30 days'
        AND active_time_seconds > 0
    `);
    const avg_session = parseInt(avgSessionResult.rows[0]?.avg || 0);

    // Translations this week
    const translationsWeekResult = await client.query(`
      SELECT SUM(translations_count) as total
      FROM sessions
      WHERE session_start >= NOW() - INTERVAL '7 days'
    `);
    const translations_week = parseInt(translationsWeekResult.rows[0]?.total || 0);

    // Top language pairs (from event metadata)
    const topPairsResult = await client.query(`
      SELECT 
        CONCAT(metadata->>'source_lang', ' → ', metadata->>'target_lang') as pair,
        COUNT(*) as count
      FROM events
      WHERE event_type = 'translation_performed'
        AND timestamp >= NOW() - INTERVAL '30 days'
        AND metadata->>'source_lang' IS NOT NULL
        AND metadata->>'target_lang' IS NOT NULL
      GROUP BY pair
      ORDER BY count DESC
      LIMIT 10
    `);
    const top_pairs = {};
    topPairsResult.rows.forEach(row => {
      top_pairs[row.pair] = parseInt(row.count);
    });

    // OCR vs Clipboard usage
    const ocrResult = await client.query(`
      SELECT COUNT(*) as count
      FROM events
      WHERE event_type = 'translation_performed'
        AND timestamp >= NOW() - INTERVAL '30 days'
        AND metadata->>'method' = 'ocr'
    `);
    const ocr = parseInt(ocrResult.rows[0]?.count || 0);

    const clipboardResult = await client.query(`
      SELECT COUNT(*) as count
      FROM events
      WHERE event_type = 'translation_performed'
        AND timestamp >= NOW() - INTERVAL '30 days'
        AND metadata->>'method' = 'clipboard'
    `);
    const clipboard = parseInt(clipboardResult.rows[0]?.count || 0);

    // Return analytics data
    res.status(200).json({
      dau,
      mau,
      avg_session,
      translations_week,
      top_pairs,
      ocr,
      clipboard
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch overall analytics',
      details: error.message 
    });
  } finally {
    client.release();
  }
}

// Initialize database tables on first run
async function initializeTables(client) {
  try {
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'events'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // Create events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          event_id VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          metadata JSONB DEFAULT '{}',
          session_id VARCHAR(255) NOT NULL,
          app_version VARCHAR(50) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          session_start TIMESTAMPTZ NOT NULL,
          session_end TIMESTAMPTZ,
          active_time_seconds INTEGER DEFAULT 0,
          idle_time_seconds INTEGER DEFAULT 0,
          features_used JSONB DEFAULT '[]',
          translations_count INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(session_start)');

      console.log('✅ Database tables initialized');
    }
  } catch (error) {
    console.error('Table initialization error:', error);
    // Don't throw - analytics can still work if tables exist
  }
}
