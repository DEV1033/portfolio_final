renderGithubGraph("DEV1033", document.getElementById("githubGraph"));
wireMobileMenu();

initEyes();
initFooterBlueprint();

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

// ---------- "Some kind words" card-stack carousel ----------
(function initKindStack() {
  const stack = document.getElementById("kindStack");
  if (!stack) return;
  const cards = [...stack.querySelectorAll(".home-kind-card")];
  const count = document.getElementById("kindCount");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n) => String(n).padStart(2, "0");
  const AUTOPLAY_MS = 5000;
  const LEAVE_MS = 450;
  let order = cards.slice(); // order[0] is the front card
  let busy = false;
  let timer = null;
  let hovered = false;
  let visible = false;

  function render() {
    order.forEach((card, i) => {
      card.dataset.pos = i < 3 ? String(i) : "hidden";
      card.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    });
    count.textContent = `${pad(cards.indexOf(order[0]) + 1)} / ${pad(cards.length)}`;
  }

  // Cards are absolutely positioned: give them all the tallest card's height (so only clean
  // edges peek out behind the front one) and size the stack to fit, plus the peek offset.
  function sizeStack() {
    cards.forEach((c) => (c.style.height = ""));
    const tallest = Math.max(...cards.map((c) => c.offsetHeight));
    cards.forEach((c) => (c.style.height = `${tallest}px`));
    stack.style.height = `${tallest + 40}px`;
  }

  // dir -1 flies the front card off to the left, +1 to the right; it then goes to the back.
  function next(dir = -1) {
    if (busy) return;
    busy = true;
    const front = order[0];
    front.style.setProperty("--fly", dir < 0 ? "-115%" : "115%");
    front.style.setProperty("--tilt", dir < 0 ? "-8deg" : "8deg");
    front.style.transform = "";
    front.classList.add("is-leaving");
    // promote the others right away so they move up while the front card flies off
    order = order.slice(1).concat(front);
    order.slice(0, -1).forEach((card, i) => (card.dataset.pos = i < 3 ? String(i) : "hidden"));
    setTimeout(() => {
      front.classList.remove("is-leaving");
      render();
      busy = false;
    }, reduced ? 0 : LEAVE_MS);
  }

  function prev() {
    if (busy) return;
    order = [order[order.length - 1]].concat(order.slice(0, -1));
    render();
  }

  function schedule() {
    clearInterval(timer);
    timer = null;
    if (!reduced && visible && !hovered) timer = setInterval(() => next(-1), AUTOPLAY_MS);
  }

  document.getElementById("kindNext").addEventListener("click", () => {
    next(-1);
    schedule();
  });
  document.getElementById("kindPrev").addEventListener("click", () => {
    prev();
    schedule();
  });
  stack.addEventListener("pointerenter", () => {
    hovered = true;
    schedule();
  });
  stack.addEventListener("pointerleave", () => {
    hovered = false;
    schedule();
  });
  stack.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next(-1);
    if (e.key === "ArrowLeft") prev();
  });

  // Drag / swipe the front card; past the threshold it flies off in that direction.
  let startX = null;
  let dx = 0;
  stack.addEventListener("pointerdown", (e) => {
    const front = order[0];
    if (busy || !front.contains(e.target)) return;
    startX = e.clientX;
    dx = 0;
    front.classList.add("is-dragging");
    front.setPointerCapture(e.pointerId);
  });
  stack.addEventListener("pointermove", (e) => {
    if (startX === null) return;
    dx = e.clientX - startX;
    order[0].style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
  });
  const endDrag = () => {
    if (startX === null) return;
    const front = order[0];
    front.classList.remove("is-dragging");
    startX = null;
    if (Math.abs(dx) > 80) next(dx < 0 ? -1 : 1);
    else front.style.transform = "";
    schedule();
  };
  stack.addEventListener("pointerup", endDrag);
  stack.addEventListener("pointercancel", endDrag);

  stack.tabIndex = 0;
  render();
  sizeStack();
  window.addEventListener("resize", sizeStack);
  if (document.fonts) document.fonts.ready.then(sizeStack);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      // first time it's properly on screen, let the front card draw its highlights
      if (visible) stack.classList.add("is-inview");
      schedule();
    },
    { threshold: 0.4 }
  ).observe(stack);
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
