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
- The arcade cabinet opens a mini arcade with **Space Shooter** and **Snake** (`js/arcade.js`). Best scores are kept in the visitor's browser.
- The record player toggles a synthesized lo-fi loop. All audio is generated in code; there are no sound files.
- The floor lamp (or **N**) switches to night mode, with lamp and monitor lighting and a starry window.
- **Menu** (top right) lists every spot, so visitors in a hurry can jump straight there.

## Assets

`tools/build_assets.py` slices the two generated atlases into transparent sprites and packs them into `assets/sprites.png` + `assets/sprites.js`:

- `pixel-portfolio-tileset/…/studio-tileset-master.png` for furniture, decor and room pieces.
- `character-movement-pngs/…/character-movement-atlas-reference.png` for every hero frame.
- `Pixel Sofa with Sleeping Cat.png` for the sofa and `Retro Pixel Arcade Cabinet and Stool.png` for the arcade (both sized in `READY_IMAGES`).
- `Pixel Art TRUSTYY Workstation 1.png` / `2.png` for the two project desks. Each chair's lower half is cut out as a separate sprite so the character sorts correctly around it.

The provided per-frame character PNGs had their dark pixels (hair, eyes, outlines) keyed out, so the frames are re-cut from the atlas instead.

Re-run after changing a crop (needs Python with Pillow, NumPy and SciPy):

```
python tools/build_assets.py
```

It also writes `tools/_contact_sheet.png` so you can eyeball every sprite.

## Deploy

It's a static site. Drop the folder on GitHub Pages, Netlify or Vercel. Only `index.html`, `css/`, `js/` and `assets/` are needed at runtime.

## Debug flags

Add these to the URL: `?night`, `?panel=about`, `?go=cat`, `?debug` (shows colliders and hotspot standing points).
