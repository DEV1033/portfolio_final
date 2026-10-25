// Pixel Studio — interactive portfolio engine (vanilla canvas, no dependencies).
(() => {
  'use strict';
  const S = window.SPRITES, WD = window.WORLD, CONTENT = window.CONTENT;
  const W = WD.W, H = WD.H;
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const sheet = new Image();
  sheet.src = 'assets/sprites.png';

  const PIXEL_FONT = '"Pixelify Sans", "Silkscreen", monospace';
  const HERO_SCALE = 0.68;
  const WALK_SPEED = 150, RUN_SPEED = 270;
  const FEET = { w: 32, h: 14 };   // player collision box at the feet
  const PANEL_KEYS = WD.hotspots.filter(h => h.panel && h.id !== 'exit').map(h => h.panel);

  // ── state ────────────────────────────────────────────────────────────────
  const state = {
    t: 0, night: false, nightAmt: 0, muted: false, music: false, spotify: null, spotifyStatus: 'loading',
    discovered: new Set(), panelOpen: false, started: false,
    hover: null, near: null, catPets: 0, celebrated: false,
  };
  const player = {
    x: 645, y: 752, dir: 'down', mode: 'idle', animT: 0, path: [], pending: null,
    bubble: null, bubbleT: 0,
  };
  const particles = [];
  const keys = new Set();

  // ── helpers ──────────────────────────────────────────────────────────────
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const byId = {};

  function drawSprite(c, name, x, y, sc = 1, flip = false) {
    const s = S[name];
    if (!s) return;
    if (flip) {
      c.save();
      c.translate(x + s.w * sc, y);
      c.scale(-1, 1);
      c.drawImage(sheet, s.x, s.y, s.w, s.h, 0, 0, s.w * sc, s.h * sc);
      c.restore();
    } else {
      c.drawImage(sheet, s.x, s.y, s.w, s.h, x, y, s.w * sc, s.h * sc);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ── objects: sizes, sort bases, colliders ───────────────────────────────
  // Every object is shrunk by WORLD.objectScale around an anchor (bottom-centre for
  // furniture, centre for rugs & wall art), so things stay where they stand but the
  // room gets roomier. Items resting on something scale around their parent's anchor.
  const K = WD.objectScale || 1;
  const makeXf = (ax, ay, k) => Object.assign((x, y) => [ax + (x - ax) * k, ay + (y - ay) * k], { k });
  const xf = { np: makeXf(1120, 116, K) }; // id -> point transform (np = now-playing screen)
  const objects = WD.objects.map(o => {
    const s = S[o.s];
    const sc0 = o.sc || 1, w0 = s.w * sc0, h0 = s.h * sc0;
    const layer = o.layer || 'obj';
    let tf;
    if (o.on && xf[o.on]) tf = xf[o.on];
    else {
      const k = o.fixed ? 1 : K;
      const flat = layer !== 'obj';
      tf = makeXf(o.x + w0 / 2, flat ? o.y + h0 / 2 : o.y + h0, k);
    }
    const k = tf.k, [x, y] = tf(o.x, o.y);
    const obj = { ...o, x, y, sc: sc0 * k, w: w0 * k, h: h0 * k, layer, tf };
    obj.base = o.base != null ? (o.base > H ? o.base : tf(0, o.base)[1]) : y + obj.h;
    if (o.solid && Array.isArray(o.solid)) obj.solid = o.solid.map(v => v * k);
    if (o.id) { byId[o.id] = obj; xf[o.id] = tf; }
    return obj;
  });
  // objects resting on another sort just after it
  objects.forEach(o => { if (o.on && byId[o.on]) o.base = byId[o.on].base + 0.5; });

  // move hotspots and lights along with the objects they belong to
  const ident = Object.assign((x, y) => [x, y], { k: 1 });
  const xfRect = (r, tf) => r && [...tf(r[0], r[1]), r[2] * tf.k, r[3] * tf.k];
  for (const h of WD.hotspots) {
    const tf = xf[h.obj] || ident, tf2 = xf[h.obj2] || tf;
    h.rect = xfRect(h.rect, tf);
    h.rect2 = xfRect(h.rect2, tf2);
    h.at = tf(...h.at);
  }
  for (const L of WD.lights) {
    const tf = xf[L.obj] || ident;
    [L.x, L.y] = tf(L.x, L.y);
    L.r *= tf.k;
  }
  // the sleeping cat is part of the sofa image; WORLD.cat is its spot within the sofa sprite
  const CAT = (() => { const o = byId.sofa, c = WD.cat; return { x: o.x + c[0] * o.sc, y: o.y + c[1] * o.sc }; })();
  const NP = (() => { const [x, y] = xf.np(1036, 64); return { x, y, k: K }; })();
  function runFx(c, o) {
    // hooks are written in unscaled sprite coordinates
    c.save(); c.translate(o.x, o.y); c.scale(o.sc, o.sc);
    FX[o.fx](c, { ...o, x: 0, y: 0, sc: 1, w: o.w / o.sc, h: o.h / o.sc });
    c.restore();
  }

  const solids = [];
  objects.forEach(o => {
    if (!o.solid) return;
    if (Array.isArray(o.solid)) {
      const [dx, dy, w, h] = o.solid;
      solids.push({ x: o.x + dx, y: o.y + dy, w, h });
    } else {
      const f = o.foot || 0.3;
      solids.push({ x: o.x + 6, y: o.y + o.h * (1 - f), w: o.w - 12, h: o.h * f });
    }
  });

  // after shrinking, a hotspot's standing point may land inside furniture or the wall:
  // move it to the nearest free spot (preferring straight below)
  function freeSpot([x, y]) {
    if (!blocked(x, y)) return [x, y];
    for (let r = 4; r <= 80; r += 4) {
      for (const [dx, dy] of [[0, r], [-r, 0], [r, 0], [-r, r], [r, r], [0, -r], [-r, -r], [r, -r]]) {
        if (!blocked(x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
    return [x, y];
  }
  for (const h of WD.hotspots) h.at = freeSpot(h.at);

  function blocked(x, y) {
    const b = { x: x - FEET.w / 2, y: y - FEET.h, w: FEET.w, h: FEET.h };
    const wk = WD.walk;
    if (b.x < wk.x0 - FEET.w / 2 || b.x + b.w > wk.x1 + FEET.w / 2) return true;
    if (y < wk.y0 || y > wk.y1) return true;
    for (const s of solids) {
      if (b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h && b.y + b.h > s.y) return true;
    }
    return false;
  }

  // ── pathfinding (A* on a coarse grid) ────────────────────────────────────
  const CELL = 10, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
  const grid = new Uint8Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) grid[gy * GW + gx] = blocked(gx * CELL + CELL / 2, gy * CELL + CELL / 2) ? 1 : 0;
  }
  function nearestFree(gx, gy) {
    for (let r = 0; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x >= 0 && y >= 0 && x < GW && y < GH && !grid[y * GW + x]) return [x, y];
      }
    }
    return null;
  }
  function lineFree(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 5);
    for (let i = 1; i <= n; i++) if (blocked(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    return true;
  }
  function findPath(sx, sy, tx, ty) {
    const s = nearestFree(Math.floor(sx / CELL), Math.floor(sy / CELL));
    const t = nearestFree(Math.floor(tx / CELL), Math.floor(ty / CELL));
    if (!s || !t) return [];
    const N = GW * GH, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const si = s[1] * GW + s[0], ti = t[1] * GW + t[0];
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hfn = i => Math.hypot(i % GW - t[0], Math.floor(i / GW) - t[1]);
    g[si] = 0; push(si, hfn(si));
    while (heap.length) {
      const [, i] = pop();
      if (i === ti) break;
      if (closed[i]) continue;
      closed[i] = 1;
      const x = i % GW, y = Math.floor(i / GW);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const ni = ny * GW + nx;
        if (grid[ni] || closed[ni]) continue;
        if (dx && dy && (grid[y * GW + nx] || grid[ny * GW + x])) continue; // no corner cutting
        const ng = g[i] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; from[ni] = i; push(ni, ng + hfn(ni)); }
      }
    }
    if (from[ti] === -1 && ti !== si) return [];
    const pts = [];
    for (let i = ti; i !== -1 && i !== si; i = from[i]) pts.push([(i % GW) * CELL + CELL / 2, Math.floor(i / GW) * CELL + CELL / 2]);
    pts.reverse();
    if (!blocked(tx, ty)) pts.push([tx, ty]);
    // string-pull: skip waypoints we can see past
    const out = [];
    let cx = sx, cy = sy, k = 0;
    while (k < pts.length) {
      let j = pts.length - 1;
      while (j > k && !lineFree(cx, cy, pts[j][0], pts[j][1])) j--;
      out.push(pts[j]);
      [cx, cy] = pts[j];
      k = j + 1;
    }
    return out;
  }

  // ── static background (room shell + floor/wall layers) ───────────────────
  let bg = null;
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = W; bg.height = H;
    const c = bg.getContext('2d');
    c.imageSmoothingEnabled = false;
    const R = WD.room;

    // floor: alternate the two plank tiles (clipped to the room)
    c.save();
    c.beginPath(); c.rect(R.x0, R.top, R.x1 - R.x0, R.bottom - R.top + 6); c.clip();
    const fs = S.floor;
    for (let y = R.wallBase - 20, row = 0; y < R.bottom + 20; y += fs.h, row++) {
      for (let x = R.x0 - (row % 2 ? 37 : 0), col = 0; x < R.x1; x += fs.w, col++) {
        drawSprite(c, (row + col) % 3 ? 'floor' : 'floor_b', x, y);
      }
    }
    c.restore();
    // back wall
    const wg = c.createLinearGradient(0, R.top, 0, R.wallBase);
    wg.addColorStop(0, '#f3e2c2'); wg.addColorStop(0.85, '#ead2a8'); wg.addColorStop(1, '#d9bb8b');
    c.fillStyle = wg;
    c.fillRect(R.x0, R.top, R.x1 - R.x0, R.wallBase - R.top);
    // soft vertical streaks for texture
    for (let x = R.x0; x < R.x1; x += 6) {
      c.fillStyle = `rgba(160,120,70,${0.02 + 0.03 * ((x * 7919) % 5) / 5})`;
      c.fillRect(x, R.top, 3, R.wallBase - R.top);
    }
    // baseboard
    for (let x = R.x0; x < R.x1; x += S.baseboard.w) drawSprite(c, 'baseboard', x, R.wallBase - 16);
    // shadow cast by the wall onto the floor
    const sg = c.createLinearGradient(0, R.wallBase + 4, 0, R.wallBase + 40);
    sg.addColorStop(0, 'rgba(60,30,10,0.35)'); sg.addColorStop(1, 'rgba(60,30,10,0)');
    c.fillStyle = sg;
    c.fillRect(R.x0, R.wallBase + 4, R.x1 - R.x0, 36);

    // side walls (thin cream caps) + outer frame
    const frame = '#efdcb6', frameDark = '#c8a676', outline = '#3a2416';
    c.fillStyle = frame;
    c.fillRect(R.x0 - 16, R.top - 12, 18, R.bottom - R.top + 30);           // left
    c.fillRect(R.x1 - 2, R.top - 12, 18, R.bottom - R.top + 30);            // right
    c.fillRect(R.x0 - 16, R.top - 12, R.x1 - R.x0 + 32, 14);                // top
    c.fillStyle = frameDark;
    c.fillRect(R.x0 + 2, R.top + 2, 4, R.bottom - R.top);
    c.fillRect(R.x1 - 6, R.top + 2, 4, R.bottom - R.top);
    c.fillRect(R.x0 - 16, R.top + 2, R.x1 - R.x0 + 32, 3);
    // side wall shading onto the floor
    for (const [x, dir] of [[R.x0 + 6, 1], [R.x1 - 6, -1]]) {
      const g = c.createLinearGradient(x, 0, x + dir * 26, 0);
      g.addColorStop(0, 'rgba(60,30,10,0.3)'); g.addColorStop(1, 'rgba(60,30,10,0)');
      c.fillStyle = g;
      c.fillRect(dir > 0 ? x : x - 26, R.wallBase, 26, R.bottom - R.wallBase);
    }
    c.strokeStyle = outline; c.lineWidth = 3;
    c.strokeRect(R.x0 - 16, R.top - 12, R.x1 - R.x0 + 32, R.bottom - R.top + 30);

    // rugs & wall art
    objects.filter(o => o.layer === 'floor' && o.s !== 'entrance_mat').forEach(o => drawSprite(c, o.s, o.x, o.y, o.sc));
    objects.filter(o => o.layer === 'wall').forEach(o => {
      drawSprite(c, o.s, o.x, o.y, o.sc);
      if (o.fx && FX[o.fx]) runFx(c, o);
    });

    // bottom wall rail with a gap for the entrance
    const rail = S.bottom_rail;
    c.save();
    c.beginPath();
    c.rect(R.x0 - 16, 0, R.doorGap[0] - R.x0 + 16, H);
    c.rect(R.doorGap[1], 0, R.x1 - R.doorGap[1] + 16, H);
    c.clip();
    for (let x = R.x0 - 16; x < R.x1 + 16; x += rail.w) drawSprite(c, 'bottom_rail', x, R.bottom - 4);
    c.restore();
    drawSprite(c, 'entrance_mat', byIdS('entrance_mat').x, byIdS('entrance_mat').y);
  }
  const byIdS = s => objects.find(o => o.s === s);

  // ── custom draw hooks ────────────────────────────────────────────────────
  function boardText(c, o, rect, text, size) {
    const [x, y, w, h] = rect;
    c.fillStyle = '#152033';
    c.fillRect(o.x + x, o.y + y, w, h);
    c.fillStyle = '#efe6d2';
    c.font = `${size}px ${PIXEL_FONT}`;
    c.textBaseline = 'middle';
    return [o.x + x, o.y + y + h / 2 + 1];
  }
  function screen(c, o, inset, draw) {
    const [x, y, w, h] = inset;
    c.save();
    c.beginPath(); c.rect(o.x + x, o.y + y, w, h); c.clip();
    const g = c.createLinearGradient(0, o.y + y, 0, o.y + y + h);
    g.addColorStop(0, '#141c33'); g.addColorStop(1, '#0b1122');
    c.fillStyle = g; c.fillRect(o.x + x, o.y + y, w, h);
    draw(o.x + x, o.y + y, w, h);
    // scanlines + glare
    c.fillStyle = 'rgba(255,255,255,0.03)';
    for (let yy = o.y + y; yy < o.y + y + h; yy += 3) c.fillRect(o.x + x, yy, w, 1);
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.beginPath(); c.moveTo(o.x + x, o.y + y); c.lineTo(o.x + x + w * 0.35, o.y + y); c.lineTo(o.x + x + w * 0.15, o.y + y + h); c.lineTo(o.x + x, o.y + y + h); c.fill();
    c.restore();
  }
  const FX = {
    fixBuild(c, o) {
      const [x, y] = boardText(c, o, [36, 83, 56, 16], '', 14);
      c.fillText('REPEAT', x + 2, y);
    },
    fixIdeas(c, o) {
      const [x, y] = boardText(c, o, [12, 60, 62, 15], '', 13);
      c.textAlign = 'center'; c.fillText('IDEAS', x + 31, y); c.textAlign = 'left';
    },
    screenCode(c, o) {
      screen(c, o, [7, 7, 98, 55], (x, y, w, h) => {
        const cols = ['#7dd3fc', '#f9a8d4', '#fde68a', '#86efac', '#c4b5fd', '#94a3b8'];
        const scroll = Math.floor(state.t * 2.2);
        for (let i = 0; i < 9; i++) {
          const n = i + scroll, ind = (n * 7) % 4, len = 14 + ((n * 37) % 50);
          c.fillStyle = cols[(n * 3) % cols.length];
          c.fillRect(x + 6 + ind * 6, y + 5 + i * 6, Math.min(len, w - 14 - ind * 6), 3);
        }
        if (Math.floor(state.t * 2) % 2) { c.fillStyle = '#e2e8f0'; c.fillRect(x + 6, y + 5 + 9 * 6 - 2, 4, 5); }
      });
    },
    githubBoard(c, o) {
      // paint live data over the board's placeholder grid and stats (sprite coordinates)
      if (GITHUB.status === 'loading') return;
      c.fillStyle = '#0d182a'; // board background colour
      c.fillRect(14, 49, 130, 52);          // grid area
      c.fillRect(40, 110, 108, 64);         // stat lines
      if (GITHUB.status === 'ok') {
        // last 18 weeks, one column per week (Sun..Sat), like GitHub
        const weeks = 18, cell = 6, gap = 1.2;
        const lastDow = new Date(GITHUB.days[GITHUB.days.length - 1].date).getUTCDay();
        const days = GITHUB.days.slice(-((weeks - 1) * 7 + lastDow + 1));
        const first = new Date(days[0].date).getUTCDay();
        days.forEach((d, i) => {
          const col = Math.floor((i + first) / 7), row = (i + first) % 7;
          c.fillStyle = GH_COLORS[d.level] || GH_COLORS[0];
          c.fillRect(16 + col * (cell + gap), 50 + row * (cell + gap), cell, cell);
        });
      } else {
        c.fillStyle = '#7c869c'; c.font = `10px ${PIXEL_FONT}`; c.textBaseline = 'middle';
        c.fillText('could not load', 44, 75);
      }
      c.fillStyle = '#e8edf7'; c.font = `12px ${PIXEL_FONT}`; c.textBaseline = 'middle';
      const n = v => (v == null ? '—' : v);
      const ok = GITHUB.status === 'ok';
      c.fillText(`${n(GITHUB.repos)} repos`, 43, 118);
      c.fillText(`${ok ? GITHUB.total : '—'} this year`, 43, 139);
      c.fillText(GITHUB.streak ? `${GITHUB.streak}-day streak` : `${ok ? GITHUB.activeDays : '—'} active days`, 43, 161);
    },
    arcadeScreen(c, o) {
      // attract mode: marching invaders + blinking INSERT COIN; "PLAYER 1 READY" after a coin
      screen(c, o, [23, 42, 75, 47], (x, y, w, h) => {
        const t = state.t, playing = state.arcadeT > 0;
        const INV = ['.#...#.', '..###..', '.#####.', '##.#.##', '#######', '#.#.#.#'];
        const march = Math.floor(t * 2) % 8, dx = march < 4 ? march : 8 - march;
        const cols = ['#ff6b3d', '#ffd23f', '#3fc5ff'];
        for (let r = 0; r < 3; r++) {
          for (let k = 0; k < 4; k++) {
            c.fillStyle = cols[r];
            const ix = x + 6 + dx * 2 + k * 16, iy = y + 4 + r * 9;
            INV.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') c.fillRect(ix + rx, iy + ry, 1, 1); }));
          }
        }
        // player ship + shot
        const sx = x + w / 2 + Math.sin(t * 1.7) * 22;
        c.fillStyle = '#5ee08a';
        c.fillRect(sx - 3, y + h - 6, 7, 2); c.fillRect(sx - 1, y + h - 8, 3, 2);
        c.fillStyle = '#fff';
        c.fillRect(sx, y + h - 10 - ((t * 60) % 26), 1, 3);
        c.font = `7px ${PIXEL_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (playing ? Math.floor(t * 6) % 2 : Math.floor(t * 1.6) % 2) {
          c.fillStyle = playing ? '#5ee08a' : '#ffd23f';
          c.fillText(playing ? 'PLAYER 1 READY' : 'INSERT COIN', x + w / 2, y + h - 17);
        }
        c.fillStyle = '#e8edf7';
        c.fillText(`HI ${String(99999 - (state.arcadeCredits || 0)).padStart(5, '0')}`, x + w / 2, y + 2.5);
        c.textAlign = 'left';
      });
    },
    spinRecord(c, o) {
      if (!state.music) return;
      const cx = o.x + 57 * o.sc, cy = o.y + 33 * o.sc, a = state.t * 5;
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2;
      for (const off of [0, Math.PI]) {
        c.beginPath(); c.arc(cx, cy, 20, a + off, a + off + 0.7); c.stroke();
      }
    },
  };

  // ── live GitHub data ─────────────────────────────────────────────────────
  const GITHUB = window.GitHubData.create(CONTENT.github.username); // fetch + stats live in js/github.js
  const GH_COLORS = ['#18243a', '#0e4429', '#006d32', '#26a641', '#39d353'];
  async function loadGitHub() {
    await window.GitHubData.load(GITHUB);
    if (state.panelOpen && state.panelKey === 'github') openPanel('github'); // refresh if open
  }

  // Now-playing wall screen (dynamic)
  function drawNowPlaying() {
    ctx.save(); ctx.translate(NP.x, NP.y); ctx.scale(NP.k, NP.k);
    drawNowPlayingScreen();
    ctx.restore();
  }
  function drawNowPlayingScreen() {
    const x = 0, y = 0, w = 168, h = 104;
    ctx.fillStyle = '#2b2233'; roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 4); ctx.fill();
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 4, y + h + 2, w + 8, 4);
    ctx.fillStyle = '#0d1322'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e8edf7'; ctx.font = `12px ${PIXEL_FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    // lo-fi loop if it's on; otherwise Dev's Spotify (live or last played)
    const sp = !state.music && state.spotify;
    ctx.fillText(sp ? (sp.playing ? 'DEV IS LISTENING' : 'LAST PLAYED') : 'NOW PLAYING', x + w / 2, y + 8);
    // marquee track title
    ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 24, w - 16, 14); ctx.clip();
    const title = state.music ? '♪ lofi.studio — build mode ♪   '
      : sp ? `♫ ${sp.title} — ${sp.artist}   ` : 'paused · click the record player   ';
    ctx.fillStyle = state.music ? '#8ef0a7' : sp ? '#1ed760' : '#7c869c'; ctx.textAlign = 'left'; ctx.font = `11px ${PIXEL_FONT}`;
    const tw = ctx.measureText(title).width, off = (state.t * 30) % tw;
    ctx.fillText(title + title, x + 8 - off, y + 25);
    ctx.restore();
    // equalizer
    const bars = 22, bw = 5, bx = x + (w - bars * (bw + 2)) / 2, by = y + 72;
    for (let i = 0; i < bars; i++) {
      const v = (state.music || (sp && sp.playing)) ? 0.25 + 0.75 * Math.abs(Math.sin(state.t * (3 + (i % 5)) + i * 1.7)) * (0.6 + 0.4 * Math.sin(state.t * 1.3 + i)) : 0.12;
      const bh = Math.max(2, Math.round(v * 30));
      for (let k = 0; k < bh; k += 3) {
        ctx.fillStyle = k > 22 ? '#fbbf24' : k > 14 ? '#a3e635' : '#22c55e';
        ctx.fillRect(bx + i * (bw + 2), by - k, bw, 2);
      }
    }
    // controls
    ctx.fillStyle = '#e8edf7';
    const cy = y + 88, cx = x + w / 2;
    tri(cx - 40, cy, -1); tri(cx - 34, cy, -1);
    if (state.music) { ctx.fillRect(cx - 5, cy - 5, 3, 10); ctx.fillRect(cx + 2, cy - 5, 3, 10); } else tri(cx - 3, cy, 1, 7);
    tri(cx + 30, cy, 1); tri(cx + 36, cy, 1);
    ctx.textAlign = 'left';
  }
  function tri(x, y, dir, s = 5) {
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + dir * s * 1.2, y); ctx.lineTo(x, y + s); ctx.fill();
  }

  // Windows: night sky overlay
  function drawWindowsNight() {
    if (state.nightAmt <= 0.01) return;
    for (const id of ['win1', 'win2']) {
      const o = byId[id];
      const ix = o.x + 9, iy = o.y + 8, iw = o.w - 18, ih = o.h - 17;
      ctx.fillStyle = `rgba(10,14,48,${0.82 * state.nightAmt})`;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = `rgba(255,255,230,${state.nightAmt})`;
      for (let i = 0; i < 14; i++) {
        const sx = ix + ((i * 97 + o.x) % iw), sy = iy + ((i * 53) % (ih * 0.5));
        if (Math.sin(state.t * 2 + i) > -0.6) ctx.fillRect(sx, sy, 2, 2);
      }
      // lit office windows in the skyline
      ctx.fillStyle = `rgba(255,214,120,${0.9 * state.nightAmt})`;
      for (let i = 0; i < 18; i++) ctx.fillRect(ix + ((i * 61 + 13) % iw), iy + ih * 0.62 + ((i * 29) % (ih * 0.3)), 3, 3);
      if (id === 'win1') { // moon
        ctx.fillStyle = `rgba(250,246,220,${state.nightAmt})`;
        ctx.beginPath(); ctx.arc(ix + iw - 40, iy + 22, 10, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(10,14,48,${0.9 * state.nightAmt})`;
        ctx.beginPath(); ctx.arc(ix + iw - 35, iy + 19, 9, 0, 7); ctx.fill();
      }
    }
  }

  // ── night lighting ───────────────────────────────────────────────────────
  const nightC = document.createElement('canvas');
  nightC.width = W; nightC.height = H;
  const nctx = nightC.getContext('2d');
  function drawNight() {
    const a = state.nightAmt;
    if (a <= 0.01) return;
    nctx.globalCompositeOperation = 'source-over';
    nctx.clearRect(0, 0, W, H);
    nctx.fillStyle = `rgba(12,16,46,${0.66 * a})`;
    nctx.fillRect(0, 0, W, H);
    nctx.globalCompositeOperation = 'destination-out';
    const flick = 1 + Math.sin(state.t * 9) * 0.015;
    for (const L of WD.lights) {
      const g = nctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * flick);
      g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.5, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      nctx.fillStyle = g; nctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.drawImage(nightC, 0, 0);
    // warm additive glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of WD.lights) {
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.6);
      g.addColorStop(0, `rgba(${L.c},${0.22 * a})`); g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    ctx.restore();
  }

  // ── player animation ─────────────────────────────────────────────────────
  function heroFrame() {
    // the hero only stands or walks; running just plays the walk cycle faster
    const d = player.dir;
    if (player.mode === 'idle') return `hero_idle_${d}`;
    const fps = player.mode === 'run' ? 12 : 8;
    return `hero_walk_${d}_${1 + Math.floor(player.animT * fps) % 4}`;
  }
  function drawPlayer() {
    const name = heroFrame(), s = S[name];
    const sc = HERO_SCALE;
    // shadow
    ctx.fillStyle = 'rgba(30,15,5,0.28)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y - 2, 22, 7, 0, 0, 7); ctx.fill();
    const bob = player.mode === 'idle' && Math.sin(state.t * 2.4) > 0.6 ? 1 : 0;
    drawSprite(ctx, name, Math.round(player.x - s.ax * sc), Math.round(player.y - s.ay * sc + bob), sc);
  }
  function say(text, dur = 3.5) { player.bubble = text; player.bubbleT = dur; }

  // ── interactions ─────────────────────────────────────────────────────────
  function nearestHotspot() {
    let best = null, bd = 78;
    for (const h of WD.hotspots) {
      const d = Math.hypot(player.x - h.at[0], player.y - h.at[1]);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }
  function inRect(r, x, y) { return r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]; }
  function hotspotAt(x, y) {
    const hits = WD.hotspots.filter(h => inRect(h.rect, x, y) || inRect(h.rect2, x, y));
    hits.sort((a, b) => a.rect[2] * a.rect[3] - b.rect[2] * b.rect[3]);
    return hits[0] || null;
  }
  function goTo(h) {
    player.path = findPath(player.x, player.y, h.at[0], h.at[1]);
    player.pending = h;
    if (!player.path.length) arrive();
  }
  function arrive() {
    const h = player.pending;
    player.pending = null;
    if (!h) return;
    if (Math.hypot(player.x - h.at[0], player.y - h.at[1]) > 90) return;
    player.dir = h.face || player.dir;
    interact(h);
  }
  function interact(h) {
    sfx.blip();
    switch (h.action) {
      case 'music': toggleMusic(); break;
      case 'guitar':
        sfx.strum();
        for (let i = 0; i < 6; i++) spawn('note', h.rect[0] + 20, h.rect[1] + 20, { delay: i * 0.12 });
        say(['♪ Wonderwall, anyone?', '♪ *strums a G chord*', '♪ Only 3 chords, but they slap'][Math.floor(Math.random() * 3)], 2.5);
        return;
      case 'pet':
        state.catPets++;
        sfx.meow();
        for (let i = 0; i < 5; i++) spawn('heart', CAT.x, CAT.y, { delay: i * 0.1 });
        say(state.catPets === 1 ? 'Meet Bug, the studio cat 🐱' : state.catPets < 5 ? 'Bug purrs happily.' : 'Bug: "ok that\'s enough"', 2.5);
        return;
      case 'night': toggleNight(); return;
      case 'arcade':
        state.arcadeCredits = (state.arcadeCredits || 0) + 1;
        state.arcadeT = 3;
        sfx.coin();
        say(['Insert coin… 🕹️', 'High score: DEV — 99,999', 'One more game. Just one.', 'Pew pew pew!'][(state.arcadeCredits - 1) % 4], 2.5);
        openArcade();
        return;
    }
    if (h.panel) openPanel(h.panel);
  }

  // ── particles ────────────────────────────────────────────────────────────
  function spawn(type, x, y, o = {}) {
    particles.push({ type, x: x + rnd(-14, 14), y: y + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-55, -35), life: o.life || 1.6, age: -(o.delay || 0), col: o.col, rot: rnd(0, 6) });
  }
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age < 0) continue;
      if (p.age > p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'confetti') { p.vy += 140 * dt; p.rot += dt * 6; }
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      if (p.type === 'heart') {
        ctx.fillStyle = '#ff5d7a';
        HEART.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '#') ctx.fillRect(Math.round(p.x) + rx * 2, Math.round(p.y) + ry * 2, 2, 2); }));
      } else if (p.type === 'note' || p.type === 'z') {
        ctx.fillStyle = p.type === 'z' ? '#7aa7ff' : '#fff2b3';
        ctx.strokeStyle = '#2a1b10'; ctx.lineWidth = 3;
        ctx.font = `${p.type === 'z' ? 18 : 22}px ${PIXEL_FONT}`;
        const ch = p.type === 'z' ? 'z' : '♪';
        ctx.strokeText(ch, p.x, p.y); ctx.fillText(ch, p.x, p.y);
      } else if (p.type === 'confetti') {
        ctx.fillStyle = p.col;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-3, -2, 6, 4); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── speech bubble & prompts ──────────────────────────────────────────────
  function drawBubble() {
    if (!player.bubble || player.bubbleT <= 0) return;
    ctx.font = `15px ${PIXEL_FONT}`;
    const text = player.bubble, tw = ctx.measureText(text).width;
    const w = tw + 20, h = 28;
    const head = 126 * HERO_SCALE / 0.9;
    let x = clamp(player.x - w / 2, 8, W - w - 8), y = player.y - head - h - 6;
    ctx.globalAlpha = Math.min(1, player.bubbleT * 3);
    ctx.fillStyle = '#2a1b10'; roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 6); ctx.fill();
    ctx.fillStyle = '#fff8e8'; roundRect(ctx, x, y, w, h, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(player.x - 6, y + h); ctx.lineTo(player.x + 6, y + h); ctx.lineTo(player.x, y + h + 8); ctx.fillStyle = '#fff8e8'; ctx.fill();
    ctx.fillStyle = '#2a1b10'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 10, y + h / 2 + 1);
    ctx.globalAlpha = 1;
  }
  function drawHighlight(h, strong) {
    const pulse = 0.55 + 0.45 * Math.sin(state.t * 5);
    for (const r of [h.rect, h.rect2]) {
      if (!r) continue;
      const [x, y, w, hh] = r, L = 12;
      ctx.strokeStyle = `rgba(255,236,150,${strong ? 0.9 : 0.5 * pulse + 0.3})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + hh, 1, -1], [x + w, y + hh, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy);
      });
      ctx.stroke();
    }
  }
  function drawPrompt(h) {
    const label = h.label;
    ctx.font = `14px ${PIXEL_FONT}`;
    const key = isTouch ? 'TAP' : 'E';
    const kw = ctx.measureText(key).width + 12, tw = ctx.measureText(label).width;
    const w = kw + tw + 18, bh = 26;
    const r = h.rect;
    const x = clamp(r[0] + r[2] / 2 - w / 2, 6, W - w - 6);
    const y = Math.max(4, r[1] - bh - 10 + Math.sin(state.t * 4) * 2);
    ctx.fillStyle = 'rgba(16,20,36,0.92)'; roundRect(ctx, x, y, w, bh, 6); ctx.fill();
    ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd36a'; roundRect(ctx, x + 5, y + 4, kw, bh - 8, 4); ctx.fill();
    ctx.fillStyle = '#1a1424'; ctx.textBaseline = 'middle';
    ctx.fillText(key, x + 11, y + bh / 2 + 1);
    ctx.fillStyle = '#fff6dc';
    ctx.fillText(label, x + kw + 12, y + bh / 2 + 1);
  }

  // ── camera / resize ──────────────────────────────────────────────────────
  // outer edges of the room's wall frame — the view is fitted to these, edge to edge
  const FRAME_X0 = WD.room.x0 - 17, FRAME_X1 = WD.room.x1 + 17;
  let vw = 0, vh = 0, scale = 1, camX = 0, camY = 0, dpr = 1, padTop = 0;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    cvs.width = Math.round(vw * dpr); cvs.height = Math.round(vh * dpr);
    cvs.style.width = vw + 'px'; cvs.style.height = vh + 'px';
    padTop = vw > 640 ? 78 : 0; // keep the HUD from covering the back wall on desktop
    // fill the full screen width; if the room is then taller than the screen,
    // the camera scrolls vertically with the player (phones keep a readable zoom)
    scale = Math.max(vw / (FRAME_X1 - FRAME_X0), Math.min(0.8, vh / H));
    updateCamera(0);
  }
  function updateCamera(dt) {
    const viewW = vw / scale, viewH = vh / scale;
    const fw = FRAME_X1 - FRAME_X0;
    const tx = viewW >= fw + 1 ? FRAME_X0 - (viewW - fw) / 2 : clamp(player.x - viewW / 2, FRAME_X0, FRAME_X1 - viewW);
    const ty = viewH - padTop / scale >= H ? -(padTop + (vh - padTop - H * scale) / 2) / scale : clamp(player.y - 60 - viewH / 2, -padTop / scale, H - viewH);
    const k = dt ? Math.min(1, dt * 6) : 1;
    camX += (tx - camX) * k; camY += (ty - camY) * k;
  }
  function screenToWorld(sx, sy) { return [sx / scale + camX, sy / scale + camY]; }

  // ── update ───────────────────────────────────────────────────────────────
  function update(dt) {
    state.t += dt;
    state.nightAmt = clamp(state.nightAmt + (state.night ? dt : -dt) * 1.5, 0, 1);
    if (player.bubbleT > 0) player.bubbleT -= dt;
    if (state.arcadeT > 0) state.arcadeT -= dt;
    player.animT += dt;
    updateCamera(dt);

    let ix = 0, iy = 0;
    if (!state.panelOpen) {
      if (keys.has('arrowleft') || keys.has('a')) ix -= 1;
      if (keys.has('arrowright') || keys.has('d')) ix += 1;
      if (keys.has('arrowup') || keys.has('w')) iy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) iy += 1;
    }
    const running = keys.has('shift');

    if (ix || iy) { player.path = []; player.pending = null; }

    let mx = ix, my = iy, speed = running ? RUN_SPEED : WALK_SPEED;
    if (!ix && !iy && player.path.length) {
      const [tx, ty] = player.path[0];
      const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy);
      speed = player.path.length > 1 || d > 260 ? RUN_SPEED * 0.85 : WALK_SPEED;
      if (d < 4) { player.path.shift(); if (!player.path.length) { player.mode = 'idle'; arrive(); } }
      else { mx = dx / d; my = dy / d; }
    }

    if (mx || my) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      const step = speed * dt;
      const nx = player.x + mx * step, ny = player.y + my * step;
      if (!ix && !iy && player.path.length) {
        // following a path: segments were checked by findPath, so just move
        player.x = nx; player.y = ny;
      } else {
        // keyboard: slide along obstacles one axis at a time (free movement if somehow stuck)
        const stuck = blocked(player.x, player.y);
        if (stuck || !blocked(nx, player.y)) player.x = nx;
        if (stuck || !blocked(player.x, ny)) player.y = ny;
      }
      player.dir = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
      player.mode = speed > WALK_SPEED ? 'run' : 'walk';
    } else {
      player.mode = 'idle';
    }


    // cat dreams
    if (Math.random() < dt * 0.35) spawn('z', CAT.x + 20, CAT.y - 4, { life: 1.8 });
    // music notes from the record player
    if (state.music && Math.random() < dt * 1.4) spawn('note', byId.turntable.x + byId.turntable.w / 2, byId.turntable.y - 6, { life: 1.8 });

    state.near = state.panelOpen ? null : nearestHotspot();
  }

  // ── render ───────────────────────────────────────────────────────────────
  function render(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const n = state.nightAmt; // outside the room darkens along with the night overlay
    ctx.fillStyle = `rgb(${22 - 7 * n},${27 - 8 * n},${46 - 2 * n})`;
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, -camY * dpr * scale);
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(bg, 0, 0);
    drawWindowsNight();
    drawNowPlaying();

    // depth-sorted objects + player
    const list = objects.filter(o => o.layer === 'obj');
    const pBase = player.y;
    const drawables = list.map(o => ({ base: o.base, o }));
    drawables.push({ base: pBase, player: true });
    drawables.sort((a, b) => a.base - b.base);
    for (const d of drawables) {
      if (d.player) { drawPlayer(); continue; }
      const o = d.o;
      drawSprite(ctx, o.s, o.x, o.y, o.sc, o.flip);
      if (o.fx && FX[o.fx]) runFx(ctx, o);
    }

    drawNight();
    drawParticles(dt);

    // hover / proximity hints
    if (!state.panelOpen && state.started) {
      if (state.hover) drawHighlight(state.hover, true);
      if (state.near) { if (state.near !== state.hover) drawHighlight(state.near, false); drawPrompt(state.near); }
    }
    drawBubble();
    if (DEBUG) drawDebug();
  }
  const DEBUG = new URLSearchParams(location.search).has('debug');
  function drawDebug() {
    ctx.fillStyle = 'rgba(255,0,0,0.3)';
    solids.forEach(r => ctx.fillRect(r.x, r.y, r.w, r.h));
    ctx.strokeStyle = 'rgba(0,255,255,0.6)'; ctx.lineWidth = 1;
    const wk = WD.walk; ctx.strokeRect(wk.x0, wk.y0, wk.x1 - wk.x0, wk.y1 - wk.y0);
    for (const h of WD.hotspots) {
      const p = findPath(645, 752, h.at[0], h.at[1]);
      const end = p.length ? p[p.length - 1] : [645, 752];
      const ok = !blocked(h.at[0], h.at[1]) && Math.hypot(end[0] - h.at[0], end[1] - h.at[1]) < 20;
      ctx.fillStyle = ok ? '#0f0' : '#f00';
      ctx.fillRect(h.at[0] - 5, h.at[1] - 5, 10, 10);
      ctx.font = '12px monospace'; ctx.fillText(h.id, h.at[0] + 7, h.at[1]);
    }
  }

  // ── panels (HTML) ────────────────────────────────────────────────────────
  const panel = document.getElementById('panel');
  const panelBody = document.getElementById('panel-body');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let clockTimer = null;

  // generic blocks come from js/panels.js (shared with normal mode); these are the
  // live, game-only section types
  const CUSTOM_SECTIONS = Object.fromEntries(['contrib', 'github-stats', 'clock', 'spotify', 'music'].map(t => [t, renderLive]));
  function renderLive(sec, title) {
    switch (sec.type) {
      case 'contrib': {
        if (GITHUB.status === 'loading') return `${title}<p class="note">Loading contributions…</p>`;
        if (GITHUB.status === 'error') return `${title}<p class="note">Could not reach GitHub right now. Try the link below.</p>`;
        const first = new Date(GITHUB.days[0].date).getUTCDay();
        let cells = '<i class="pad"></i>'.repeat(first);
        for (const d of GITHUB.days) {
          const day = new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
          cells += `<i class="l${d.level}" data-count="${d.count}" data-day="${esc(day)}" aria-label="${esc(`${d.count} contribution${d.count === 1 ? '' : 's'} on ${day}`)}"></i>`;
        }
        return `${title}<p class="contrib-total"><b>${GITHUB.total}</b> contributions in the last year</p>
          <div class="contrib-scroll"><div class="contrib year">${cells}</div></div>
          <div class="contrib-legend">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>`;
      }
      case 'github-stats': {
        const ok = GITHUB.status === 'ok';
        const items = [
          [GITHUB.repos == null ? '—' : GITHUB.repos, 'public repos'],
          [ok ? GITHUB.total : '—', 'contributions (1y)'],
          [ok ? GITHUB.streak : '—', 'day streak'],
          [ok && GITHUB.best ? GITHUB.best.count : '—', 'best day'],
        ];
        return `${title}<div class="stats four">${items.map(([v, l]) => `<div><b>${esc(v)}</b><small>${l}</small></div>`).join('')}</div>`;
      }
      case 'clock': return `${title}<div class="clock"><small>${esc(sec.label)}</small><b data-tz="${esc(sec.tz)}">--:--</b></div>`;
      case 'spotify': return `${title}${renderSpotifyCard()}`;
      case 'music': return `<button class="pixel-btn music-toggle">${state.music ? '❚❚ Pause music' : '▶ Play studio music'}</button>`;
    }
    return '';
  }
  function openPanel(key) {
    const c = CONTENT[key];
    if (!c) return;
    state.panelKey = key;
    panelBody.innerHTML = window.PanelUI.renderPanel(c, CUSTOM_SECTIONS);
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    state.panelOpen = true;
    panelBody.querySelector('.music-toggle')?.addEventListener('click', e => { toggleMusic(); e.target.textContent = state.music ? '❚❚ Pause music' : '▶ Play studio music'; });
    const tick = () => panelBody.querySelectorAll('[data-tz]').forEach(el => {
      el.textContent = new Date().toLocaleTimeString([], { timeZone: el.dataset.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    tick(); clearInterval(clockTimer); clockTimer = setInterval(tick, 1000);
    panel.querySelector('.close').focus({ preventScroll: true });
    if (PANEL_KEYS.includes(key)) discover(key);
    if (key === 'music') loadSpotify();
  }
  // the cabinet opens the mini arcade (js/arcade.js); the room pauses while it's open
  function openArcade(start) {
    if (!window.Arcade) return;
    keys.clear();
    document.querySelectorAll('#pad .pressed').forEach(b => b.classList.remove('pressed'));
    state.panelOpen = true;
    setTimeout(() => window.Arcade.open({
      start,
      beep: (f, d, type, v) => { if (!state.muted) tone(f, ac().currentTime, d, type, v); },
      onClose: () => { state.panelOpen = false; cvs.focus(); },
    }), 350);
  }
  function closePanel() {
    if (!state.panelOpen) return;
    panelBody.querySelectorAll('video').forEach(v => v.pause()); // stop showcase/motion videos with the panel
    hideContribTip();
    panel.classList.remove('open');
    state.panelOpen = false;
    clearInterval(clockTimer);
    setTimeout(() => { if (!state.panelOpen) panel.hidden = true; }, 180);
    cvs.focus();
  }
  panel.addEventListener('click', e => { if (e.target === panel || e.target.closest('.close')) closePanel(); });

  // GitHub panel: instant pixel tooltip with the day's contribution count (hover, or tap on touch)
  const contribTip = document.createElement('div');
  contribTip.className = 'contrib-tip';
  contribTip.hidden = true;
  document.body.appendChild(contribTip);
  let tipCell = null;
  function showContribTip(cell) {
    if (tipCell === cell) return;
    tipCell?.classList.remove('active');
    tipCell = cell;
    cell.classList.add('active');
    const n = Number(cell.dataset.count);
    contribTip.innerHTML = `<b>${n === 0 ? 'No' : n} contribution${n === 1 ? '' : 's'}</b><small>${esc(cell.dataset.day)}</small>`;
    contribTip.hidden = false;
    const r = cell.getBoundingClientRect(), t = contribTip.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8);
    const above = r.top - t.height - 8;
    contribTip.style.left = `${x}px`;
    contribTip.style.top = `${above > 8 ? above : r.bottom + 8}px`;
  }
  function hideContribTip() {
    tipCell?.classList.remove('active');
    tipCell = null;
    contribTip.hidden = true;
  }
  panelBody.addEventListener('pointerover', e => {
    const cell = e.target.closest('.contrib i[data-count]');
    if (cell) showContribTip(cell);
  });
  panelBody.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.contrib i[data-count]');
    if (cell) showContribTip(cell);
  });
  panelBody.addEventListener('pointerout', e => {
    if (e.pointerType === 'mouse' && e.target.closest('.contrib i[data-count]') && !e.relatedTarget?.closest?.('.contrib i[data-count]')) hideContribTip();
  });
  panelBody.closest('.sheet').addEventListener('scroll', hideContribTip, { passive: true });
  panelBody.addEventListener('scroll', hideContribTip, { capture: true, passive: true }); // the grid's own sideways scroll

  // ── discovery progress ───────────────────────────────────────────────────
  const total = new Set(PANEL_KEYS).size;
  function discover(key) {
    if (state.discovered.has(key)) return;
    state.discovered.add(key);
    updateProgress();
    if (state.discovered.size === total && !state.celebrated) {
      state.celebrated = true;
      setTimeout(() => {
        closePanel();
        say("You've seen everything! Let's build something together.", 5);
        sfx.fanfare();
        const cols = ['#ffd36a', '#ff5d7a', '#7aa7ff', '#5ee08a', '#c08bff'];
        for (let i = 0; i < 80; i++) particles.push({ type: 'confetti', x: player.x + rnd(-200, 200), y: player.y - 260 + rnd(-40, 20), vx: rnd(-60, 60), vy: rnd(-120, 10), life: 2.6, age: -rnd(0, 0.5), col: cols[i % 5], rot: rnd(0, 6) });
      }, 900);
    }
  }
  function updateProgress() {
    document.getElementById('progress-text').textContent = `${state.discovered.size}/${total} explored`;
    document.getElementById('progress-bar').style.width = `${(state.discovered.size / total) * 100}%`;
    document.querySelectorAll('#menu [data-spot]').forEach(b => {
      const h = WD.hotspots.find(x => x.id === b.dataset.spot);
      b.classList.toggle('done', !!h && state.discovered.has(h.panel));
    });
  }

  // ── toasts ───────────────────────────────────────────────────────────────
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Spotify (via Last.fm scrobbles): what Dev is playing now, or played last — /api/now-playing ──
  async function loadSpotify() {
    try {
      const res = await fetch('/api/now-playing', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.spotify = data.title ? data : null;
      state.spotifyStatus = data.title ? 'ok' : 'empty';
    } catch {
      state.spotify = null;
      state.spotifyStatus = 'error';
    }
    // refresh an open record-player panel so its card shows the latest song
    if (state.panelOpen && state.panelKey === 'music') {
      const card = panelBody.querySelector('.spotify-card');
      if (card) card.outerHTML = renderSpotifyCard();
    }
  }
  function timeAgo(iso) {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  function renderSpotifyCard() {
    const sp = state.spotify;
    if (!sp) {
      const msg = state.spotifyStatus === 'loading' ? 'Checking what Dev is listening to…' : "Couldn't reach Spotify right now.";
      return `<div class="spotify-card empty"><p class="note">${msg}</p></div>`;
    }
    const when = sp.playing ? '<span class="live">● Listening now</span>' : `Last played · ${esc(timeAgo(sp.playedAt))}`;
    return `<div class="spotify-card">
      ${sp.art ? `<img src="${esc(sp.art)}" alt="" width="72" height="72">` : ''}
      <div><small>${when}</small><b>${esc(sp.title)}</b><span>${esc(sp.artist)}</span>
      ${sp.url ? `<a href="${esc(sp.url)}" target="_blank" rel="noopener">Open in Spotify →</a>` : ''}</div>
    </div>`;
  }

  // ── night & music toggles ────────────────────────────────────────────────
  function setNight(on, message) {
    state.night = on;
    document.getElementById('btn-night').classList.toggle('on', on);
    if (message) toast(message);
  }
  function toggleNight() {
    setNight(!state.night, !state.night ? 'Night mode — lamps on 🌙' : 'Good morning ☀️');
  }

  // Day/night follows the visitor's local clock: night 6:30 PM – 5:30 AM, day 5:31 AM – 6:29 PM.
  // The lamp / N key still switch it by hand; that holds until the next scheduled change.
  const DAY_START = 5 * 60 + 31, NIGHT_START = 18 * 60 + 30; // minutes after midnight
  function isNightNow(d = new Date()) {
    const m = d.getHours() * 60 + d.getMinutes();
    return m < DAY_START || m >= NIGHT_START;
  }
  let scheduledNight = isNightNow();
  function followClock() {
    const now = isNightNow();
    if (now === scheduledNight) return;
    scheduledNight = now;
    setNight(now, now ? 'Evening — lamps on 🌙' : 'The sun is up — good morning ☀️');
  }
  function toggleMusic() {
    state.music = !state.music;
    document.getElementById('btn-music').classList.toggle('on', state.music);
    if (state.music) { audio.start(); toast('♪ Now playing: lofi.studio — build mode'); }
    else { audio.stop(); toast('Music paused'); }
  }

  // ── audio (all synthesized, no files) ────────────────────────────────────
  let AC = null, master = null;
  function ac() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = state.muted ? 0 : 0.5; master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, t, dur, type = 'square', vol = 0.1, dest) {
    const a = ac(), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const sfx = {
    blip() { const t = ac().currentTime; tone(880, t, 0.06, 'square', 0.05); tone(1320, t + 0.05, 0.08, 'square', 0.04); },
    meow() {
      const a = ac(), t = a.currentTime, o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(820, t + 0.15); o.frequency.linearRampToValueAtTime(480, t + 0.45);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.55);
    },
    strum() { // Karplus–Strong plucked G major chord
      const a = ac(), t = a.currentTime;
      [43, 47, 50, 55, 59, 67].forEach((m, i) => pluck(mtof(m), t + i * 0.035, 0.18));
    },
    coin() { const t = ac().currentTime; tone(988, t, 0.08, 'square', 0.06); tone(1319, t + 0.08, 0.35, 'square', 0.06); },
    fanfare() { const t = ac().currentTime; [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), t + i * 0.12, 0.3, 'square', 0.06)); },
  };
  function pluck(freq, t, vol) {
    const a = ac(), sr = a.sampleRate, len = Math.floor(sr * 2.2), buf = a.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const N = Math.round(sr / freq), ring = new Float32Array(N).map(() => Math.random() * 2 - 1);
    for (let i = 0; i < len; i++) { const k = i % N, nx = (k + 1) % N; d[i] = ring[k]; ring[k] = 0.996 * 0.5 * (ring[k] + ring[nx]); }
    const s = a.createBufferSource(), g = a.createGain(); g.gain.value = vol;
    s.buffer = buf; s.connect(g); g.connect(master); s.start(t);
  }
  // lo-fi loop: Am7 – Fmaj7 – Cmaj7 – G6, 84 bpm
  const audio = (() => {
    let timer = null, step = 0, next = 0, bus = null;
    const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 64]];
    const lead = [76, null, 72, 74, null, 76, 79, null, 77, null, 76, 72, null, 74, 72, null];
    const spb = 60 / 84 / 2; // eighth notes
    function schedule() {
      const a = ac();
      while (next < a.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4, ch = chords[bar], s8 = step % 8;
        if (s8 === 0) { ch.forEach(m => tone(mtof(m), next, spb * 7.5, 'triangle', 0.035, bus)); tone(mtof(ch[0] - 24), next, spb * 3.5, 'sine', 0.16, bus); }
        if (s8 === 4) tone(mtof(ch[0] - 24), next, spb * 3, 'sine', 0.12, bus);
        const ln = lead[(step + bar * 3) % lead.length];
        if (ln && step % 2 === 0) tone(mtof(ln - (bar === 1 ? 2 : 0)), next, spb * 1.6, 'square', 0.022, bus);
        // hats
        const nb = a.createBuffer(1, 2205, a.sampleRate), nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length) ** 4;
        const ns = a.createBufferSource(), ng = a.createGain(); ns.buffer = nb; ng.gain.value = s8 % 2 ? 0.025 : 0.05;
        ns.connect(ng); ng.connect(bus); ns.start(next);
        if (s8 === 0 || s8 === 5) tone(60, next, 0.18, 'sine', 0.22, bus); // kick
        next += spb; step++;
      }
    }
    return {
      start() {
        const a = ac();
        bus = a.createGain(); bus.gain.value = 0.9;
        const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
        bus.connect(lp); lp.connect(master);
        next = a.currentTime + 0.05; step = 0;
        clearInterval(timer); timer = setInterval(schedule, 60);
      },
      stop() { clearInterval(timer); timer = null; if (bus) { bus.gain.setTargetAtTime(0, ac().currentTime, 0.1); } },
    };
  })();

  // ── input ────────────────────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (state.panelOpen) closePanel(); else toggleMenu(false); return; }
    if (state.panelOpen || !menu.hidden) return;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'e' || k === ' ' || k === 'enter') useNearby();
    padLight(k, true);
    if (k === 'n') toggleNight();
    if (k === 'm') toggleMusic();
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); padLight(k, false); });
  function useNearby() {
    if (!state.near) return;
    player.path = []; player.dir = state.near.face || player.dir;
    interact(state.near);
  }

  // ── on-screen control pad ────────────────────────────────────────────────
  const PAD_ALIAS = { arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd', ' ': 'e', enter: 'e' };
  function padLight(k, on) {
    document.querySelector(`#pad [data-key="${PAD_ALIAS[k] || k}"]`)?.classList.toggle('pressed', on);
  }
  document.querySelectorAll('#pad [data-key]').forEach(btn => {
    const key = btn.dataset.key;
    const press = e => {
      e.preventDefault();
      if (state.panelOpen) return;
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('pressed');
      if (key === 'e') { useNearby(); return; }
      keys.add(key);
    };
    const release = () => { btn.classList.remove('pressed'); if (key !== 'e') keys.delete(key); };
    btn.addEventListener('pointerdown', press);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, release));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
  window.addEventListener('blur', () => { keys.clear(); document.querySelectorAll('#pad .pressed').forEach(b => b.classList.remove('pressed')); });

  cvs.addEventListener('pointermove', e => {
    if (!state.started || state.panelOpen) return;
    const [x, y] = screenToWorld(e.clientX, e.clientY);
    state.hover = hotspotAt(x, y);
    cvs.classList.toggle('hovering', !!state.hover); // CSS swaps in the bitten-pizza cursor
  });
  cvs.addEventListener('pointerdown', e => {
    if (state.panelOpen) return;
    const [x, y] = screenToWorld(e.clientX, e.clientY);
    const h = hotspotAt(x, y);
    if (h) {
      if (Math.hypot(player.x - h.at[0], player.y - h.at[1]) < 70) { player.dir = h.face; interact(h); }
      else goTo(h);
      return;
    }
    player.pending = null;
    player.path = findPath(player.x, player.y, x, y);
    marker = { x, y, t: 0.6 };
  });
  let marker = null;

  // ── HUD buttons & menu ───────────────────────────────────────────────────
  const menu = document.getElementById('menu');
  function toggleMenu(show = menu.hidden) {
    menu.hidden = !show;
    if (show) menu.querySelector('button')?.focus();
  }
  function buildMenu() {
    const list = menu.querySelector('.menu-list');
    const spots = WD.hotspots.filter(h => h.panel && h.id !== 'exit');
    list.innerHTML = spots.map(h => `<button data-spot="${h.id}"><span>${esc(CONTENT[h.panel].icon || '◆')}</span>${esc(CONTENT[h.panel].title)}</button>`).join('');
    list.addEventListener('click', e => {
      const b = e.target.closest('[data-spot]');
      if (!b) return;
      toggleMenu(false);
      const h = WD.hotspots.find(x => x.id === b.dataset.spot);
      if (e.shiftKey || e.altKey) openPanel(h.panel); else goTo(h);
    });
  }
  document.getElementById('btn-menu').addEventListener('click', () => toggleMenu());
  menu.addEventListener('click', e => { if (e.target === menu || e.target.closest('.close')) toggleMenu(false); });
  document.getElementById('btn-night').addEventListener('click', toggleNight);
  document.getElementById('btn-music').addEventListener('click', toggleMusic);
  document.getElementById('btn-sound').addEventListener('click', e => {
    state.muted = !state.muted;
    e.currentTarget.classList.toggle('on', !state.muted);
    e.currentTarget.textContent = state.muted ? '🔇' : '🔊';
    if (master) master.gain.value = state.muted ? 0 : 0.5;
  });

  // ── boot ─────────────────────────────────────────────────────────────────
  // no intro: drop straight into the room
  function start() {
    state.started = true;
    document.getElementById('hud').classList.add('show');
    setTimeout(() => document.getElementById('hint').classList.add('fade'), 12000);
  }
  // browsers only allow audio after a user gesture
  window.addEventListener('pointerdown', () => { try { ac(); } catch (_) { /* no audio */ } }, { once: true });
  window.addEventListener('keydown', () => { try { ac(); } catch (_) { /* no audio */ } }, { once: true });

  let last = performance.now();
  const SIM_STEPS = +new URLSearchParams(location.search).get('sim') || 1;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = 1; i < SIM_STEPS; i++) update(0.05); // test flag ?sim=N fast-forwards
    update(dt);
    render(dt);
    if (marker) {
      marker.t -= dt;
      ctx.strokeStyle = `rgba(255,236,150,${marker.t / 0.6})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(marker.x, marker.y, 14 * (1.4 - marker.t), 5 * (1.4 - marker.t), 0, 0, 7); ctx.stroke();
      if (marker.t <= 0) marker = null;
    }
    requestAnimationFrame(frame);
  }

  Promise.all([
    new Promise(r => { if (sheet.complete) r(); else sheet.onload = r; }),
    document.fonts ? Promise.race([document.fonts.load(`16px ${PIXEL_FONT}`), new Promise(r => setTimeout(r, 1500))]) : null,
  ]).then(() => {
    resize();
    buildBackground();
    loadGitHub();
    buildMenu();
    updateProgress();
    document.getElementById('profile-name').textContent = CONTENT.profile.name;
    document.getElementById('profile-role').textContent = CONTENT.profile.role;
    const av = document.querySelector('.avatar'), hs = S.hero_idle_down, k = 40 / hs.w;
    av.style.backgroundSize = `${2048 * k}px auto`;
    av.style.backgroundPosition = `${-hs.x * k + 2}px ${-hs.y * k + 4}px`;
    if (isTouch) document.getElementById('hint').textContent = 'Tap the floor to walk · tap objects to interact';
    updateCamera(0);
    requestAnimationFrame(frame);
    start();
    // URL flags (handy for testing / screenshots): ?night ?day ?panel=about ?go=cat ?at=x,y ?debug ?sim=N
    const q = new URLSearchParams(location.search);
    if (q.has('sim')) document.getElementById('hud').style.transition = 'none';
    // start in the mode the clock says (no fade on load); ?night / ?day force it for testing
    const startNight = q.has('night') ? true : q.has('day') ? false : scheduledNight;
    setNight(startNight); state.nightAmt = startNight ? 1 : 0;
    if (!q.has('night') && !q.has('day')) setInterval(followClock, 30 * 1000);
    loadSpotify(); setInterval(loadSpotify, 60 * 1000);
    if (q.get('panel')) openPanel(q.get('panel'));
    if (q.get('arcade')) openArcade(q.get('arcade'));
    if (q.get('go')) setTimeout(() => goTo(WD.hotspots.find(h => h.id === q.get('go'))), 200);
    if (q.get('at')) { const [x, y] = q.get('at').split(',').map(Number); player.x = x; player.y = y; }
  });
  window.addEventListener('resize', resize);
  // expose a tiny API for debugging / screenshots
  window.studio = { state, player, openPanel, toggleNight, start };
})();
