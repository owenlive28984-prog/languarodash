// Debug endpoint to see what DATABASE_URL looks like
module.exports = async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    return res.status(200).json({
      error: 'DATABASE_URL not set',
      all_env_vars: Object.keys(process.env)
    });
  }

  return res.status(200).json({
    has_url: true,
    length: dbUrl.length,
    starts_with: dbUrl.substring(0, 20),
    ends_with: dbUrl.substring(dbUrl.length - 30),
    has_newlines: dbUrl.includes('\n'),
    has_carriage_returns: dbUrl.includes('\r'),
    has_spaces: dbUrl.includes(' '),
    // Show first 100 chars (safe to expose for debugging)
    preview: dbUrl.substring(0, 100) + '...',
    // Check URL structure
    structure_check: {
      starts_with_postgres: dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'),
      has_at_symbol: dbUrl.includes('@'),
      has_colon: dbUrl.includes(':'),
      has_question_mark: dbUrl.includes('?')
    }
  });
};
