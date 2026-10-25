// Pixel panel builder, shared by game mode (js/game.js) and normal mode (js/normal.js).
// Turns a panel from js/content.js into the HTML of the pixel pop-up sheet
// (styled by css/pixel-ui.css). Live, game-only section types (GitHub, clock,
// Spotify, music) are passed in by the caller as `custom` renderers.
(() => {
  'use strict';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderSection(sec, custom = {}) {
    const title = sec.title ? `<h3>${esc(sec.title)}</h3>` : '';
    if (custom[sec.type]) return custom[sec.type](sec, title);
    switch (sec.type) {
      case 'text': return `${title}<p>${esc(sec.body)}</p>`;
      case 'list': return `${title}<ul class="list">${sec.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
      case 'tags': return `${title}<div class="tags">${sec.items.map(i => `<span>${esc(i)}</span>`).join('')}</div>`;
      case 'links': return `${title}<div class="links">${sec.items.map(l => `<a href="${esc(l.href)}" target="_blank" rel="noopener"><b>${esc(l.label)}</b><small>${esc(l.note || '')}</small><i>→</i></a>`).join('')}</div>`;
      case 'stats': return `${title}<div class="stats">${sec.items.map(s => `<div><b>${esc(s.value)}</b><small>${esc(s.label)}</small></div>`).join('')}</div>`;
      case 'timeline': return `${title}<ol class="timeline">${sec.items.map(t => `<li><small>${esc(t.when)}</small><b>${esc(t.what)}</b><p>${esc(t.note || '')}</p></li>`).join('')}</ol>`;
      case 'image': return `${title}<figure class="media"><img src="${esc(sec.src)}" alt="${esc(sec.alt || '')}" loading="lazy">${sec.caption ? `<figcaption>${esc(sec.caption)}</figcaption>` : ''}</figure>`;
      case 'video': return `${title}<figure class="media"><video src="${esc(sec.src)}"${sec.poster ? ` poster="${esc(sec.poster)}"` : ''} autoplay muted loop playsinline preload="metadata"></video>${sec.caption ? `<figcaption>${esc(sec.caption)}</figcaption>` : ''}</figure>`;
      case 'gallery': return `${title}<div class="gallery${sec.tall ? ' tall' : ''}">${sec.items.map(it => {
        const m = /\.(mp4|webm)$/i.test(it.src)
          ? `<video src="${esc(it.src)}" autoplay muted loop playsinline preload="metadata"></video>`
          : `<img src="${esc(it.src)}" alt="${esc(it.alt || '')}" loading="lazy">`;
        return `<figure>${m}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`;
      }).join('')}</div>`;
      case 'quotes': return `${title}<div class="quotes">${sec.items.map(q => {
        // blank lines in a quote become separate paragraphs; curly quotes wrap the whole thing
        const paras = q.text.split(/\n\s*\n/);
        const body = paras.map((t, i) => `<p>${i === 0 ? '“' : ''}${esc(t)}${i === paras.length - 1 ? '”' : ''}</p>`).join('');
        return `<blockquote>${body}<footer><b>${esc(q.name)}</b>${q.org ? ` · ${esc(q.org)}` : ''}</footer></blockquote>`;
      }).join('')}</div>`;
    }
    return '';
  }

  // the sheet's header + content for one panel
  function renderPanel(c, custom) {
    return `<header><span class="icon">${esc(c.icon || '◆')}</span><div><h2>${esc(c.title)}</h2>${c.subtitle ? `<small>${esc(c.subtitle)}</small>` : ''}</div></header>
      <div class="content">${c.sections.map(s => renderSection(s, custom)).join('')}</div>`;
  }

  window.PanelUI = { esc, renderSection, renderPanel };
})();
