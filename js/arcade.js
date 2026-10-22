// Mini arcade: a game menu with two light games (Space Shooter, Snake), opened from the
// arcade cabinet in the room. Self-contained: own modal, canvas, input and loop.
//   Arcade.open({ beep(freq, dur, type, vol), onClose() })
(() => {
  'use strict';
  const W = 320, H = 240;
  const FONT = '"Silkscreen", "Pixelify Sans", monospace';
  const C = { bg: '#0b0f1e', ink: '#e8edf7', dim: '#7c869c', gold: '#ffd23f', green: '#5ee08a', pink: '#ff5d7a', blue: '#3fc5ff', orange: '#ff6b3d' };

  const modal = document.getElementById('arcade');
  const cvs = document.getElementById('arcade-canvas');
  const ctx = cvs.getContext('2d');
  cvs.width = W; cvs.height = H;
  ctx.imageSmoothingEnabled = false;

  let opts = {}, open = false, raf = 0, last = 0;
  const keys = new Set();
  const pressed = new Set(); // keys pressed this frame (edge-triggered)
  let scene = null;

  // ── high scores (per-browser convenience; works without storage) ─────────
  const STORE = 'pixelstudio.arcade';
  let best = { shooter: 0, snake: 0 };
  try { best = { ...best, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch (_) { /* no storage */ }
  function saveBest(game, score) {
    if (score <= best[game]) return false;
    best[game] = score;
    try { localStorage.setItem(STORE, JSON.stringify(best)); } catch (_) { /* no storage */ }
    return true;
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  const beep = (f, d = 0.06, type = 'square', v = 0.05) => { try { opts.beep && opts.beep(f, d, type, v); } catch (_) { /* no audio */ } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  function text(str, x, y, { size = 8, color = C.ink, align = 'center' } = {}) {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function sprite(rows, x, y, color, px = 2) {
    ctx.fillStyle = color;
    rows.forEach((r, ry) => [...r].forEach((ch, rx) => { if (ch === '#') ctx.fillRect(x + rx * px, y + ry * px, px, px); }));
  }
  const down = k => keys.has(k);
  const tap = k => pressed.has(k);
  const LEFT = () => down('arrowleft') || down('a');
  const RIGHT = () => down('arrowright') || down('d');
  const UP = () => down('arrowup') || down('w');
  const DOWN = () => down('arrowdown') || down('s');
  const FIRE = () => down(' ') || down('enter');
  const OK = () => tap(' ') || tap('enter');

  // background starfield shared by every scene
  const stars = Array.from({ length: 60 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(10, 50), b: Math.random() }));
  function drawStars(dt, speed = 1) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      s.y += s.s * dt * speed;
      if (s.y > H) { s.y = 0; s.x = rnd(0, W); }
      ctx.fillStyle = s.b > 0.7 ? '#ffffff' : s.b > 0.35 ? '#8fa3c8' : '#46557a';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, s.s > 40 ? 2 : 1);
    }
  }

  // ── menu ─────────────────────────────────────────────────────────────────
  const GAMES = [
    { id: 'shooter', name: 'SPACE SHOOTER', tag: 'blast the invaders', make: () => shooter() },
    { id: 'snake', name: 'SNAKE', tag: 'eat, grow, don\'t crash', make: () => snake() },
  ];
  const INVADER = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'];
  function menu(sel = 0) {
    let t = 0;
    return {
      update(dt) {
        t += dt;
        if (tap('arrowup') || tap('w')) { sel = (sel + GAMES.length - 1) % GAMES.length; beep(660); }
        if (tap('arrowdown') || tap('s')) { sel = (sel + 1) % GAMES.length; beep(660); }
        if (OK()) { beep(880, 0.08); beep(1320, 0.12); scene = GAMES[sel].make(); }
      },
      draw(dt) {
        drawStars(dt, 0.4);
        sprite(INVADER, W / 2 - 11, 18 + Math.round(Math.sin(t * 3) * 2), C.pink);
        text('PIXEL ARCADE', W / 2, 52, { size: 16, color: C.gold });
        text('choose a game', W / 2, 70, { color: C.dim });
        GAMES.forEach((g, i) => {
          const y = 102 + i * 40, on = i === sel;
          ctx.fillStyle = on ? '#1d2a4d' : '#121a33';
          ctx.fillRect(56, y - 14, W - 112, 30);
          ctx.strokeStyle = on ? C.gold : '#2c3a66'; ctx.lineWidth = 1;
          ctx.strokeRect(56.5, y - 13.5, W - 113, 29);
          if (on && Math.floor(t * 3) % 2) text('▶', 68, y - 3, { color: C.gold });
          text(g.name, W / 2, y - 4, { size: 8, color: on ? C.ink : C.dim });
          text(`${g.tag} · best ${best[g.id]}`, W / 2, y + 7, { size: 8, color: on ? C.green : '#4c5878' });
          g.box = [56, y - 14, W - 112, 30];
        });
        text('↑↓ choose · SPACE/ENTER play · ESC exit', W / 2, H - 16, { color: C.dim });
      },
      click(x, y) {
        GAMES.forEach((g, i) => {
          const [bx, by, bw, bh] = g.box || [];
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) { sel = i; beep(880, 0.08); scene = g.make(); }
        });
      },
      back() { close(); },
    };
  }

  // shared game-over overlay
  function gameOver(game, score, retry) {
    const isBest = saveBest(game, score);
    beep(330, 0.15, 'square'); beep(220, 0.3, 'square');
    let t = 0;
    return (dt, drawUnder) => {
      t += dt;
      drawUnder(dt);
      ctx.fillStyle = 'rgba(5,8,18,0.72)'; ctx.fillRect(0, 0, W, H);
      text('GAME OVER', W / 2, 88, { size: 16, color: C.pink });
      text(`SCORE ${score}`, W / 2, 114, { color: C.ink });
      text(isBest ? '★ NEW BEST ★' : `BEST ${best[game]}`, W / 2, 128, { color: isBest ? C.gold : C.dim });
      if (Math.floor(t * 2) % 2) text('SPACE retry · ESC menu', W / 2, 156, { color: C.green });
      if (t > 0.4 && OK()) scene = retry();
    };
  }

  // ── SPACE SHOOTER ────────────────────────────────────────────────────────
  const SHIP = ['....#....', '...###...', '...#.#...', '.#######.', '##.###.##', '#..#.#..#'];
  const BUG = ['.#.....#.', '..#...#..', '.#######.', '##.###.##', '#########', '#.#...#.#'];
  const SAUCER = ['...#####...', '.#########.', '##.##.##.##', '.#########.', '..#.....#..'];
  function shooter() {
    const ship = { x: W / 2 - 9, y: H - 26, w: 18, h: 12 };
    let bullets = [], enemies = [], shots = [], boom = [], score = 0, lives = 3, wave = 1;
    let cool = 0, spawnT = 0.6, inv = 0, over = null, t = 0;
    const cols = [C.orange, C.gold, C.blue, C.pink];
    function spawn() {
      const big = Math.random() < 0.12;
      const w = big ? 22 : 18, h = big ? 10 : 12;
      enemies.push({ x: rnd(4, W - w - 4), y: -h, w, h, big, hp: big ? 3 : 1, vy: rnd(18, 30) + wave * 4, phase: rnd(0, 6), amp: big ? 0 : rnd(0, 26), col: cols[Math.floor(rnd(0, cols.length))] });
    }
    function explode(x, y, col) {
      for (let i = 0; i < 12; i++) boom.push({ x, y, vx: rnd(-60, 60), vy: rnd(-60, 60), life: rnd(0.3, 0.6), col });
    }
    function draw(dt) {
      drawStars(dt, 1.4);
      enemies.forEach(e => sprite(e.big ? SAUCER : BUG, Math.round(e.x), Math.round(e.y), e.col, 2));
      ctx.fillStyle = C.ink; bullets.forEach(b => ctx.fillRect(b.x, b.y, 2, 5));
      ctx.fillStyle = C.pink; shots.forEach(b => ctx.fillRect(b.x, b.y, 2, 4));
      boom.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 2, 2); });
      ctx.globalAlpha = 1;
      if (!(inv > 0 && Math.floor(inv * 12) % 2)) sprite(SHIP, Math.round(ship.x), ship.y, C.green, 2);
      text(`SCORE ${score}`, 8, 10, { align: 'left' });
      text(`WAVE ${wave}`, W / 2, 10, { color: C.dim });
      for (let i = 0; i < lives; i++) sprite(['.#.', '###', '#.#'], W - 14 - i * 10, 6, C.green, 2);
    }
    return {
      update(dt) {
        t += dt;
        if (over) return;
        if (LEFT()) ship.x -= 150 * dt;
        if (RIGHT()) ship.x += 150 * dt;
        ship.x = Math.max(2, Math.min(W - ship.w - 2, ship.x));
        cool -= dt; inv -= dt;
        if (FIRE() && cool <= 0) { bullets.push({ x: ship.x + ship.w / 2 - 1, y: ship.y - 4 }); cool = 0.22; beep(1200, 0.03, 'square', 0.025); }
        spawnT -= dt;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(0.28, 1.1 - wave * 0.09) * rnd(0.6, 1.2); }
        wave = 1 + Math.floor(score / 150);
        bullets.forEach(b => { b.y -= 260 * dt; });
        shots.forEach(b => { b.y += 120 * dt; });
        enemies.forEach(e => {
          e.y += e.vy * dt;
          e.x += Math.cos(t * 2 + e.phase) * e.amp * dt;
          e.x = Math.max(2, Math.min(W - e.w - 2, e.x));
          if (Math.random() < dt * (0.15 + wave * 0.04) && e.y > 10 && e.y < H / 2) shots.push({ x: e.x + e.w / 2, y: e.y + e.h });
        });
        // collisions
        for (const b of bullets) for (const e of enemies) {
          if (!b.dead && !e.dead && hit({ x: b.x, y: b.y, w: 2, h: 5 }, e)) {
            b.dead = true; e.hp--;
            if (e.hp <= 0) { e.dead = true; score += e.big ? 50 : 10; explode(e.x + e.w / 2, e.y + e.h / 2, e.col); beep(180, 0.12, 'sawtooth', 0.05); }
            else beep(500, 0.03);
          }
        }
        const hurt = () => {
          if (inv > 0) return;
          lives--; inv = 1.6; explode(ship.x + ship.w / 2, ship.y + 6, C.green); beep(120, 0.3, 'sawtooth', 0.07);
          if (lives <= 0) over = gameOver('shooter', score, shooter);
        };
        for (const e of enemies) {
          if (!e.dead && hit(e, ship)) { e.dead = true; hurt(); }
          if (!e.dead && e.y > H) { e.dead = true; }
        }
        for (const s of shots) if (!s.dead && hit({ x: s.x, y: s.y, w: 2, h: 4 }, ship)) { s.dead = true; hurt(); }
        boom.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
        bullets = bullets.filter(b => !b.dead && b.y > -6);
        shots = shots.filter(s => !s.dead && s.y < H);
        enemies = enemies.filter(e => !e.dead);
        boom = boom.filter(p => p.life > 0);
      },
      draw(dt) {
        if (over) over(dt, () => draw(0));
        else draw(dt);
        if (!over && t < 2.2) text('← → move · SPACE fire', W / 2, H / 2, { color: C.gold });
      },
      back() { scene = menu(0); },
    };
  }

  // ── SNAKE ────────────────────────────────────────────────────────────────
  function snake() {
    const CELL = 10, GX = W / CELL, GY = (H - 20) / CELL, OY = 20;
    let body = [{ x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }];
    let dir = { x: 1, y: 0 }, queue = [], food = null, score = 0, step = 0.12, acc = 0, over = null, t = 0, pulse = 0;
    function placeFood() {
      do { food = { x: Math.floor(rnd(0, GX)), y: Math.floor(rnd(0, GY)) }; }
      while (body.some(s => s.x === food.x && s.y === food.y));
    }
    placeFood();
    function turn(x, y) {
      const lastDir = queue.length ? queue[queue.length - 1] : dir;
      if (lastDir.x === -x && lastDir.y === -y) return; // no reversing into yourself
      if (lastDir.x === x && lastDir.y === y) return;
      if (queue.length < 3) queue.push({ x, y });
    }
    function draw() {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      // board with a faint checker
      for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#0f1630' : '#111a38';
        ctx.fillRect(x * CELL, OY + y * CELL, CELL, CELL);
      }
      ctx.strokeStyle = '#2c3a66'; ctx.strokeRect(0.5, OY + 0.5, W - 1, H - OY - 1);
      // food: a little pixel apple
      const fx = food.x * CELL, fy = OY + food.y * CELL, p = Math.sin(pulse * 6) > 0 ? 1 : 0;
      ctx.fillStyle = C.pink; ctx.fillRect(fx + 1 - p, fy + 2 - p, 8 + p * 2, 7 + p * 2);
      ctx.fillStyle = C.green; ctx.fillRect(fx + 4, fy, 2, 2);
      // snake
      body.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#9cf5b5' : i % 2 ? C.green : '#3fbf6c';
        ctx.fillRect(s.x * CELL + 1, OY + s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      const h = body[0];
      ctx.fillStyle = '#0b0f1e';
      const ex = dir.x ? (dir.x > 0 ? 6 : 2) : 2, ey = dir.y ? (dir.y > 0 ? 6 : 2) : 2;
      ctx.fillRect(h.x * CELL + ex, OY + h.y * CELL + ey, 2, 2);
      ctx.fillRect(h.x * CELL + (dir.x ? ex : 6), OY + h.y * CELL + (dir.y ? ey : 6), 2, 2);
      text(`SCORE ${score}`, 8, 10, { align: 'left' });
      text(`BEST ${best.snake}`, W - 8, 10, { align: 'right', color: C.dim });
    }
    return {
      update(dt) {
        t += dt; pulse += dt;
        if (over) return;
        if (tap('arrowleft') || tap('a')) turn(-1, 0);
        if (tap('arrowright') || tap('d')) turn(1, 0);
        if (tap('arrowup') || tap('w')) turn(0, -1);
        if (tap('arrowdown') || tap('s')) turn(0, 1);
        acc += dt;
        while (acc >= step && !over) {
          acc -= step;
          if (queue.length) dir = queue.shift();
          const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
          const dead = head.x < 0 || head.y < 0 || head.x >= GX || head.y >= GY || body.some((s, i) => i < body.length - 1 && s.x === head.x && s.y === head.y);
          if (dead) { over = gameOver('snake', score, snake); return; }
          body.unshift(head);
          if (head.x === food.x && head.y === food.y) {
            score += 10; beep(880, 0.05); beep(1320, 0.06);
            step = Math.max(0.06, step - 0.003);
            placeFood();
          } else body.pop();
        }
      },
      draw(dt) {
        if (over) over(dt, draw);
        else draw();
        if (!over && t < 2.2) text('arrows / WASD to steer', W / 2, H / 2 + 30, { color: C.gold });
      },
      back() { scene = menu(1); },
    };
  }

  // ── loop & input ─────────────────────────────────────────────────────────
  function frame(now) {
    if (!open) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scene.update(dt);
    scene.draw(dt);
    pressed.clear();
    raf = requestAnimationFrame(frame);
  }
  const GAME_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'enter'];
  // capture phase on window so the room's own key handling never sees arcade input
  window.addEventListener('keydown', e => {
    if (!open) return;
    const k = e.key.toLowerCase();
    e.stopImmediatePropagation();
    if (GAME_KEYS.includes(k)) e.preventDefault();
    if (k === 'escape') { scene.back(); return; }
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  }, true);
  window.addEventListener('keyup', e => {
    if (!open) return;
    e.stopImmediatePropagation();
    keys.delete(e.key.toLowerCase());
  }, true);
  window.addEventListener('blur', () => keys.clear());

  cvs.addEventListener('pointerdown', e => {
    const r = cvs.getBoundingClientRect();
    scene.click && scene.click((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
  });
  // on-screen buttons (touch / mouse): hold = key down
  modal.querySelectorAll('[data-akey]').forEach(btn => {
    const k = btn.dataset.akey;
    const press = e => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); btn.classList.add('pressed'); if (!keys.has(k)) pressed.add(k); keys.add(k); };
    const release = () => { btn.classList.remove('pressed'); keys.delete(k); };
    btn.addEventListener('pointerdown', press);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, release));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
  modal.querySelector('[data-aback]').addEventListener('click', () => scene.back());
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.close')) close(); });

  function close() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    keys.clear(); pressed.clear();
    modal.hidden = true;
    opts.onClose && opts.onClose();
  }
  window.Arcade = {
    open(o = {}) {
      opts = o;
      open = true;
      keys.clear(); pressed.clear();
      const g = GAMES.find(x => x.id === o.start);
      scene = g ? g.make() : menu(0);
      modal.hidden = false;
      cvs.focus({ preventScroll: true });
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    close,
    get isOpen() { return open; },
  };
})();
