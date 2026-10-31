// Cloudflare Worker for devchaudhary.com.
// The site itself is static files (served straight from the assets, see wrangler.jsonc);
// this script only runs for /api/* routes.
import { nowPlaying } from './now-playing.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/now-playing' && request.method === 'GET') return nowPlaying(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
