# Pixel Studio — interactive portfolio

A walkable pixel-art studio. Visitors explore the room, click objects and open portfolio panels. Pure HTML/CSS/JS with no build step and no dependencies.

## Run it

Open `index.html` in a browser. It also works over `file://`.
For the best result, serve the folder: `npx serve .` or `python -m http.server`.

**Controls:** WASD/arrows to walk · Shift to run · E/Space to interact · click/tap anything · N night · M music · Esc to close.

## Make it yours

| What | Where |
|---|---|
| Name, bio, projects, links, skills, experience | `js/content.js`: every panel's text lives here |
| GitHub account shown on the board & panel (live data) | `username` in the `github` section of `js/content.js` |
| Resume download | put `resume.pdf` next to `index.html` |
| Photos, showcase & motion videos, phone screens | `assets/media/`, referenced from `js/content.js` (`image`, `video`, `gallery`, `quotes` sections) |
| Object positions, hotspots, lamp glows | `js/world.js` |
| TRUSTYY / GOODDEX desks | `Pixel Art TRUSTYY Workstation 1.png` / `2.png`. Replace the images and re-run `python tools/build_assets.py` |
| Colours & fonts of the UI | `css/style.css` (`:root` variables) |

## Things to do in the room

- 13 info spots: a progress bar tracks them, and confetti fires when all are found.
- Pet the sleeping cat on the sofa and play the guitar.
- The record player toggles a synthesized lo-fi loop. All audio is generated in code; there are no sound files.
- The floor lamp (or **N**) switches to night mode, with lamp and monitor lighting and a starry window.
- **Menu** (top right) lists every spot, so visitors in a hurry can jump straight there.

## Assets

> This repo holds only what the site needs at runtime (`index.html`, `css/`, `js/`, `assets/`, `resume.pdf`). The source atlases, character frames and `tools/build_assets.py` live in the separate pixelworld source folder. Rebuild `assets/sprites.*` there and copy them here.

`tools/build_assets.py` slices the two generated atlases into transparent sprites and packs them into `assets/sprites.png` + `assets/sprites.js`:

- `pixel-portfolio-tileset/…/studio-tileset-master.png` for furniture, decor and room pieces.
- `character-movement-pngs/…/character-movement-atlas-reference.png` for every hero frame.
- `Pixel Sofa with Sleeping Cat.png` for the sofa (sized in `READY_IMAGES`).
- `Pixel Art TRUSTYY Workstation 1.png` / `2.png` for the two project desks. Each chair's lower half is cut out as a separate sprite so the character sorts correctly around it.

The provided per-frame character PNGs had their dark pixels (hair, eyes, outlines) keyed out, so the frames are re-cut from the atlas instead.

Re-run after changing a crop (needs Python with Pillow, NumPy and SciPy):

```
python tools/build_assets.py
```

It also writes `tools/_contact_sheet.png` so you can eyeball every sprite.

## Spotify via Last.fm (record player)

The record player shows what Dev is playing on Spotify right now, or the last song played. Spotify's own Web API needs a Premium account, so the song comes from **Last.fm**, which Spotify scrobbles to. `functions/api/now-playing.js` is a Cloudflare Pages Function, served at `/api/now-playing`. It keeps the API key server-side, caches the answer at the edge for 30–60 s, and returns only title, artist, album art and a Spotify search link.

One-time setup:

1. Sign up at [last.fm](https://www.last.fm). Under **Settings → Applications**, connect **Spotify** so every song gets scrobbled.
2. Create a free API key at [last.fm/api/account/create](https://www.last.fm/api/account/create). Any app name works and the callback URL can be blank.
3. Cloudflare dashboard → **Workers & Pages** → this project → **Settings → Variables and Secrets**: add `LASTFM_API_KEY` (type **Secret**) and `LASTFM_USERNAME` (type **Text**) for **Production**, then redeploy.

Until they're set, the panel just says it couldn't reach Spotify.

## Deploy

Hosted on **Cloudflare Pages**, connected to this GitHub repo:

- Workers & Pages → Create → Pages → **Connect to Git** → pick the repo.
- Framework preset: **None**. Build command: *(leave empty)*. Build output directory: `/`.
- Every push to `main` redeploys. `functions/` is picked up automatically as Pages Functions.

Clean URLs work out of the box. With no `404.html`, Cloudflare serves `index.html` for unknown paths, so old links like `/about` land in the studio. At runtime the site needs `index.html`, `css/`, `js/`, `assets/`, `resume.pdf` and `functions/`.

## Debug flags

Add these to the URL: `?night`, `?panel=about`, `?go=cat`, `?debug` (shows colliders and hotspot standing points).
