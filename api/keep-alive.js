// Vercel Cron calls this once a day (see vercel.json). Reading the table
// counts as activity, so the free Supabase project never pauses over a
// school break. The secret key lives only in Vercel's environment variables.
module.exports = async (req, res) => {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    res.status(500).json({ ok: false, error: 'Supabase settings are missing' });
    return;
  }

  try {
    const response = await fetch(`${url}/rest/v1/app_data?select=user_id`, { headers: { apikey: key } });
    if (!response.ok) {
      res.status(502).json({ ok: false, status: response.status });
      return;
    }
    const rows = await response.json();
    res.status(200).json({ ok: true, rows: rows.length });
  } catch (error) {
    res.status(502).json({ ok: false, error: error.message });
  }
};
