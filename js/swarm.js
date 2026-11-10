// Normal mode: a small crew of named, multiplayer-style cursors builds each section as
// it scrolls into view. One cursor types the section label, the others drag out a
// selection box (with a live W × H badge) over each block, and the block appears.
// Each section builds once. Visitors who prefer reduced motion get the plain page.
// Our own take on the idea behind Joel Califa's "Swarm"; no code is taken from it.
(() => {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const sections = [...document.querySelectorAll('main .hero.reveal, main section.reveal')];
  if (!sections.length) return;
  document.documentElement.classList.add('swarm');

  const CREW = [['Mira', '#ff6b4a'], ['Kai', '#4dabf7'], ['Juno', '#40c057'], ['Ravi', '#cc5de8'],
    ['Noor', '#f59f00'], ['Leo', '#15aabf'], ['Tara', '#f06595']];
  const MAX_TARGETS = 14;   // blocks drawn one by one; any beyond this appear at the end
  const SAFETY_MS = 9000;   // a section is shown in full after this, whatever happens

  const layer = document.createElement('div');
  layer.className = 'sw-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sound = name => window.NormalSounds?.play(name);   // js/sounds.js
  const box = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  };
  const tween = (ms, fn) => new Promise(done => {
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });

  let crewAt = 0;
  function cursor([name, color], x, y) {
    const el = document.createElement('div');
    el.className = 'sw-cur';
    el.style.setProperty('--c', color);
    el.innerHTML = `<svg width="18" height="20" viewBox="0 0 18 20"><path d="M1 1 L1 16 L5 12.5 L8 19 L10.5 18 L7.6 11.6 L13 11.4 Z"/></svg><span>${name}</span>`;
    layer.append(el);
    const c = {
      el, color, x, y,
      set(nx, ny) { c.x = nx; c.y = ny; el.style.transform = `translate(${nx}px, ${ny}px)`; },
      move(tx, ty) {
        const sx = c.x, sy = c.y;
        const ms = Math.min(650, 220 + Math.hypot(tx - sx, ty - sy) * 0.45);
        return tween(ms, t => c.set(sx + (tx - sx) * t, sy + (ty - sy) * t));
      },
    };
    c.set(x, y);
    return c;
  }

  // drag out a selection over the block, then let it appear
  async function draw(c, el) {
    const b = box(el);
    await c.move(b.x, b.y);
    c.el.classList.add('down');
    sound('press');
    const sel = document.createElement('div');
    sel.className = 'sw-sel';
    sel.style.setProperty('--c', c.color);
    sel.style.transform = `translate(${b.x}px, ${b.y}px)`;
    const badge = document.createElement('i');
    sel.append(badge);
    layer.append(sel);
    await tween(Math.min(520, 260 + (b.w + b.h) * 0.25), t => {
      const w = b.w * t, h = b.h * t;
      sel.style.width = `${w}px`;
      sel.style.height = `${h}px`;
      badge.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      c.set(b.x + w, b.y + h);
    });
    c.el.classList.remove('down');
    sound('release');
    el.classList.add('sw-on');
    sel.classList.add('done');
    setTimeout(() => sel.remove(), 500);
  }

  // click into the label and type it out
  async function type(c, el) {
    const text = el.textContent, html = el.innerHTML;   // keep any markup (the hero's heading lines)
    const b = box(el);
    await c.move(b.x, b.y + b.h / 2);
    sound('press');
    el.style.minHeight = `${b.h}px`;   // keep the line's height while it's empty
    const txt = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'sw-caret';
    el.textContent = '';
    el.append(txt, caret);
    el.classList.add('sw-on');
    sound('release');
    for (const ch of text) {
      txt.data += ch;
      if (ch !== ' ') sound('tick');
      const r = caret.getBoundingClientRect();
      c.set(r.right + scrollX + 3, r.top + scrollY + r.height * 0.7);
      await sleep(45);
    }
    await sleep(250);
    el.innerHTML = html;
    el.style.minHeight = '';
  }

  // the blocks to draw: a grid or row is drawn item by item, anything else as one block
  function targets(sec) {
    const out = [];
    for (const ch of sec.children) {
      if (ch.matches('.label, h1')) continue;
      const kids = [...ch.children];
      if (kids.length >= 2 && kids.length <= 12 && /grid|flex/.test(getComputedStyle(ch).display)) out.push(...kids);
      else out.push(ch);
    }
    return out.filter(el => el.getBoundingClientRect().height > 0);
  }

  async function build(sec) {
    // the hero is on screen while the page is still loading; give it a moment so the cursors
    // move smoothly, but never hold the page blank for long on a slow connection
    if (document.readyState !== 'complete') await Promise.race([new Promise(r => addEventListener('load', r, { once: true })), sleep(1500)]);
    await sleep(150);
    const label = sec.querySelector(':scope > .label, :scope > h1');   // the line that gets typed
    const list = targets(sec);
    const queue = list.slice(0, MAX_TARGETS);
    [label, ...list].forEach(el => el?.classList.add('sw-t'));
    sec.classList.add('sw-go');
    const finish = () => {
      list.forEach(el => el.classList.add('sw-on'));
      label?.classList.add('sw-on');
      sec.classList.add('built');
    };
    const safety = setTimeout(finish, SAFETY_MS);

    const b = box(sec);
    const count = Math.max(1, Math.min(innerWidth < 600 ? 2 : 3, queue.length));
    const crew = Array.from({ length: count }, (_, i) => {
      const fromLeft = (crewAt + i) % 2 === 0;
      const x = scrollX + (fromLeft ? -30 : innerWidth + 10);
      return cursor(CREW[(crewAt + i) % CREW.length], x, b.y + Math.random() * 160 - 60);
    });
    crewAt += count;

    try {
      await Promise.all(crew.map(async (c, i) => {
        if (i === 0 && label) await type(c, label);
        let el;
        while ((el = queue.shift())) await draw(c, el);
      }));
    } finally {
      clearTimeout(safety);
      finish();
      crew.forEach(c => {
        c.el.classList.add('gone');
        c.move(c.x + (c.x > scrollX + innerWidth / 2 ? 160 : -160), c.y - 60);
        setTimeout(() => c.el.remove(), 700);
      });
    }
  }

  const watch = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    watch.unobserve(e.target);
    build(e.target);
  }), { rootMargin: '0px 0px -15% 0px' });
  sections.forEach(s => watch.observe(s));
})();
