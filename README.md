# Setup

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/schema.sql` once.
3. Authentication -> Users -> Add user. Email can be anything (never shown in the UI); set the password to the 6-character passkey you want to type on `/admin/login.html`.
4. Project Settings -> API: copy the Project URL and anon public key into `assets/js/config.js`, and put the admin user's email in `adminEmail`.
5. Open `index.html` for the public site and `admin/login.html` for the admin panel. Any static host (or just opening the files) works since there's no build step.

# Structure

- `index.html` / `assets/js/user.js` — public feed, reads `site_settings` + published `posts`.
- `admin/login.html` / `assets/js/login.js` — 6-character passkey, signs in via Supabase Auth.
- `admin/index.html` / `assets/js/admin.js` — composer (text + up to 5MB/file, 25MB/post media), draft/publish, edit/delete, and the theme + CTA settings panel.
- `supabase/schema.sql` — tables (`site_settings`, `posts`, `post_media`), RLS policies, and the `media` storage bucket.

# Notes

- The public page re-fetches settings/posts whenever its tab regains focus, so admin changes show up without the visitor manually reloading mid-session.
- Categories are fixed: Tweets, Media, Case Studies, Activities (the "#tag" on each post = its category, not free text).
