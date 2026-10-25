// Normal mode: builds the calm portfolio page from js/content.js (the same
// content the pixel room uses), so text only ever lives in one place.
(() => {
  'use strict';
  const C = window.CONTENT, N = C.normal;
  const main = document.getElementById('main');

  const esc = window.PanelUI.esc; // shared with the game (js/panels.js)
  const sec = (key, type) => (C[key]?.sections || []).find(s => s.type === type);
  const secs = (key, type) => (C[key]?.sections || []).filter(s => s.type === type);
  const favicon = domain => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const BADGE_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#d6336c'];
  const colorFor = name => BADGE_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % BADGE_COLORS.length];
  const logo = (name, domain) => domain
    ? `<img class="logo" src="${favicon(domain)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'badge',textContent:'${esc(initials(name))}'}))">`
    : `<span class="badge" style="background:${colorFor(name)}">${esc(initials(name))}</span>`;
  const section = (label, body, id) => `<section class="reveal"${id ? ` id="${id}"` : ''}><h2 class="label">${esc(label)}</h2>${body}</section>`;

  // ── hero ────────────────────────────────────────────────────────────────
  function hero() {
    const intro = N.intro.map(p => `<p>${esc(p)}</p>`).join('');
    // the character's greeting from the room, trimmed to its first two sentences
    const hello = C.profile.greeting.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
    const resume = sec('experience', 'links')?.items?.[0];
    return `<div class="hero reveal">
      <div class="hello">
        <img class="avatar" src="${esc(N.photo)}" alt="Dev Chaudhary" width="140" height="140">
        <span class="px-bubble">${esc(hello)}</span>
      </div>
      <h1>${N.headline.map(l => `<span>${esc(l)}</span>`).join('')}</h1>
      <div class="intro">${intro}</div>
      <div class="ctas">
        <a class="pixel-btn hot" href="${esc(N.message.href)}" target="_blank" rel="noopener">✉ ${esc(N.message.label)}</a>
        ${resume ? `<a class="pixel-btn" href="${esc(resume.href)}" target="_blank" rel="noopener">▤ Resume</a>` : ''}
      </div>
    </div>`;
  }

  // ── GitHub: live contribution calendar (data from js/github.js, shared with the game) ──
  function github() {
    const user = C.github.username;
    const link = (sec('github', 'links')?.items || [])[0];
    return section('GITHUB', `<p class="lede">${esc(C.github.subtitle || 'Open source & side projects')}. Live from my GitHub.</p>
      <div class="gh" id="gh" aria-live="polite"><p class="gh-note">Loading contributions…</p></div>
      ${link ? `<a class="pixel-btn more-btn" href="${esc(link.href)}" target="_blank" rel="noopener">⌥ ${esc(link.label)} · @${esc(user)}</a>` : ''}`, 'github');
  }
  function fillGitHub(gh) {
    const box = document.getElementById('gh');
    if (!box) return;
    if (gh.status !== 'ok') { box.innerHTML = '<p class="gh-note">Couldn’t reach GitHub right now. The button below opens my profile.</p>'; return; }
    const stats = [
      ['📁', gh.repos ?? '—', 'public repos'],
      ['🟩', gh.total, 'contributions (1y)'],
      gh.streak ? ['🔥', gh.streak, 'day streak'] : ['📅', gh.activeDays, 'active days'],
      ['⭐', gh.best ? gh.best.count : '—', 'on my best day'],
    ].map(([i, v, l]) => `<div class="stat"><b><i>${i}</i>${esc(v)}</b><small>${esc(l)}</small></div>`).join('');
    const fmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const first = new Date(gh.days[0].date + 'T00:00:00Z').getUTCDay();
    // month labels: a label over the first week column of each month
    let months = '', lastMonth = -1;
    gh.days.forEach((d, i) => {
      const dt = new Date(d.date + 'T00:00:00Z'), col = Math.floor((i + first) / 7);
      if (dt.getUTCDate() <= 7 && dt.getUTCDay() === 0 && dt.getUTCMonth() !== lastMonth) {
        lastMonth = dt.getUTCMonth();
        months += `<span style="grid-column:${col + 1}">${dt.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}</span>`;
      }
    });
    const cells = '<i class="pad"></i>'.repeat(first) + gh.days.map(d =>
      `<i class="l${d.level}" title="${esc(`${d.count} contribution${d.count === 1 ? '' : 's'} on ${fmt(d.date)}`)}"></i>`).join('');
    box.innerHTML = `<div class="stats four">${stats}</div>
      <div class="gh-cal" tabindex="0" aria-label="${esc(`${gh.total} contributions in the last year`)}">
        <div class="gh-months">${months}</div>
        <div class="gh-grid">${cells}</div>
      </div>
      <div class="gh-legend">Less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i> More</div>`;
    const cal = box.querySelector('.gh-cal');
    cal.scrollLeft = cal.scrollWidth; // narrow screens: start at the most recent weeks
  }

  // ── experience: "Role · Company" + "Mon YYYY — …" → logo | company | role | year ──
  function experience() {
    const items = sec('experience', 'timeline')?.items || [];
    const rows = items.map(it => {
      const [role, company = role] = it.what.split(' · ');
      const year = (it.when.match(/\d{4}/) || [''])[0];
      return `<li class="row">
        <span class="who">${logo(company, N.companies[company])}<b>${esc(company)}</b></span>
        <span class="what">${esc(role)}</span>
        <span class="when">${esc(year)}</span>
      </li>`;
    }).join('');
    const resume = sec('experience', 'links')?.items?.[0];
    return section('EXPERIENCE', `<ul class="rows">${rows}</ul>${resume ? `<a class="pixel-btn more-btn" href="${esc(resume.href)}" target="_blank" rel="noopener">▤ Full resume (PDF)</a>` : ''}`, 'experience');
  }

  // ── recent work: big media cards; each opens the game's pixel pop-up with the full case study ──
  const openBtn = (key, label) => `<button class="pixel-btn" data-open="${esc(key)}">▶ ${esc(label)}</button>`;
  const meta = (key, label) => `<div class="card-meta"><span>${esc(C[key].subtitle || '')}</span>${openBtn(key, label)}</div>`;
  function work() {
    const cards = N.work.map(w => {
      if (w.panel) {
        const v = sec(w.panel, 'video');
        return `<article>
          <div class="card" style="background:${w.tint}" data-open="${esc(w.panel)}" role="button" tabindex="0" aria-label="Open the ${esc(C[w.panel].title)} case study">
            <video src="${esc(v.src)}"${v.poster ? ` poster="${esc(v.poster)}"` : ''} muted loop playsinline preload="metadata" data-autoplay aria-label="${esc(w.caption)}"></video>
          </div>
          <p class="caption">${esc(w.caption)}</p>
          ${meta(w.panel, 'Case study')}
        </article>`;
      }
      const g = secs(w.screens, 'gallery').find(x => x.tall) || secs(w.screens, 'gallery')[0];
      return `<article>
        <div class="card screens" style="background:${w.tint}">
          <div class="strip" tabindex="0" aria-label="${esc(w.caption)} (scroll sideways)">
            ${g.items.map(i => `<img src="${esc(i.src)}" alt="${esc(i.alt || '')}" loading="lazy">`).join('')}
          </div>
        </div>
        <p class="caption">${esc(w.caption)}</p>
        ${meta(w.screens, 'All designs')}
      </article>`;
    }).join('');
    return section('RECENT WORK', `<div class="work">${cards}</div>`, 'work');
  }

  // ── motion experiments ──
  function motion() {
    const g = secs('reading', 'gallery').find(x => x.items.some(i => /\.mp4$/.test(i.src)));
    if (!g) return '';
    return section('MOTION EXPERIMENTS', `<p class="lede">Small interactions and motion studies, mostly made for fun.</p>
      <div class="motion">${g.items.map(i => `<video src="${esc(i.src)}" muted loop playsinline preload="none" data-autoplay></video>`).join('')}</div>`);
  }

  // ── kind words ──
  function kindWords() {
    const q = sec('ideas', 'quotes');
    if (!q) return '';
    const cards = q.items.map(it => `<figure class="quote">
      <header><span class="initials" style="background:${colorFor(it.name)}">${esc(initials(it.name))}</span>
        <div><b>${esc(it.name)}</b><small>${esc(it.org)}</small></div></header>
      ${it.text.split(/\n\n+/).map(p => `<p>${esc(p)}</p>`).join('')}
    </figure>`).join('');
    return section('KIND WORDS', `<div class="quotes">${cards}</div>`);
  }

  // ── running (health-style stats row + photos) ──
  function running() {
    const st = sec('running', 'stats')?.items || [];
    const icons = ['🏃', '⏱️', '🏅', '👟'];
    const items = st.map((s, i) => `<div class="stat"><b><i>${icons[i] || '•'}</i>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join('');
    const g = sec('running', 'gallery');
    const photos = g ? `<div class="photos">${g.items.map(i => `<figure><img src="${esc(i.src)}" alt="${esc(i.alt || '')}" loading="lazy">${i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
    return section('RUNNING', `<p class="lede">Running is where I clear my head. My longest run so far is 15 km, and 21 km is coming soon.</p>
      <div class="stats three">${items}</div>${photos}`);
  }

  // ── tools (like a brands wall) ──
  function tools() {
    const tiles = Object.entries(N.tools).map(([name, domain]) =>
      `<div class="tool"><img src="${favicon(domain)}" alt="" loading="lazy">${esc(name)}</div>`).join('');
    const practice = (C.skills.sections.find(s => s.title === 'Practice') || {}).items || [];
    return section('TOOLS I USE', `<div class="tools">${tiles}</div>
      ${practice.length ? `<p class="practice">Day to day: ${practice.map(esc).join(' · ')}.</p>` : ''}`);
  }

  // ── contact ──
  function contact() {
    const links = sec('contact', 'links')?.items || [];
    const domains = { LinkedIn: 'linkedin.com', Instagram: 'instagram.com', Dribbble: 'dribbble.com', GitHub: 'github.com' };
    const rows = links.map(l => `<a class="row" href="${esc(l.href)}" target="_blank" rel="noopener">
      <span class="who">${logo(l.label, domains[l.label])}<b>${esc(l.label)}</b></span>
      <span class="what">${esc(l.note || '')}</span>
      <span class="when">↗</span>
    </a>`).join('');
    const body = sec('contact', 'text')?.body || '';
    return section('SAY HELLO', `<p class="lede">${esc(body)}</p><div class="rows">${rows}</div>`, 'contact');
  }

  main.innerHTML = [hero(), github(), experience(), work(), motion(), kindWords(), running(), tools(), contact()].join('');

  window.GitHubData.load(window.GitHubData.create(C.github.username)).then(fillGitHub);

  // ── pixel pop-up (js/panels.js builds it, css/pixel-ui.css styles it) ──────
  const panel = document.getElementById('panel');
  const panelBody = document.getElementById('panel-body');
  let opener = null;
  function openPanel(key) {
    const c = C[key];
    if (!c) return;
    opener = document.activeElement;
    panelBody.innerHTML = window.PanelUI.renderPanel(c);
    panel.querySelector('.sheet').setAttribute('aria-label', c.title);
    panel.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.classList.add('open'));
    panel.querySelector('.close').focus({ preventScroll: true });
  }
  function closePanel() {
    if (panel.hidden) return;
    panel.classList.remove('open');
    panelBody.querySelectorAll('video').forEach(v => v.pause());
    document.body.style.overflow = '';
    setTimeout(() => { if (!panel.classList.contains('open')) { panel.hidden = true; panelBody.innerHTML = ''; } }, 180);
    opener?.focus?.({ preventScroll: true });
  }
  panel.addEventListener('click', e => { if (e.target === panel || e.target.closest('.close')) closePanel(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
    const card = e.target.closest?.('[data-open][role="button"]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPanel(card.dataset.open); }
  });
  main.addEventListener('click', e => {
    const t = e.target.closest('[data-open]');
    if (t) openPanel(t.dataset.open);
  });
  const deep = new URLSearchParams(location.search).get('panel'); // e.g. normal.html?panel=trustyy
  if (deep) openPanel(deep);
  const y = +new URLSearchParams(location.search).get('y'); // test flag: start scrolled to y px
  if (y) setTimeout(() => { scrollTo(0, y); document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')); }, 50);

  // glass header: add depth once content scrolls under it
  const top = document.querySelector('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── behaviour: reveal on scroll, play videos only while visible ──────────
  const reveal = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const player = new IntersectionObserver(entries => entries.forEach(e => {
    const v = e.target;
    if (e.isIntersecting && !reduceMotion) { v.preload = 'auto'; v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.35 });
  document.querySelectorAll('video[data-autoplay]').forEach(v => {
    player.observe(v);
    if (reduceMotion) v.controls = true;
  });
})();
