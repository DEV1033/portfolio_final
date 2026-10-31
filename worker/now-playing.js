// GET /api/now-playing (called from worker/index.js)
// Dev's current song, or the last one played, via Last.fm (Spotify scrobbles to Last.fm;
// Spotify's own Web API needs a Premium account). Returns a small public JSON object.
// Settings: Cloudflare dashboard → Workers & Pages → portfolio-final → Settings → Variables and Secrets
//   LASTFM_API_KEY   (Secret) — free key from https://www.last.fm/api/account/create
//   LASTFM_USERNAME  (Text)   — Dev's Last.fm username

// Last.fm's grey-star placeholder when a track has no album art
const PLACEHOLDER = '2a96cbd8b46e442fc41c2b86b821562f';

const json = (body, status, maxAge) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });

async function lookup(env) {
  const { LASTFM_API_KEY: key, LASTFM_USERNAME: user } = env;
  if (!key || !user) return json({ error: 'not configured' }, 503);

  const url = 'https://ws.audioscrobbler.com/2.0/?' + new URLSearchParams({
    method: 'user.getrecenttracks', user, api_key: key, format: 'json', limit: '1',
  });
  const r = await fetch(url);
  if (!r.ok) return json({ error: 'last.fm request failed' }, 502);
  const data = await r.json();
  const list = data?.recenttracks?.track;
  const t = Array.isArray(list) ? list[0] : list;
  if (!t) return json({ playing: false }, 200, 60);

  const title = t.name || '';
  const artist = t.artist?.['#text'] || t.artist?.name || '';
  const imgs = t.image || [];
  const pickImg = (size) => imgs.find((i) => i.size === size)?.['#text'] || '';
  let art = pickImg('extralarge') || pickImg('large') || pickImg('medium');
  if (art.includes(PLACEHOLDER)) art = '';
  const playing = t['@attr']?.nowplaying === 'true';

  return json({
    playing,
    playedAt: !playing && t.date?.uts ? new Date(Number(t.date.uts) * 1000).toISOString() : undefined,
    title,
    artist,
    album: t.album?.['#text'] || '',
    art,
    // Last.fm doesn't give Spotify links, so open a Spotify search for the track
    url: title ? `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`.trim())}` : '',
  }, 200, playing ? 30 : 60);
}

export async function nowPlaying(request, env, ctx) {
  // short edge cache so every visitor doesn't hit Last.fm (best effort: a cache error never breaks the route)
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey).catch(() => null);
  if (hit) return hit;

  let res;
  try {
    res = await lookup(env);
  } catch {
    res = json({ error: 'last.fm request failed' }, 502);
  }
  if (res.status === 200) ctx.waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
  return res;
}
