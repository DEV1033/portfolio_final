let activeCategory = "all";
let settings = null;

async function loadSettings() {
  const { data, error } = await window.sb.from("site_settings").select("*").eq("id", 1).single();
  if (error || !data) return;
  settings = data;

  applyAccentColor(data.accent_color);

  document.getElementById("avatarImg").src = data.avatar_url || "";

  const bannerImg = document.getElementById("bannerImg");
  const profileHeader = document.getElementById("profileHeader");
  if (data.banner_url) {
    bannerImg.src = data.banner_url;
    bannerImg.hidden = false;
    profileHeader.classList.add("has-banner");
  } else {
    bannerImg.hidden = true;
    profileHeader.classList.remove("has-banner");
  }

  document.getElementById("profileName").textContent = data.name || "";
  document.getElementById("profileTagline").textContent = data.tagline || "";
  document.getElementById("verifiedIcon").innerHTML = svgIcon("verified");

  const websiteRow = document.getElementById("websiteRow");
  websiteRow.innerHTML = data.website_url
    ? `<a href="${escapeHtml(data.website_url)}" target="_blank" rel="noopener">${escapeHtml(data.website_label || data.website_url)}</a>`
    : "";

  const socialRow = document.getElementById("socialRow");
  socialRow.innerHTML = "";
  if (data.linkedin_url) {
    socialRow.innerHTML += `<a class="social-chip" href="${escapeHtml(data.linkedin_url)}" target="_blank" rel="noopener"><span>${escapeHtml(data.linkedin_handle || "")}</span>${svgIcon("linkedin")}</a>`;
  }
  if (data.instagram_url) {
    socialRow.innerHTML += `<a class="social-chip" href="${escapeHtml(data.instagram_url)}" target="_blank" rel="noopener"><span>${escapeHtml(data.instagram_handle || "")}</span>${svgIcon("instagram")}</a>`;
  }

  const ctaBar = document.getElementById("ctaBar");
  ctaBar.innerHTML = "";
  if (data.cta_hire_url && data.cta_hire_label) {
    ctaBar.innerHTML += `<a class="cta-btn" href="${escapeHtml(data.cta_hire_url)}" target="_blank" rel="noopener">${escapeHtml(data.cta_hire_label)}</a>`;
  }
  if (data.cta_resume_url && data.cta_resume_label) {
    ctaBar.innerHTML += `<a class="cta-btn secondary" href="${escapeHtml(data.cta_resume_url)}" target="_blank" rel="noopener">${escapeHtml(data.cta_resume_label)}</a>`;
  }
}

function renderPost(post) {
  const media = post.post_media || [];
  const mediaHtml = renderMediaHtml(media);

  const verifiedBadge = post.verified ? svgIcon("verified") : "";

  return `
    <article class="card post" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-author-row">
          <div class="post-author">
            <img class="post-avatar" src="${escapeHtml(settings?.avatar_url || "")}" alt="" />
            <div class="post-author-name">
              <span>${escapeHtml(settings?.name || "")}</span>
              ${verifiedBadge}
            </div>
          </div>
          <span class="post-time">${timeAgo(post.published_at || post.created_at)}</span>
        </div>
      </div>
      ${post.content ? `<p class="post-text clamped">${escapeHtml(post.content)}</p><button class="show-more" hidden>Show more</button>` : ""}
      ${mediaHtml}
    </article>
  `;
}

function wireShowMore(container) {
  container.querySelectorAll(".post-text").forEach((p) => {
    const btn = p.nextElementSibling;
    if (!btn || !btn.classList.contains("show-more")) return;

    // Only reveal the toggle if the text actually overflows its clamped height.
    if (p.scrollHeight > p.clientHeight + 1) {
      btn.hidden = false;
      btn.addEventListener("click", () => {
        p.classList.toggle("clamped");
        btn.textContent = p.classList.contains("clamped") ? "Show more" : "Show less";
      });
    }
  });
}

async function loadPosts() {
  const container = document.getElementById("postsContainer");

  let query = window.sb
    .from("posts")
    .select("*, post_media(*)")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (activeCategory !== "all") {
    query = query.eq("category", activeCategory);
  }

  const { data, error } = await query;
  if (error) {
    container.innerHTML = `<div class="empty-state">Couldn't load posts.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">No posts yet.</div>`;
    return;
  }

  container.innerHTML = data.map(renderPost).join("");
  wireShowMore(container);
  wireMediaGalleries(container);
}

document.getElementById("avatarImg").addEventListener("click", (e) => {
  const src = e.currentTarget.src;
  if (!src) return;
  openLightbox([{ url: src, media_type: "image" }], 0, { circular: true, originEl: e.currentTarget });
});

document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  activeCategory = btn.dataset.cat;
  loadPosts();
});

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

(async function init() {
  await loadSettings();
  await loadPosts();

  // Reflect admin changes without a manual refresh whenever the tab regains focus.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      loadSettings();
      loadPosts();
    }
  });
})();
