// Footer Polaroid camera (normal mode only). Visitors add a photo, their name and a
// thought; the red shutter button flashes and a card prints out of the slot, styled
// like a receipt with holographic stickers. The card is drawn on a <canvas>, so the
// preview and the saved PNG are the same image. The photo never leaves the browser.
(() => {
  'use strict';
  const stage = document.getElementById('pol-stage');
  if (!stage) return;
  const $ = id => document.getElementById(id);
  const fileIn = $('pol-file');
  // fixed card text (visitors only add a photo); edit freely
  const CARD_TEXT = { thought: 'Thanks for dropping by my studio.' };
  const pickBtn = $('pol-pick'), thumb = $('pol-thumb'), actions = document.querySelector('.pol-actions');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  // ── the camera (front of a white Polaroid Now+) ─────────────────────────
  const LENS = `
    <svg class="pc pc-lens" viewBox="-70 -70 140 140" aria-hidden="true">
      <defs>
        <radialGradient id="pl-white" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".85" stop-color="#f6f6f6"/><stop offset="1" stop-color="#e2e2e2"/></radialGradient>
        <radialGradient id="pl-black" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#2b2b2b"/><stop offset="1" stop-color="#0e0e0e"/></radialGradient>
        <radialGradient id="pl-glass" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#2d6aa8"/><stop offset=".45" stop-color="#143258"/><stop offset="1" stop-color="#03070f"/></radialGradient>
        <path id="pl-ring" d="M0,47 a47,47 0 1,1 0,-94 a47,47 0 1,1 0,94"/>
        <path id="pl-ring-b" d="M-53,0 a53,53 0 0,0 106,0"/>
      </defs>
      <circle r="69" fill="url(#pl-white)" stroke="#e0e0e0" stroke-width=".8"/>
      <circle r="62.5" fill="rgba(0,0,0,.18)"/>
      <circle r="61" fill="url(#pl-black)"/>
      <g fill="#bdbdbd" font-family="Nunito, sans-serif" font-weight="800" font-size="6.2" letter-spacing="1.3" text-anchor="middle">
        <text><textPath href="#pl-ring" startOffset="25%">35-40mm 1:11</textPath></text>
        <text><textPath href="#pl-ring" startOffset="50%">POLAROID</textPath></text>
        <text><textPath href="#pl-ring" startOffset="75%">AUTOFOCUS</textPath></text>
        <text><textPath href="#pl-ring-b" startOffset="50%">FILTER SENSOR</textPath></text>
      </g>
      <circle r="41" fill="#0b0b0b"/>
      <g fill="none" stroke="#262626" stroke-width=".9"><circle r="39"/><circle r="36.5"/><circle r="34"/></g>
      <circle r="31" fill="url(#pl-glass)"/>
      <path d="M-22,-14 A26,26 0 0,1 4,-26" stroke="rgba(150,220,255,.55)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M14,18 A22,22 0 0,0 24,4" stroke="rgba(190,140,255,.35)" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="-9" cy="-11" r="3.2" fill="rgba(255,255,255,.55)"/>
      <circle cy="57.5" r="5.2" fill="#1b1b1b" stroke="#3c3c3c" stroke-width=".8"/>
      <circle cy="57.5" r="2.2" fill="#050505"/><circle cx="-.8" cy="56.6" r=".7" fill="#9a9a9a"/>
    </svg>`;
  const VIEWFINDER = `
    <svg class="pc pc-vf" viewBox="0 0 67 64" aria-hidden="true">
      <defs><radialGradient id="pl-vf" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".6" stop-color="#121212"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>
      <rect width="67" height="64" rx="14" fill="#151515"/>
      <rect x="5" y="5" width="57" height="54" rx="10" fill="url(#pl-vf)"/>
      <rect x="10" y="11" width="47" height="42" rx="9" fill="none" stroke="#3a3a3a" stroke-width="1.2"/>
      <path d="M24 13 h12 v6 h-12z" fill="#e8e8e8" opacity=".85"/>
      <path d="M18 24 q16 -6 30 2 l-4 22 q-12 4 -22 0z" fill="#2a2a2a"/>
      <path d="M21 27 q12 -4 22 1" stroke="#7a7a7a" stroke-width="1" fill="none"/>
    </svg>`;
  stage.innerHTML = `
    <div class="pcam-scale">
      <div class="pcam" id="pcam">
        <div class="pcam-body">
          <div class="pc pc-shadow" aria-hidden="true"></div>
          <div class="pc pc-hump" aria-hidden="true"></div>
          <div class="pc pc-upper" aria-hidden="true"></div>
          <div class="pc pc-base" aria-hidden="true"></div>
          <div class="pc pc-band" aria-hidden="true"></div>
          <div class="pc pc-rainbow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="pc pc-flash" aria-hidden="true"><div class="pc-fresnel"></div></div>
          ${LENS}${VIEWFINDER}
          <div class="pc pc-sensor" aria-hidden="true"><i></i><i></i><i></i></div>
          <button class="pc pc-plus" type="button" aria-label="Add a photo">+</button>
          <button class="pc pc-shutter" type="button" aria-label="Take the polaroid"></button>
          <span class="pc pc-word brand" aria-hidden="true">polaroid</span>
          <span class="pc pc-word model" aria-hidden="true">NOW+</span>
          <span class="pc pc-film" aria-hidden="true">i-Type film</span>
          <div class="pc pc-slot-rim" aria-hidden="true"></div>
          <div class="pc pc-slot" aria-hidden="true"></div>
          <div class="pc pc-out" aria-live="polite"></div>
        </div>
      </div>
    </div>`;
  const cam = $('pcam'), body = cam.querySelector('.pcam-body'), out = cam.querySelector('.pc-out');
  const scaleBox = stage.querySelector('.pcam-scale');
  const flashFx = Object.assign(document.createElement('div'), { className: 'pol-flashfx' });
  document.body.appendChild(flashFx);

  // ── photo input ────────────────────────────────────────────────────────
  let photo = null;
  const pick = () => fileIn.click();
  pickBtn.addEventListener('click', pick);
  cam.querySelector('.pc-plus').addEventListener('click', pick);
  fileIn.addEventListener('change', () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { photo = img; thumb.src = url; thumb.hidden = false; pickBtn.textContent = '↻ Change photo'; };
    img.src = url;
  });

  // ── card drawing (2× pixels; shown at 300px wide) ───────────────────────
  const INK = '#2b2b2b', PEN = '#3557b0';
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const HAND = 'Caveat, "Comic Sans MS", cursive';
  const CW = 520, MX = 40;               // card width, side margin for stickers

  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (let w of words) {
      while (ctx.measureText(w).width > maxW) {          // break very long words
        let i = w.length; while (i > 1 && ctx.measureText(w.slice(0, i)).width > maxW) i--;
        if (line) { lines.push(line); line = ''; }
        lines.push(w.slice(0, i)); w = w.slice(i);
      }
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function photoCanvas(img, w, h) {
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d');
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const d = x.getImageData(0, 0, w, h), p = d.data;
    for (let i = 0; i < p.length; i += 4) {               // photocopy look: grey, contrast, grain
      let g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
      g = (g - 128) * 1.18 + 132 + (Math.random() - 0.5) * 18;
      p[i] = p[i + 1] = p[i + 2] = Math.max(0, Math.min(255, g));
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  function holo(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    ['#ffd3ef', '#cdb8ff', '#a6e4ff', '#b8ffd8', '#fff1b0', '#ffc3d8', '#c7c9ff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    return g;
  }
  function sticker(ctx, path, cx, cy, size, rot) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    path(ctx, size); ctx.fillStyle = holo(ctx, -size, -size, size, size); ctx.fill();
    ctx.shadowColor = 'transparent';
    const gl = ctx.createLinearGradient(-size, -size, size * .3, size * .3);             // glare
    gl.addColorStop(0, 'rgba(255,255,255,.75)'); gl.addColorStop(.45, 'rgba(255,255,255,0)');
    path(ctx, size); ctx.fillStyle = gl; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,120,140,.35)'; path(ctx, size); ctx.stroke();
    ctx.restore();
  }
  const starPath = (ctx, r, inner = 0.48) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * inner : r;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  };
  const heartPath = (ctx, r) => {
    ctx.beginPath(); ctx.moveTo(0, r * .9);
    ctx.bezierCurveTo(-r * 1.3, r * .1, -r * .9, -r * 1.05, 0, -r * .35);
    ctx.bezierCurveTo(r * .9, -r * 1.05, r * 1.3, r * .1, 0, r * .9); ctx.closePath();
  };
  const circlePath = (ctx, r) => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); };

  function drawCard(ctx, ox, oy, d) {
    // layout pass (needs fonts set to measure)
    ctx.font = `500 27px ${MONO}`;
    const thought = wrap(ctx, `“${d.thought}”`, CW - 100);
    const L = {};
    L.photo = 56; L.dash1 = L.photo + 330 + 62;
    L.t0 = L.dash1 + 50; L.dash2 = L.t0 + (thought.length - 1) * 40 + 50;
    L.row = L.dash2 + 74; L.thanks = L.row + 96; L.icon = L.thanks + 62; L.end = L.icon + 74;
    const H = L.end;
    const X = ox + MX, Y = oy;

    // paper
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(X, Y, CW, H);     // clean white receipt paper
    ctx.restore();
    for (let i = 0; i < 1200; i++) {                          // very faint paper grain
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
      ctx.fillRect(X + Math.random() * CW, Y + Math.random() * H, 1.4, 1.4);
    }

    // photo
    const pw = 300, ph = 330;
    if (d.photo) ctx.drawImage(photoCanvas(d.photo, pw, ph), X + (CW - pw) / 2, Y + L.photo);

    // text
    ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic';
    const center = (t, y, font) => { ctx.font = font; ctx.textAlign = 'center'; ctx.fillText(t, X + CW / 2, Y + y); };
    ctx.font = `500 27px ${MONO}`; ctx.textAlign = 'left';
    const dash = n => '-'.repeat(n);
    const dw = ctx.measureText('-').width;
    ctx.fillText(dash(Math.floor((CW - 70) / dw)), X + 35, Y + L.dash1);
    thought.forEach((t, i) => ctx.fillText(t, X + 50, Y + L.t0 + i * 40));
    ctx.fillText(dash(Math.floor((CW - 70) * 0.72 / dw)), X + 35, Y + L.dash2);

    // circled line + "omg!" + arrow, in blue pen
    ctx.font = `600 28px ${MONO}`; ctx.textAlign = 'left';
    const label = 'STUDIO VISITS', lw = ctx.measureText(label).width, lx = X + 52, ry = Y + L.row;
    ctx.fillText(label, lx, ry);
    ctx.textAlign = 'right'; ctx.fillText(`... ${d.visits}`, X + CW - 40, ry);
    ctx.strokeStyle = PEN; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const ecx = lx + lw / 2, ecy = ry - 9;
    for (const [dx, dy, rx, ryy, rot] of [[0, 0, lw / 2 + 22, 30, -0.03], [3, 2, lw / 2 + 26, 33, 0.02]]) {
      ctx.beginPath(); ctx.ellipse(ecx + dx, ecy + dy, rx, ryy, rot, 0.15, Math.PI * 2 + 0.35); ctx.stroke();
    }
    ctx.save(); ctx.translate(lx + lw + 6, ry - 52); ctx.rotate(-0.16);
    ctx.font = `600 38px ${HAND}`; ctx.fillStyle = PEN; ctx.textAlign = 'left'; ctx.fillText('omg!', 0, 0);
    ctx.restore();
    // arrow: from the circle, curving down past the right end of THANK YOU
    const ax = ecx + lw / 2 + 10, ay = ecy + 28, qx = ax + 84, qy = ay + 8;
    const ex = X + CW / 2 + 120, ey = Y + L.thanks - 6;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.stroke();
    const ang = Math.atan2(ey - qy, ex - qx);
    ctx.beginPath();
    ctx.moveTo(ex - 16 * Math.cos(ang - 0.5), ey - 16 * Math.sin(ang - 0.5)); ctx.lineTo(ex, ey);
    ctx.lineTo(ex - 16 * Math.cos(ang + 0.5), ey - 16 * Math.sin(ang + 0.5)); ctx.stroke();

    ctx.fillStyle = INK;
    center('THANK YOU', L.thanks, `500 30px ${MONO}`);
    // small camera glyph
    const gx = X + CW / 2, gy = Y + L.icon;
    ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.roundRect(gx - 22, gy - 18, 44, 36, 9); ctx.stroke();
    ctx.beginPath(); ctx.arc(gx, gy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(gx + 13, gy - 10, 2.2, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();

    // stickers
    sticker(ctx, (c, r) => starPath(c, r), X + 34, Y + 58, 42, -0.25);
    ctx.save(); ctx.translate(X + 104, Y + 112); ctx.rotate(0.2);               // doodled star
    ctx.strokeStyle = PEN; ctx.lineWidth = 2.4; starPath(ctx, 17, 0.42); ctx.stroke(); ctx.restore();
    sticker(ctx, heartPath, X + CW - 8, Y + L.dash1 + 92, 34, 0.25);
    sticker(ctx, (c, r) => circlePath(c, r), X + CW - 70, Y + H - 66, 42, 0);
    ctx.save(); ctx.translate(X + CW - 70, Y + H - 66);                          // smiley face
    ctx.strokeStyle = '#3d3d55'; ctx.fillStyle = '#3d3d55'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-12, -8, 4, 0, Math.PI * 2); ctx.arc(12, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 2, 20, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    ctx.restore();
    return H;
  }

  function cardData() {
    let visits = 1;
    try { visits = (+localStorage.getItem('devstudio.polaroids') || 0) + 1; localStorage.setItem('devstudio.polaroids', visits); } catch (_) { /* private mode */ }
    return {
      photo, visits,
      thought: CARD_TEXT.thought,
    };
  }

  async function render(d) {
    await Promise.all([`600 34px ${MONO}`, `500 27px ${MONO}`, `600 38px ${HAND}`].map(f => document.fonts.load(f).catch(() => {})));
    const probe = document.createElement('canvas').getContext('2d');
    const H = drawCard(probe, 0, 0, d);                         // measure height
    const c = Object.assign(document.createElement('canvas'), { width: CW + MX * 2, height: H + 40 });
    drawCard(c.getContext('2d'), 0, 0, d);
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', `Your polaroid card: ${d.thought}`);
    return c;
  }

  // ── sound ──────────────────────────────────────────────────────────────
  let AC = null;
  const ac = () => { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; };
  function noise(dur, freq, vol, type = 'bandpass') {
    const a = ac(), len = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), x = buf.getChannelData(0);
    for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  function motor(dur) {
    const a = ac(), o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    o.type = 'sawtooth'; o.frequency.value = 95; f.type = 'lowpass'; f.frequency.value = 600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.08); g.gain.setValueAtTime(0.05, t + dur - 0.15); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur);
  }

  // ── shooting ───────────────────────────────────────────────────────────
  let busy = false, current = null;
  const scale = () => parseFloat(getComputedStyle(scaleBox).getPropertyValue('--s')) || 1;
  function fit(cardH) {                    // make room below the camera for the card
    out.style.height = cardH ? `${cardH}px` : '0px';
    scaleBox.style.height = `${(cardH ? Math.max(430, 356 + cardH) : 430) * scale()}px`;
  }
  // the 3D view (js/polaroid3d.js) can take over flash / eject / clear; otherwise the CSS camera does it
  const api = window.PolaroidCam = { view: null };
  async function clearCard() {
    if (!current) return;
    if (api.view) { await api.view.clear(); current = null; actions.hidden = true; return; }
    current.style.transition = 'transform .45s ease-in, opacity .45s';
    current.style.transform = 'translateY(30px)'; current.style.opacity = '0';
    await wait(450);
    out.innerHTML = ''; out.className = 'pc pc-out'; current = null; fit(0);
    actions.hidden = true;
  }
  async function shoot() {
    if (busy) return;
    if (peeled) await closePeel();
    if (!photo) {
      const row = pickBtn.parentElement;
      row.classList.remove('nudge'); void row.offsetWidth; row.classList.add('nudge');
      pickBtn.focus();
      return;
    }
    busy = true;
    try { noise(0.08, 3500, 0.25, 'highpass'); } catch (_) { /* no audio */ }
    cam.classList.add('firing', 'flashing');
    if (api.view) api.view.flash();
    if (!reduce) { flashFx.classList.remove('on'); void flashFx.offsetWidth; flashFx.classList.add('on'); }
    await clearCard();
    const card = await render(cardData());
    cam.classList.remove('flashing');
    current = card;
    try { motor(2.5); } catch (_) { /* no audio */ }
    if (api.view) {
      await api.view.eject(card);
    } else {
      out.appendChild(card);
      fit(card.height * (300 / card.width));
      void card.offsetHeight;
      out.classList.add('ejecting');
      await wait(2700);
      out.classList.add('done');
    }
    cam.classList.remove('firing');
    actions.hidden = false;
    busy = false;
  }

  // ── peel: tear the card off the camera; it flies to the centre with a download option ──
  // Smoothness: the drawn card <canvas> itself is moved into the popup (no PNG encoding),
  // only transform/opacity are animated (Web Animations API → compositor thread),
  // the backdrop is a plain fading layer (no blur), and the 3D scene pauses while open.
  const peelBox = Object.assign(document.createElement('div'), { className: 'pol-peel', hidden: true });
  peelBox.innerHTML = `
    <div class="pol-peel-bg"></div>
    <div class="pol-peel-card" role="dialog" aria-modal="true" aria-label="Your polaroid card">
      <div class="pol-peel-photo"></div>
      <div class="pol-peel-actions">
        <button type="button" class="pixel-btn hot" data-peel="save">⤓ Download</button>
        <button type="button" class="pixel-btn" data-peel="close">✕ Close</button>
      </div>
    </div>`;
  document.body.appendChild(peelBox);
  const peelBg = peelBox.querySelector('.pol-peel-bg'), peelPhoto = peelBox.querySelector('.pol-peel-photo');
  const peelActions = peelBox.querySelector('.pol-peel-actions');
  let peeled = false;
  const anim = (el, frames, opts) => (reduce ? null : el.animate(frames, { fill: 'both', ...opts }));
  async function peel() {
    if (!current || busy || peeled) return;
    busy = true; peeled = true;
    try { noise(0.35, 1700, 0.18); } catch (_) { /* no audio */ }
    // where the card sits on screen right now (3D view or CSS camera)
    const from = api.view ? api.view.cardRect() : current.getBoundingClientRect();
    current.style.transform = ''; current.style.transition = '';
    peelPhoto.appendChild(current);                             // same canvas, no re-encode
    peelBox.hidden = false;
    // FLIP: measure the final spot once, then start the card on top of where it was torn off
    const end = peelPhoto.getBoundingClientRect();
    const s = from.width / end.width;
    const dx = from.left + from.width / 2 - (end.left + end.width / 2);
    const dy = from.top + from.height / 2 - (end.top + end.height / 2);
    if (api.view) { api.view.peel(); api.view.pause(); } else { out.innerHTML = ''; fit(0); }
    anim(peelBg, [{ opacity: 0 }, { opacity: 1 }], { duration: 650, easing: 'ease-out' });
    const fly = anim(peelPhoto, [
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${s}) rotate(0deg)` },
      { transform: 'translate3d(0, -6px, 0) scale(1.03) rotate(-3deg)', offset: 0.72 },
      { transform: 'translate3d(0, 0, 0) scale(1) rotate(-1deg)' },
    ], { duration: 1400, easing: 'cubic-bezier(.22, .8, .24, 1)' });   // popup open: 1.4s
    anim(peelActions, [{ opacity: 0, transform: 'translate3d(0, 10px, 0)' }, { opacity: 1, transform: 'none' }],
      { duration: 440, delay: 960, easing: 'ease-out' });
    actions.hidden = true;
    if (fly) await fly.finished.catch(() => {});
    busy = false;
    peelBox.querySelector('[data-peel="save"]').focus({ preventScroll: true });
  }
  async function closePeel() {
    if (peelBox.hidden || closing) return;
    closing = true;
    const bye = anim(peelPhoto, [{ opacity: 1, transform: 'rotate(-1deg)' }, { opacity: 0, transform: 'translate3d(0, 24px, 0) scale(.96) rotate(-1deg)' }],
      { duration: 240, easing: 'ease-in' });
    anim(peelActions, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 });
    anim(peelBg, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-in' });
    if (api.view) api.view.resume();                          // camera comes back to life behind the fade
    if (bye) await bye.finished.catch(() => {});
    peelBox.hidden = true;
    peelPhoto.replaceChildren();
    peelBox.getAnimations({ subtree: true }).forEach(a => a.cancel());
    current = null; peeled = false; closing = false;
    if (api.view) api.view.reset();
    pickBtn.focus({ preventScroll: true });
  }
  let closing = false;
  peelBox.addEventListener('click', e => {
    const b = e.target.closest('[data-peel]');
    if (b?.dataset.peel === 'save') saveCard();
    else if (b?.dataset.peel === 'close' || e.target === peelBox) closePeel();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closePeel(); });
  api.peel = peel;
  // CSS fallback camera: pull the card down to tear it off
  let fb = null;
  out.addEventListener('pointerdown', e => {
    if (!current || busy || api.view) return;
    fb = { y: e.clientY }; try { out.setPointerCapture(e.pointerId); } catch (_) { /* synthetic event */ } e.preventDefault();
  });
  out.addEventListener('pointermove', e => {
    if (!fb) return;
    const dy = Math.max(0, e.clientY - fb.y);
    current.style.transform = `translateY(${Math.min(dy, 90) * 0.5}px) rotate(${Math.min(dy, 90) * 0.03}deg)`;
    if (dy > 90) { fb = null; current.style.transform = ''; peel(); }
  });
  const fbUp = () => { if (fb && current) { current.style.transition = 'transform .3s'; current.style.transform = ''; setTimeout(() => { if (current) current.style.transition = ''; }, 300); } fb = null; };
  out.addEventListener('pointerup', fbUp);
  out.addEventListener('pointercancel', fbUp);
  cam.querySelector('.pc-shutter').addEventListener('click', shoot);
  api.shoot = shoot;
  api.pick = pick;

  // ── save / again ───────────────────────────────────────────────────────
  function saveCard() {
    if (!current) return;
    const pad = 60, c = Object.assign(document.createElement('canvas'), { width: current.width + pad * 2, height: current.height + pad * 2 });
    const x = c.getContext('2d');
    const bg = x.createRadialGradient(c.width / 2, c.height / 2, 50, c.width / 2, c.height / 2, c.height * .7);
    bg.addColorStop(0, '#e9e9e7'); bg.addColorStop(1, '#cfcfcc');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(current, pad, pad);
    c.toBlob(b => {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(b), download: `polaroid-${new Date().toISOString().slice(0, 10)}.png` });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }




  // test hook: ?polaroid=demo fills the form with a sample photo and shoots
  if (new URLSearchParams(location.search).get('polaroid') === 'demo') {
    const img = new Image();
    img.onload = () => { photo = img; setTimeout(shoot, 2500); };
    img.src = 'assets/media/dev-avatar.webp';
  }
})();
