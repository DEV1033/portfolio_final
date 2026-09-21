// Loaded after the Supabase CDN script and config.js.
window.sb = supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey,
  {
    auth: {
      persistSession: true, // keep the session in localStorage across reloads/browser restarts
      autoRefreshToken: true, // silently refresh the access token so the session never expires from inactivity
    },
  }
);
