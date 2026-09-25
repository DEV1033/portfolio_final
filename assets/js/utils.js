const CATEGORY_LABELS = {
  tweets: "Tweets",
  media: "Media",
  case_studies: "Case Studies",
  activities: "Activities",
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function timeAgo(dateString) {
  const then = new Date(dateString).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const units = [
    ["yr", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["hr", 3600],
    ["min", 60],
  ];
  for (const [label, secs] of units) {
    const value = Math.floor(seconds / secs);
    if (value >= 1) return `Posted ${value}${label}${value > 1 && label.length > 2 ? "s" : ""} ago`;
  }
  return "Posted just now";
}

function applyAccentColor(hex) {
  if (!hex) return;
  document.documentElement.style.setProperty("--accent", hex);
}

// Resolves once every img/video within `scopeEls` has loaded (or errored), or
// after timeoutMs — whichever comes first, so a slow/broken asset can never
// hang the preloader indefinitely. Only pass the elements actually visible at
// load (profile card + first post) — lazy-loaded media further down the feed
// hasn't started downloading yet and would otherwise always eat the timeout.
// Calls onProgress(done, total) as each element settles for a progress UI.
function waitForMediaReady(onProgress, scopeEls, timeoutMs = 6000) {
  const els = scopeEls.flatMap((scope) => Array.from(scope.querySelectorAll("img[src], video[src]")));
  const total = els.length;
  let done = 0;

  if (total === 0) {
    if (onProgress) onProgress(1, 1);
    return Promise.resolve();
  }

  function settle() {
    done++;
    if (onProgress) onProgress(done, total);
  }

  const perElement = els.map((el) => {
    if (el.tagName === "VIDEO") {
      if (el.readyState >= 2) {
        settle();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        el.addEventListener("loadeddata", () => (settle(), resolve()), { once: true });
        el.addEventListener("error", () => (settle(), resolve()), { once: true });
      });
    }
    if (el.complete) {
      settle();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      el.addEventListener("load", () => (settle(), resolve()), { once: true });
      el.addEventListener("error", () => (settle(), resolve()), { once: true });
    });
  });

  const allReady = Promise.all(perElement);
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([allReady, timeout]);
}

function mediaTag(m, eager) {
  return m.media_type === "video"
    ? `<video src="${escapeHtml(m.url)}" autoplay muted loop playsinline></video>`
    : `<img src="${escapeHtml(m.url)}" alt="" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} />`;
}

// `eager`: true for the first post only — its media is above the fold at
// load, so it should start downloading immediately instead of waiting for
// the lazy-load trigger, and it's the only feed media the preloader waits on.
function renderMediaHtml(media, eager) {
  if (!media || media.length === 0) return "";

  const sorted = [...media].sort((a, b) => a.position - b.position);
  const mediaJson = JSON.stringify(sorted.map((m) => ({ url: m.url, media_type: m.media_type })));

  if (sorted.length === 1) {
    return `<div class="post-media-single" data-media='${mediaJson}'>${mediaTag(sorted[0], eager)}</div>`;
  }

  const visible = sorted.slice(0, 4);
  const extraCount = sorted.length - visible.length;

  const cells = visible
    .map((m, i) => {
      const overlay = i === visible.length - 1 && extraCount > 0 ? `<div class="media-grid-more">+${extraCount}</div>` : "";
      return `<div class="media-grid-cell" data-index="${i}">${mediaTag(m, eager)}${overlay}</div>`;
    })
    .join("");

  return `<div class="media-grid" data-count="${visible.length}" data-media='${mediaJson}'>${cells}</div>`;
}

// ---------- X-style tap-to-expand full-screen photo/video viewer ----------
let lightboxEl = null;
let lightboxMedia = [];
let lightboxIndex = 0;
let lightboxOriginRect = null;
let lightboxCircular = false;

function computeCircularTargetRect() {
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.7;
  return {
    left: (window.innerWidth - size) / 2,
    top: (window.innerHeight - size) / 2,
    width: size,
    height: size,
  };
}

function applyFlipTransform(slideEl, originRect, targetRect) {
  const scaleX = originRect.width / targetRect.width;
  const scaleY = originRect.height / targetRect.height;
  const translateX = originRect.left + originRect.width / 2 - (targetRect.left + targetRect.width / 2);
  const translateY = originRect.top + originRect.height / 2 - (targetRect.top + targetRect.height / 2);
  slideEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
}

function ensureLightbox() {
  if (lightboxEl) return lightboxEl;

  const el = document.createElement("div");
  el.className = "lightbox-overlay";
  el.innerHTML = `
    <button class="lightbox-close" aria-label="Close">${svgIcon("close")}</button>
    <button class="lightbox-arrow prev" data-dir="-1" aria-label="Previous">&#8249;</button>
    <div class="lightbox-track"></div>
    <button class="lightbox-arrow next" data-dir="1" aria-label="Next">&#8250;</button>
    <div class="lightbox-count"></div>
  `;
  document.body.appendChild(el);

  const track = el.querySelector(".lightbox-track");
  const countEl = el.querySelector(".lightbox-count");
  const prevBtn = el.querySelector(".lightbox-arrow.prev");
  const nextBtn = el.querySelector(".lightbox-arrow.next");

  function renderSlides() {
    track.innerHTML = lightboxMedia
      .map(
        (m) =>
          `<div class="lightbox-slide">${
            m.media_type === "video"
              ? `<video src="${escapeHtml(m.url)}" controls></video>`
              : `<img src="${escapeHtml(m.url)}" alt="" />`
          }</div>`
      )
      .join("");
    const multiple = lightboxMedia.length > 1;
    countEl.style.display = multiple ? "" : "none";
    prevBtn.style.display = multiple ? "" : "none";
    nextBtn.style.display = multiple ? "" : "none";
    countEl.textContent = `${lightboxIndex + 1} / ${lightboxMedia.length}`;
    const slides = Array.from(track.querySelectorAll(".lightbox-slide"));
    slides[lightboxIndex]?.scrollIntoView({ inline: "center", block: "nearest" });
    return slides;
  }

  function goTo(index) {
    lightboxIndex = Math.max(0, Math.min(lightboxMedia.length - 1, index));
    const slides = Array.from(track.querySelectorAll(".lightbox-slide"));
    slides[lightboxIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    countEl.textContent = `${lightboxIndex + 1} / ${lightboxMedia.length}`;
  }

  el.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  el.addEventListener("click", (e) => {
    if (e.target === el) closeLightbox();
  });
  el.querySelectorAll(".lightbox-arrow").forEach((btn) => {
    btn.addEventListener("click", () => goTo(lightboxIndex + Number(btn.dataset.dir)));
  });

  el._renderSlides = renderSlides;
  el._goTo = goTo;
  el._track = track;
  lightboxEl = el;
  return el;
}

function openLightbox(media, startIndex, options) {
  lightboxMedia = media;
  lightboxIndex = startIndex;
  lightboxCircular = Boolean(options && options.circular);
  lightboxOriginRect = options && options.originEl ? options.originEl.getBoundingClientRect() : null;

  const el = ensureLightbox();
  el.classList.toggle("circular", lightboxCircular);
  el.classList.add("open");
  const slides = el._renderSlides();
  document.body.style.overflow = "hidden";

  const currentSlide = slides[lightboxIndex];
  if (lightboxOriginRect && currentSlide) {
    const targetRect = lightboxCircular ? computeCircularTargetRect() : currentSlide.getBoundingClientRect();
    currentSlide.style.transition = "none";
    applyFlipTransform(currentSlide, lightboxOriginRect, targetRect);
    currentSlide.style.opacity = "0.4";
    currentSlide.offsetHeight; // force reflow so the snapped starting position paints before we animate away from it
    requestAnimationFrame(() => {
      currentSlide.style.transition = "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease";
      currentSlide.style.transform = "none";
      currentSlide.style.opacity = "1";
    });
  }
}

function closeLightbox() {
  if (!lightboxEl || !lightboxEl.classList.contains("open")) return;
  lightboxEl.querySelectorAll("video").forEach((v) => v.pause());
  document.body.style.overflow = "";

  const slides = Array.from(lightboxEl._track.querySelectorAll(".lightbox-slide"));
  const currentSlide = slides[lightboxIndex];

  if (lightboxOriginRect && currentSlide) {
    const targetRect = lightboxCircular ? computeCircularTargetRect() : currentSlide.getBoundingClientRect();
    const finish = () => {
      lightboxEl.classList.remove("open");
      currentSlide.style.transition = "";
      currentSlide.style.transform = "";
      currentSlide.style.opacity = "";
      currentSlide.removeEventListener("transitionend", finish);
    };
    currentSlide.style.transition = "transform 0.28s ease, opacity 0.28s ease";
    applyFlipTransform(currentSlide, lightboxOriginRect, targetRect);
    currentSlide.style.opacity = "0";
    currentSlide.addEventListener("transitionend", finish);
    setTimeout(finish, 350); // safety fallback in case transitionend never fires
  } else {
    lightboxEl.classList.remove("open");
  }
}

document.addEventListener("keydown", (e) => {
  if (!lightboxEl || !lightboxEl.classList.contains("open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") lightboxEl._goTo(lightboxIndex - 1);
  if (e.key === "ArrowRight") lightboxEl._goTo(lightboxIndex + 1);
});

function wireMediaGalleries(container) {
  container.querySelectorAll("[data-media]").forEach((el) => {
    let media;
    try {
      media = JSON.parse(el.dataset.media);
    } catch {
      return;
    }
    if (el.classList.contains("post-media-single")) {
      el.addEventListener("click", () => {
        const originEl = el.querySelector("img, video") || el;
        openLightbox(media, 0, { originEl });
      });
    } else {
      el.querySelectorAll(".media-grid-cell").forEach((cell) => {
        cell.addEventListener("click", () => {
          const originEl = cell.querySelector("img, video") || cell;
          openLightbox(media, Number(cell.dataset.index), { originEl });
        });
      });
    }
  });
}

const GH_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GH_DAY_LABELS = { 1: "Mon", 3: "Wed", 5: "Fri" };

// Renders our own GitHub contribution heatmap (instead of embedding a
// third-party image) so the empty-day cells can be styled to sit quietly in
// the dark theme, and the grid can stretch to fill its container with real
// day/month labels like GitHub's own graph. Data comes from our own
// /api/github-contributions proxy (see api/github-contributions.js) rather
// than a third-party mirror, whose cache lagged real contributions by hours.
async function renderGithubGraph(username, container) {
  try {
    const res = await fetch(`/api/github-contributions?username=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("bad response");
    const data = await res.json();
    const days = data.contributions || [];
    if (days.length === 0) throw new Error("no data");

    // Pad the front so the grid's first column starts on a Sunday, matching
    // GitHub's own week columns (Sun top, Sat bottom).
    const firstDow = new Date(`${days[0].date}T00:00:00`).getDay();
    const padded = [...Array(firstDow).fill(null), ...days];
    const weeks = Math.ceil(padded.length / 7);

    let lastMonth = -1;
    const monthLabels = [];
    for (let w = 0; w < weeks; w++) {
      const firstRealDay = padded.slice(w * 7, w * 7 + 7).find(Boolean);
      if (!firstRealDay) continue;
      const month = new Date(`${firstRealDay.date}T00:00:00`).getMonth();
      if (month !== lastMonth) {
        monthLabels.push(`<span style="grid-column:${w + 1}">${GH_MONTH_LABELS[month]}</span>`);
        lastMonth = month;
      }
    }

    const cells = padded
      .map((d) =>
        d
          ? `<div class="gh-cell" data-level="${d.level}" title="${d.count} contributions on ${d.date}"></div>`
          : `<div class="gh-cell gh-cell-empty"></div>`
      )
      .join("");

    const dayLabels = [0, 1, 2, 3, 4, 5, 6].map((i) => `<span>${GH_DAY_LABELS[i] || ""}</span>`).join("");

    container.innerHTML = `
      <div class="gh-graph-days">${dayLabels}</div>
      <div class="gh-graph-body">
        <div class="gh-graph-months" style="grid-template-columns:repeat(${weeks}, 1fr)">${monthLabels.join("")}</div>
        <div class="gh-graph-grid" style="grid-template-columns:repeat(${weeks}, 1fr); aspect-ratio:${weeks} / 7">${cells}</div>
      </div>
    `;
  } catch {
    container.remove();
  }
}

// Drag-slider "can crush" effect for the About section: dragging the range
// input scrubs directly through the 20-frame sequence (frame 1 = default
// can, frame 20 = fully crushed) — no scroll-linking involved.
const CAN_CRUSH_TOTAL_FRAMES = 20;
const canCrushFramePath = (i) => `assets/img/can-crush/frame-${String(i).padStart(2, "0")}.png`;

function initCanCrush() {
  const img = document.getElementById("canCrushImg");
  const slider = document.getElementById("canCrushSlider");
  if (!img || !slider) return;

  for (let i = 1; i <= CAN_CRUSH_TOTAL_FRAMES; i++) {
    new Image().src = canCrushFramePath(i);
  }

  slider.addEventListener("input", () => {
    img.src = canCrushFramePath(Number(slider.value));
  });
}

// Continuously looping pixel-character run animation for the About page —
// just cycles frames on an interval, no user interaction involved.
const PIXEL_RUN_TOTAL_FRAMES = 18;
const PIXEL_RUN_FPS = 12;
const pixelRunFramePath = (i) => `assets/img/pixel-run/run-${String(i).padStart(2, "0")}.png`;

function initPixelRun() {
  const img = document.getElementById("pixelRunImg");
  if (!img) return;

  for (let i = 1; i <= PIXEL_RUN_TOTAL_FRAMES; i++) {
    new Image().src = pixelRunFramePath(i);
  }

  let frame = 1;
  setInterval(() => {
    frame = (frame % PIXEL_RUN_TOTAL_FRAMES) + 1;
    img.src = pixelRunFramePath(frame);
  }, 1000 / PIXEL_RUN_FPS);
}

function svgIcon(name) {
  const icons = {
    verified: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.01 2.011C12.7878 2.01105 13.5389 2.29437 14.123 2.808L14.277 2.953L14.975 3.651C15.1666 3.84131 15.4167 3.96145 15.685 3.992L15.82 4H16.82C17.6372 3.99995 18.4235 4.31257 19.0176 4.87374C19.6116 5.43491 19.9685 6.20211 20.015 7.018L20.02 7.2V8.2C20.02 8.47 20.112 8.733 20.278 8.943L20.368 9.043L21.065 9.741C21.6427 10.3154 21.9796 11.0886 22.0069 11.9029C22.0342 12.7171 21.7499 13.5111 21.212 14.123L21.067 14.277L20.369 14.975C20.1787 15.1666 20.0585 15.4167 20.028 15.685L20.02 15.82V16.82C20.02 17.6372 19.7074 18.4235 19.1463 19.0176C18.5851 19.6116 17.8179 19.9685 17.002 20.015L16.82 20.02H15.82C15.5504 20.0201 15.2886 20.111 15.077 20.278L14.977 20.368L14.279 21.065C13.7046 21.6427 12.9314 21.9796 12.1171 22.0069C11.3029 22.0342 10.5089 21.7499 9.897 21.212L9.743 21.067L9.045 20.369C8.85344 20.1787 8.60329 20.0585 8.335 20.028L8.2 20.02H7.2C6.38278 20.02 5.59651 19.7074 5.00243 19.1463C4.40835 18.5851 4.05148 17.8179 4.005 17.002L4 16.82V15.82C3.99991 15.5504 3.90903 15.2886 3.742 15.077L3.652 14.977L2.955 14.279C2.37728 13.7046 2.04042 12.9314 2.01311 12.1171C1.98579 11.3029 2.27008 10.5089 2.808 9.897L2.953 9.743L3.651 9.045C3.84131 8.85344 3.96145 8.60329 3.992 8.335L4 8.2V7.2L4.005 7.018C4.04965 6.23345 4.38143 5.49275 4.93709 4.93709C5.49275 4.38143 6.23345 4.04965 7.018 4.005L7.2 4H8.2C8.46962 3.99991 8.73135 3.90903 8.943 3.742L9.043 3.652L9.741 2.955C10.0383 2.65589 10.3919 2.41851 10.7813 2.2565C11.1707 2.09449 11.5882 2.01106 12.01 2.011ZM15.707 9.293C15.5195 9.10553 15.2652 9.00021 15 9.00021C14.7348 9.00021 14.4805 9.10553 14.293 9.293L11 12.585L9.707 11.293L9.613 11.21C9.41201 11.0546 9.1594 10.9815 8.90647 11.0056C8.65355 11.0297 8.41928 11.1492 8.25125 11.3397C8.08321 11.5303 7.99402 11.7777 8.00177 12.0316C8.00953 12.2856 8.11365 12.527 8.293 12.707L10.293 14.707L10.387 14.79C10.5794 14.9393 10.8197 15.0132 11.0627 14.9979C11.3057 14.9826 11.5348 14.8792 11.707 14.707L15.707 10.707L15.79 10.613C15.9393 10.4206 16.0132 10.1803 15.9979 9.93732C15.9826 9.69429 15.8792 9.46519 15.707 9.293Z" fill="var(--accent)"/></svg>`,
    linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.2225 0.00075H1.7715C0.795 0.00075 0 0.7755 0 1.7295V22.2675C0 23.2238 0.795 24 1.7715 24H22.224C23.2027 24 24 23.2238 24 22.2675V1.7295C24 0.7755 23.2027 0.00075 22.2225 0.00075Z" fill="#0177B5"/><path d="M3.55875 8.99775H7.125V20.4503H3.55875V8.99775ZM5.33925 3.29775C6.477 3.29775 7.40175 4.2225 7.40175 5.36025C7.40175 6.498 6.477 7.425 5.34 7.425C4.79269 7.42381 4.26813 7.20592 3.88105 6.81898C3.49397 6.43204 3.27589 5.90756 3.2745 5.36025C3.2745 5.08921 3.32792 4.82083 3.43171 4.57045C3.5355 4.32006 3.68763 4.0926 3.87939 3.90105C4.07115 3.7095 4.29878 3.55762 4.54927 3.4541C4.79977 3.35058 5.06821 3.29745 5.33925 3.29775ZM9.35175 8.99775H12.7657V10.563H12.813C13.2885 9.663 14.4495 8.7135 16.188 8.7135C19.7925 8.7135 20.4578 11.0858 20.4578 14.169V20.451H16.9005V14.88C16.9005 13.5525 16.8765 11.8425 15.051 11.8425C13.1985 11.8425 12.9135 13.29 12.9135 14.7825V20.448H9.357V8.9955L9.35175 8.99775Z" fill="white"/></svg>`,
    instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.0039 4.66919e-07C6.99403 4.66919e-07 5.52882 0.00517078 5.24402 0.0288004C4.21591 0.114284 3.57616 0.276208 2.87917 0.623305C2.34205 0.890107 1.91843 1.19936 1.50035 1.63287C0.73896 2.42346 0.277507 3.3961 0.110458 4.55226C0.0292467 5.11354 0.00561688 5.228 0.000818394 8.09496C-0.00102299 9.05061 0.000818394 10.3083 0.000818394 11.9953C0.000818394 17.0025 0.00635159 18.4666 0.0303531 18.7509C0.113415 19.7516 0.270305 20.3812 0.602552 21.0699C1.23751 22.3882 2.4502 23.3778 3.87886 23.7471C4.37354 23.8745 4.9199 23.9446 5.6213 23.9778C5.91848 23.9908 8.94744 24 11.9783 24C15.0091 24 18.0399 23.9963 18.3297 23.9815C19.1418 23.9433 19.6134 23.88 20.1349 23.7452C21.5728 23.3741 22.7633 22.3992 23.4112 21.0625C23.737 20.3905 23.9022 19.7369 23.9769 18.7884C23.9932 18.5816 24 15.2847 24 11.9922C24 8.69907 23.9926 5.40821 23.9764 5.20142C23.9007 4.23765 23.7355 3.5896 23.3992 2.90461C23.1232 2.34389 22.8168 1.92514 22.372 1.49699C21.5781 0.738523 20.6072 0.276943 19.4503 0.110039C18.8897 0.0289819 18.778 0.00498037 15.9096 4.66919e-07H12.0039Z" fill="url(#igGrad0)"/><path d="M12.0039 4.66919e-07C6.99403 4.66919e-07 5.52882 0.00517078 5.24402 0.0288004C4.21591 0.114284 3.57616 0.276208 2.87917 0.623305C2.34205 0.890107 1.91843 1.19936 1.50035 1.63287C0.73896 2.42346 0.277507 3.3961 0.110458 4.55226C0.0292467 5.11354 0.00561688 5.228 0.000818394 8.09496C-0.00102299 9.05061 0.000818394 10.3083 0.000818394 11.9953C0.000818394 17.0025 0.00635159 18.4666 0.0303531 18.7509C0.113415 19.7516 0.270305 20.3812 0.602552 21.0699C1.23751 22.3882 2.4502 23.3778 3.87886 23.7471C4.37354 23.8745 4.9199 23.9446 5.6213 23.9778C5.91848 23.9908 8.94744 24 11.9783 24C15.0091 24 18.0399 23.9963 18.3297 23.9815C19.1418 23.9433 19.6134 23.88 20.1349 23.7452C21.5728 23.3741 22.7633 22.3992 23.4112 21.0625C23.737 20.3905 23.9022 19.7369 23.9769 18.7884C23.9932 18.5816 24 15.2847 24 11.9922C24 8.69907 23.9926 5.40821 23.9764 5.20142C23.9007 4.23765 23.7355 3.5896 23.3992 2.90461C23.1232 2.34389 22.8168 1.92514 22.372 1.49699C21.5781 0.738523 20.6072 0.276943 19.4503 0.110039C18.8897 0.0289819 18.778 0.00498037 15.9096 4.66919e-07H12.0039Z" fill="url(#igGrad1)"/><path d="M12.0039 4.66919e-07C6.99403 4.66919e-07 5.52882 0.00517078 5.24402 0.0288004C4.21591 0.114284 3.57616 0.276208 2.87917 0.623305C2.34205 0.890107 1.91843 1.19936 1.50035 1.63287C0.73896 2.42346 0.277507 3.3961 0.110458 4.55226C0.0292467 5.11354 0.00561688 5.228 0.000818394 8.09496C-0.00102299 9.05061 0.000818394 10.3083 0.000818394 11.9953C0.000818394 17.0025 0.00635159 18.4666 0.0303531 18.7509C0.113415 19.7516 0.270305 20.3812 0.602552 21.0699C1.23751 22.3882 2.4502 23.3778 3.87886 23.7471C4.37354 23.8745 4.9199 23.9446 5.6213 23.9778C5.91848 23.9908 8.94744 24 11.9783 24C15.0091 24 18.0399 23.9963 18.3297 23.9815C19.1418 23.9433 19.6134 23.88 20.1349 23.7452C21.5728 23.3741 22.7633 22.3992 23.4112 21.0625C23.737 20.3905 23.9022 19.7369 23.9769 18.7884C23.9932 18.5816 24 15.2847 24 11.9922C24 8.69907 23.9926 5.40821 23.9764 5.20142C23.9007 4.23765 23.7355 3.5896 23.3992 2.90461C23.1232 2.34389 22.8168 1.92514 22.372 1.49699C21.5781 0.738523 20.6072 0.276943 19.4503 0.110039C18.8897 0.0289819 18.778 0.00498037 15.9096 4.66919e-07H12.0039Z" fill="url(#igGrad2)"/><path d="M12.0039 4.66919e-07C6.99403 4.66919e-07 5.52882 0.00517078 5.24402 0.0288004C4.21591 0.114284 3.57616 0.276208 2.87917 0.623305C2.34205 0.890107 1.91843 1.19936 1.50035 1.63287C0.73896 2.42346 0.277507 3.3961 0.110458 4.55226C0.0292467 5.11354 0.00561688 5.228 0.000818394 8.09496C-0.00102299 9.05061 0.000818394 10.3083 0.000818394 11.9953C0.000818394 17.0025 0.00635159 18.4666 0.0303531 18.7509C0.113415 19.7516 0.270305 20.3812 0.602552 21.0699C1.23751 22.3882 2.4502 23.3778 3.87886 23.7471C4.37354 23.8745 4.9199 23.9446 5.6213 23.9778C5.91848 23.9908 8.94744 24 11.9783 24C15.0091 24 18.0399 23.9963 18.3297 23.9815C19.1418 23.9433 19.6134 23.88 20.1349 23.7452C21.5728 23.3741 22.7633 22.3992 23.4112 21.0625C23.737 20.3905 23.9022 19.7369 23.9769 18.7884C23.9932 18.5816 24 15.2847 24 11.9922C24 8.69907 23.9926 5.40821 23.9764 5.20142C23.9007 4.23765 23.7355 3.5896 23.3992 2.90461C23.1232 2.34389 22.8168 1.92514 22.372 1.49699C21.5781 0.738523 20.6072 0.276943 19.4503 0.110039C18.8897 0.0289819 18.778 0.00498037 15.9096 4.66919e-07H12.0039Z" fill="url(#igGrad3)"/><path d="M12.0049 3.08165C9.58145 3.08165 9.27731 3.09223 8.32548 3.13552C7.37551 3.17899 6.72708 3.32927 6.1597 3.54978C5.5728 3.77753 5.07495 4.08218 4.57896 4.57799C4.0826 5.07362 3.77771 5.57109 3.54906 6.15737C3.32783 6.72452 3.17724 7.37265 3.13449 8.32154C3.09192 9.27266 3.08076 9.57676 3.08076 11.9984C3.08076 14.42 3.09155 14.723 3.13467 15.6741C3.17837 16.6234 3.32876 17.2714 3.54924 17.8383C3.77734 18.4248 4.08222 18.9223 4.5784 19.4179C5.07421 19.9139 5.57206 20.2193 6.15858 20.447C6.72633 20.6675 7.37496 20.8178 8.32473 20.8613C9.27656 20.9046 9.58051 20.9152 12.0038 20.9152C14.4274 20.9152 14.7306 20.9046 15.6824 20.8613C16.6324 20.8178 17.2816 20.6675 17.8493 20.447C18.436 20.2193 18.9331 19.9139 19.429 19.4179C19.9253 18.9223 20.2302 18.4248 20.4589 17.8385C20.6782 17.2714 20.8288 16.6232 20.8734 15.6743C20.9162 14.7232 20.9273 14.42 20.9273 11.9984C20.9273 9.57675 20.9162 9.27285 20.8734 8.32172C20.8288 7.37246 20.6782 6.72451 20.4589 6.15756C20.2302 5.57109 19.9253 5.07361 19.429 4.57799C18.9326 4.08199 18.4362 3.77734 17.8488 3.54978C17.2799 3.32927 16.6311 3.17899 15.6811 3.13552C14.7293 3.09223 14.4263 3.08165 12.0021 3.08165H12.0049ZM11.2044 4.68852C11.442 4.68815 11.7071 4.68852 12.0049 4.68852C14.3874 4.68852 14.6698 4.69707 15.6107 4.73979C16.4807 4.77955 16.9529 4.92481 17.2674 5.04686C17.6839 5.20847 17.9808 5.40167 18.2929 5.71376C18.6052 6.02585 18.7985 6.32307 18.9607 6.73918C19.0828 7.05313 19.2284 7.52497 19.268 8.39436C19.3107 9.33433 19.32 9.6167 19.32 11.9964C19.32 14.376 19.3107 14.6584 19.268 15.5984C19.2282 16.4677 19.0828 16.9396 18.9607 17.2535C18.7989 17.6696 18.6052 17.9659 18.2929 18.2778C17.9806 18.5899 17.6841 18.7831 17.2674 18.9447C16.9533 19.0673 16.4807 19.2122 15.6107 19.252C14.67 19.2947 14.3874 19.304 12.0049 19.304C9.62216 19.304 9.33977 19.2947 8.39909 19.252C7.52907 19.2119 7.05688 19.0666 6.74214 18.9446C6.32571 18.7829 6.02826 18.5897 5.71595 18.2777C5.40363 17.9656 5.21029 17.6691 5.04818 17.2528C4.92604 16.9388 4.78048 16.467 4.74089 15.5976C4.69813 14.6576 4.68957 14.3753 4.68957 11.9941C4.68957 9.61299 4.69813 9.3321 4.74089 8.39213C4.78067 7.52274 4.92604 7.0509 5.04818 6.73659C5.20991 6.32047 5.40363 6.02325 5.71595 5.71116C6.02826 5.39907 6.32571 5.20588 6.74214 5.04389C7.05669 4.92128 7.52907 4.77639 8.39909 4.73644C9.22228 4.69929 9.54129 4.68815 11.2044 4.68628L11.2044 4.68852ZM16.7681 6.16907C16.1769 6.16907 15.6973 6.64779 15.6973 7.23871C15.6973 7.82945 16.1769 8.30872 16.7681 8.30872C17.3593 8.30872 17.8389 7.82945 17.8389 7.23871C17.8389 6.64797 17.3593 6.16871 16.7681 6.16871L16.7681 6.16907ZM12.0049 7.41927C9.47417 7.41927 7.42236 9.46957 7.42236 11.9984C7.42236 14.5272 9.47417 16.5766 12.0049 16.5766C14.5356 16.5766 16.5867 14.5272 16.5867 11.9984C16.5867 9.46957 14.5354 7.41927 12.0047 7.41927H12.0049ZM12.0049 9.02615C13.6475 9.02615 14.9793 10.3568 14.9793 11.9984C14.9793 13.6398 13.6475 14.9706 12.0049 14.9706C10.3621 14.9706 9.03043 13.6398 9.03043 11.9984C9.03043 10.3568 10.3621 9.02615 12.0049 9.02615Z" fill="white"/><defs><radialGradient id="igGrad0" cx="0" cy="0" r="1" gradientTransform="matrix(-14.7589 4.16236 -2.99883 -10.6331 23.225 11.2491)" gradientUnits="userSpaceOnUse"><stop stop-color="#FF005F"/><stop offset="1" stop-color="#FC01D8"/></radialGradient><radialGradient id="igGrad1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(6.37482 25.8485) rotate(-90) scale(19.1573 20.3254)"><stop stop-color="#FFCC00"/><stop offset="0.1242" stop-color="#FFCC00"/><stop offset="0.5672" stop-color="#FE4A05"/><stop offset="0.6942" stop-color="#FF0F3F"/><stop offset="1" stop-color="#FE0657" stop-opacity="0"/></radialGradient><radialGradient id="igGrad2" cx="0" cy="0" r="1" gradientTransform="matrix(3.97636 -6.8514 8.91974 5.1768 12.6065 23.6615)" gradientUnits="userSpaceOnUse"><stop stop-color="#FFCC00"/><stop offset="1" stop-color="#FFCC00" stop-opacity="0"/></radialGradient><radialGradient id="igGrad3" cx="0" cy="0" r="1" gradientTransform="matrix(-14.5969 4.11024 -1.4 -4.97325 3.25629 0.977274)" gradientUnits="userSpaceOnUse"><stop stop-color="#780CFF"/><stop offset="1" stop-color="#820BFF" stop-opacity="0"/></radialGradient></defs></svg>`,
    image: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.78115 3.78115C7.28099 4.28131 7 4.95967 7 5.667V14.333C7 15.0403 7.28099 15.7187 7.78115 16.2189C8.28131 16.719 8.95967 17 9.667 17H18.333C18.6832 17 19.03 16.931 19.3536 16.797C19.6772 16.663 19.9712 16.4665 20.2189 16.2189C20.4665 15.9712 20.663 15.6772 20.797 15.3536C20.931 15.03 21 14.6832 21 14.333V5.667C21 5.31676 20.931 4.96996 20.797 4.64638C20.663 4.32281 20.4665 4.0288 20.2189 3.78115C19.9712 3.53349 19.6772 3.33704 19.3536 3.20301C19.03 3.06898 18.6832 3 18.333 3H9.667C8.95967 3 8.28131 3.28099 7.78115 3.78115Z" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.012 7.26C3.70534 7.43482 3.45027 7.6875 3.27258 7.9925C3.09488 8.2975 3.00085 8.64401 3 8.997V18.997C3 20.097 3.9 20.997 5 20.997H15C15.75 20.997 16.158 20.612 16.5 19.997" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 7H17.01" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 13L10.644 9.356C10.7564 9.24352 10.8898 9.15429 11.0367 9.09341C11.1836 9.03253 11.341 9.0012 11.5 9.0012C11.659 9.0012 11.8164 9.03253 11.9633 9.09341C12.1102 9.15429 12.2436 9.24352 12.356 9.356L16 13" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12L16.644 10.356C16.7564 10.2435 16.8898 10.1543 17.0367 10.0934C17.1836 10.0325 17.341 10.0012 17.5 10.0012C17.659 10.0012 17.8164 10.0325 17.9633 10.0934C18.1102 10.1543 18.2436 10.2435 18.356 10.356L21 13" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    gif: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8H6C5.46957 8 4.96086 8.21071 4.58579 8.58579C4.21071 8.96086 4 9.46957 4 10V14C4 14.5304 4.21071 15.0391 4.58579 15.4142C4.96086 15.7893 5.46957 16 6 16H8V12H7" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8V16" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12H19" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 8H16V16" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    video: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 10L19.553 7.724C19.7054 7.64784 19.8748 7.61188 20.045 7.61955C20.2152 7.62721 20.3806 7.67825 20.5256 7.76781C20.6706 7.85736 20.7902 7.98248 20.8733 8.13127C20.9563 8.28007 20.9999 8.44761 21 8.618V15.382C20.9999 15.5524 20.9563 15.7199 20.8733 15.8687C20.7902 16.0175 20.6706 16.1426 20.5256 16.2322C20.3806 16.3218 20.2152 16.3728 20.045 16.3805C19.8748 16.3881 19.7054 16.3522 19.553 16.276L15 14V10Z" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H13C13.5304 6 14.0391 6.21071 14.4142 6.58579C14.7893 6.96086 15 7.46957 15 8V16C15 16.5304 14.7893 17.0391 14.4142 17.4142C14.0391 17.7893 13.5304 18 13 18H5C4.46957 18 3.96086 17.7893 3.58579 17.4142C3.21071 17.0391 3 16.5304 3 16V8Z" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 12H11" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 10V14" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    emoji: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 10.8181 3.23279 9.64778 3.68508 8.55585C4.13738 7.46392 4.80031 6.47177 5.63604 5.63604C6.47177 4.80031 7.46392 4.13738 8.55585 3.68508C9.64778 3.23279 10.8181 3 12 3C13.1819 3 14.3522 3.23279 15.4442 3.68508C16.5361 4.13738 17.5282 4.80031 18.364 5.63604C19.1997 6.47177 19.8626 7.46392 20.3149 8.55585C20.7672 9.64778 21 10.8181 21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442Z" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 9H9.01" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 9H15.01" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 13C8 14.0609 8.42143 15.0783 9.17157 15.8284C9.92172 16.5786 10.9391 17 12 17C13.0609 17 14.0783 16.5786 14.8284 15.8284C15.5786 15.0783 16 14.0609 16 13H8Z" stroke="#545454" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    kebab: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 12C11 12.2652 11.1054 12.5196 11.2929 12.7071C11.4804 12.8946 11.7348 13 12 13C12.2652 13 12.5196 12.8946 12.7071 12.7071C12.8946 12.5196 13 12.2652 13 12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12Z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 19C11 19.2652 11.1054 19.5196 11.2929 19.7071C11.4804 19.8946 11.7348 20 12 20C12.2652 20 12.5196 19.8946 12.7071 19.7071C12.8946 19.5196 13 19.2652 13 19C13 18.7348 12.8946 18.4804 12.7071 18.2929C12.5196 18.1054 12.2652 18 12 18C11.7348 18 11.4804 18.1054 11.2929 18.2929C11.1054 18.4804 11 18.7348 11 19Z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 5C11 5.26522 11.1054 5.51957 11.2929 5.70711C11.4804 5.89464 11.7348 6 12 6C12.2652 6 12.5196 5.89464 12.7071 5.70711C12.8946 5.51957 13 5.26522 13 5C13 4.73478 12.8946 4.48043 12.7071 4.29289C12.5196 4.10536 12.2652 4 12 4C11.7348 4 11.4804 4.10536 11.2929 4.29289C11.1054 4.48043 11 4.73478 11 5Z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevron: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="#545454" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  };
  return icons[name] || "";
}
