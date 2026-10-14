initPixelRun();
wireMobileMenu();
initEyes();
initFooterBlueprint();

// ---------- About scrapbook: clicking the eyes "takes a photo" — flash, then the next photos rotate in ----------
(function initScrapbook() {
  const scrap = document.getElementById("scrap");
  const button = document.getElementById("scrapShuffle");
  if (!scrap || !button) return;
  const slots = [...scrap.querySelectorAll(".scrap-photo img")]; // main, left, right
  const pool = [4, 2, 6, 3, 7, 5].map((n) => `assets/img/about/collage/photo-${n}.webp`);
  pool.forEach((src) => (new Image().src = src)); // warm the cache so swaps are instant
  let offset = 0;

  button.addEventListener("click", () => {
    offset = (offset + 1) % pool.length;
    scrap.classList.remove("is-flashing");
    void scrap.offsetWidth; // restart the flash animation
    scrap.classList.add("is-flashing");
    setTimeout(() => slots.forEach((img, i) => (img.src = pool[(offset + i) % pool.length])), 120);
  });
})();


(async function loadAccentColor() {
  const { data, error } = await window.sb.from("site_settings").select("accent_color").eq("id", 1).single();
  if (!error && data) applyAccentColor(data.accent_color);
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
