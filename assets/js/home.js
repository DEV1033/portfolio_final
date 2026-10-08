renderGithubGraph("DEV1033", document.getElementById("githubGraph"));
wireMobileMenu();

// ---------- hero eyes: pupils follow the pointer ----------
(function initHeroEyes() {
  const svg = document.getElementById("heroEyes");
  if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const MAX_OFFSET = 20; // eye r ≈ 39, pupil r 15.5 → keeps the pupil inside the white
  const pupils = [...svg.querySelectorAll(".pupil")];
  let frame = 0;

  function look(x, y) {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      pupils.forEach((pupil) => {
        // Offsets are in SVG user units, so convert from screen px by the SVG's scale.
        // Measure the (static) white of the eye — the pupil's own rect moves with it.
        const rect = pupil.previousElementSibling.getBoundingClientRect();
        const scale = svg.getBoundingClientRect().width / 164;
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        const dist = Math.hypot(dx, dy);
        const reach = Math.min(MAX_OFFSET, dist / scale / 8);
        const k = dist ? reach / dist : 0;
        pupil.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      });
    });
  }

  window.addEventListener("pointermove", (e) => look(e.clientX, e.clientY), { passive: true });
  document.addEventListener("pointerleave", () => pupils.forEach((p) => (p.style.transform = "")));
})();

// ---------- Selected Works videos ----------
// Each plays only while its card is on screen; reduced-motion users just see the first frame/poster.
(function initWorkVideos() {
  const videos = document.querySelectorAll(".home-work-media video");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  videos.forEach((video) => {
    if (reduced) {
      video.removeAttribute("autoplay");
      video.pause();
      return;
    }
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? video.play().catch(() => {}) : video.pause()), {
      threshold: 0.2,
    }).observe(video);
  });
})();

// ---------- Visual Experimentation ticker ----------
// Videos only decode/play while the ticker is on screen.
(function initExperimentsTicker() {
  const ticker = document.getElementById("experimentsTicker");
  if (!ticker) return;
  const videos = [...ticker.querySelectorAll("video")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  new IntersectionObserver(([entry]) => {
    videos.forEach((v) => {
      if (entry.isIntersecting && !reduced) v.play().catch(() => {});
      else v.pause();
    });
  }).observe(ticker);
})();

// ---------- desktop-only resume sidebar ----------
const RESUME_PDF_URL = "assets/resume/DevChaudhary2026.pdf";
const isDesktop = () => window.matchMedia("(min-width: 901px)").matches;

const resumeSidebar = document.getElementById("resumeSidebar");
const resumeSidebarBackdrop = document.getElementById("resumeSidebarBackdrop");
const resumeSidebarFrame = document.getElementById("resumeSidebarFrame");
document.getElementById("resumeSidebarClose").innerHTML = svgIcon("close");

function openResumeSidebar() {
  if (!resumeSidebarFrame.src) resumeSidebarFrame.src = `${RESUME_PDF_URL}#zoom=100`;
  resumeSidebar.classList.add("open");
  resumeSidebarBackdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeResumeSidebar() {
  resumeSidebar.classList.remove("open");
  resumeSidebarBackdrop.classList.remove("open");
  document.body.style.overflow = "";
}

document.querySelectorAll(".resume-link").forEach((el) => {
  el.addEventListener("click", (e) => {
    if (!isDesktop()) return; // let the mobile new-tab link behave normally
    e.preventDefault();
    openResumeSidebar();
  });
});

document.getElementById("resumeSidebarClose").addEventListener("click", closeResumeSidebar);
resumeSidebarBackdrop.addEventListener("click", closeResumeSidebar);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && resumeSidebar.classList.contains("open")) closeResumeSidebar();
});
