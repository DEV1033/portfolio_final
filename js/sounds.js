// Normal mode sounds: a revolver cylinder ticking round as you scroll, and a mouse click
// when you click. Both are generated here, so there are no audio files to download.
// Browsers decide when a page may play sound. Audio starts right away for visitors who
// clicked through from the landing page, and otherwise on their first click, tap or key press.
(() => {
  'use strict';
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const TICK_PX = 60;      // scroll distance between ticks
  const MIN_GAP = 0.05;    // seconds; stops a fast scroll turning into a buzz

  const ctx = new AudioCtx();
  const out = ctx.createGain();
  out.gain.value = 0.35;
  out.connect(ctx.destination);

  // builds a short sound from a noise snap and one decaying tone
  function sound(seconds, level, snapDecay, pitch, ringDecay) {
    const buffer = ctx.createBuffer(1, Math.floor(seconds * ctx.sampleRate), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      const snap = (Math.random() * 2 - 1) * Math.exp(-t / snapDecay) * 0.5;
      const ring = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t / ringDecay) * 0.5;
      data[i] = (snap + ring) * level;
    }
    return buffer;
  }

  const tick = sound(0.03, 0.6, 0.001, 2400, 0.005);      // the cylinder turning one notch
  const press = sound(0.04, 0.9, 0.0015, 1500, 0.006);    // mouse button going down
  const release = sound(0.03, 0.5, 0.001, 2100, 0.004);   // mouse button coming back up

  function play(buffer) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    src.start();
  }

  // js/swarm.js plays these for its cursors; nothing queues up while sound is still locked
  window.NormalSounds = { play(name) { const b = { tick, press, release }[name]; if (b && ctx.state === 'running') play(b); } };

  const wake = () => { if (ctx.state === 'suspended') ctx.resume(); };
  addEventListener('keydown', wake, { capture: true, passive: true });
  addEventListener('touchend', wake, { capture: true, passive: true });

  // clicks: a mouse sounds on press and release. Touch and keyboard sound once, on the
  // click itself, so that starting a swipe on a phone doesn't make a noise.
  let usingMouse = false;
  addEventListener('pointerdown', e => {
    wake();
    usingMouse = e.pointerType === 'mouse';
    if (usingMouse) play(press);
  }, { capture: true, passive: true });
  addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse') play(release);
  }, { capture: true, passive: true });
  addEventListener('click', () => {
    if (!usingMouse) play(press);
  }, { capture: true, passive: true });

  // scrolling: one tick per notch, in either direction
  let lastY = scrollY, travelled = 0, lastAt = 0;
  addEventListener('scroll', () => {
    const y = scrollY;
    travelled += Math.abs(y - lastY);
    lastY = y;
    if (travelled < TICK_PX) return;
    travelled %= TICK_PX;
    wake();
    if (ctx.state !== 'running' || ctx.currentTime - lastAt < MIN_GAP) return;
    lastAt = ctx.currentTime;
    play(tick);
  }, { passive: true });
})();
