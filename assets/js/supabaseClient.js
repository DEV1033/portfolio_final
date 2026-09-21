// Loaded after the Supabase CDN script and config.js.
window.sb = supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);
