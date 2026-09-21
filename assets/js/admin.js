const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB per post

let pendingFiles = []; // { file, type: 'image'|'video', previewUrl }
let existingMedia = []; // media already saved on the post being edited
let removedMediaIds = [];
let editingPostId = null;
let adminActiveCategory = "all";
let settingsCache = null;

const els = {
  composerAvatar: document.getElementById("composerAvatar"),
  categorySelect: document.getElementById("categorySelect"),
  composerText: document.getElementById("composerText"),
  mediaPreview: document.getElementById("mediaPreview"),
  mediaHint: document.getElementById("mediaHint"),
  draftBtn: document.getElementById("draftBtn"),
  publishBtn: document.getElementById("publishBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  toast: document.getElementById("toast"),
  adminPosts: document.getElementById("adminPosts"),
};

document.getElementById("imageIcon").innerHTML = svgIcon("image");
document.getElementById("gifIcon").innerHTML = svgIcon("gif");
document.getElementById("videoIcon").innerHTML = svgIcon("video");
document.getElementById("emojiIcon").innerHTML = svgIcon("emoji");
document.getElementById("categoryChevron").innerHTML = svgIcon("chevron");

// ---------- auth guard ----------
(async function guard() {
  const { data } = await window.sb.auth.getSession();
  if (!data.session) {
    window.location.href = "/admin/login";
    return;
  }
  init();
})();

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await window.sb.auth.signOut();
  window.location.href = "/admin/login";
});

// ---------- off-canvas settings panel (mobile/tablet) ----------
const settingsPanel = document.getElementById("settingsPanel");
const settingsBackdrop = document.getElementById("settingsBackdrop");

let scrollLockY = 0;

function lockBodyScroll() {
  scrollLockY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollLockY}px`;
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollLockY);
}

function closeSettingsPanel() {
  settingsPanel.classList.remove("open");
  settingsBackdrop.classList.remove("open");
  unlockBodyScroll();
}

document.getElementById("hamburgerBtn").addEventListener("click", () => {
  const opening = !settingsPanel.classList.contains("open");
  settingsPanel.classList.toggle("open");
  settingsBackdrop.classList.toggle("open");
  if (opening) {
    lockBodyScroll();
  } else {
    unlockBodyScroll();
  }
});
document.getElementById("settingsCloseBtn").addEventListener("click", closeSettingsPanel);
settingsBackdrop.addEventListener("click", closeSettingsPanel);

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 1800);
}

// ---------- media handling ----------
function currentTotalBytes() {
  const pending = pendingFiles.reduce((sum, p) => sum + p.file.size, 0);
  const existing = existingMedia.reduce((sum, m) => sum + (m.size_bytes || 0), 0);
  return pending + existing;
}

function addFiles(fileList, type) {
  const errors = [];
  Array.from(fileList).forEach((file) => {
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name} is over 5MB`);
      return;
    }
    if (currentTotalBytes() + file.size > MAX_TOTAL_BYTES) {
      errors.push(`${file.name} would exceed the 25MB total per post`);
      return;
    }
    pendingFiles.push({ file, type, previewUrl: URL.createObjectURL(file) });
  });
  els.mediaHint.textContent = errors.length
    ? errors.join(" · ")
    : "Up to 5MB per file, 25MB total per post";
  renderMediaPreview();
}

function renderMediaPreview() {
  els.mediaPreview.innerHTML = "";

  existingMedia.forEach((m) => {
    const wrap = document.createElement("div");
    wrap.className = "media-thumb";
    wrap.innerHTML =
      (m.media_type === "video"
        ? `<video src="${escapeHtml(m.url)}"></video>`
        : `<img src="${escapeHtml(m.url)}" />`) +
      `<button class="remove" data-existing-id="${m.id}">${svgIcon("close")}</button>`;
    els.mediaPreview.appendChild(wrap);
  });

  pendingFiles.forEach((p, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "media-thumb";
    wrap.innerHTML =
      (p.type === "video"
        ? `<video src="${p.previewUrl}"></video>`
        : `<img src="${p.previewUrl}" />`) +
      `<button class="remove" data-pending-idx="${idx}">${svgIcon("close")}</button>`;
    els.mediaPreview.appendChild(wrap);
  });
}

els.mediaPreview.addEventListener("click", (e) => {
  const btn = e.target.closest("button.remove");
  if (!btn) return;
  if (btn.dataset.pendingIdx !== undefined && btn.dataset.pendingIdx !== "") {
    pendingFiles.splice(Number(btn.dataset.pendingIdx), 1);
  } else if (btn.dataset.existingId) {
    const id = btn.dataset.existingId;
    const media = existingMedia.find((m) => m.id === id);
    if (media) removedMediaIds.push(media);
    existingMedia = existingMedia.filter((m) => m.id !== id);
  }
  renderMediaPreview();
});

document.getElementById("imageInput").addEventListener("change", (e) => addFiles(e.target.files, "image"));
document.getElementById("gifInput").addEventListener("change", (e) => addFiles(e.target.files, "image"));
document.getElementById("videoInput").addEventListener("change", (e) => addFiles(e.target.files, "video"));

// ---------- emoji ----------
const emojiPicker = document.getElementById("emojiPicker");

document.getElementById("emojiIcon").addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = emojiPicker.style.display === "block";
  emojiPicker.style.display = isOpen ? "none" : "block";
});
emojiPicker.addEventListener("click", (e) => e.stopPropagation());
emojiPicker.addEventListener("emoji-click", (e) => {
  const emoji = e.detail.unicode;
  const ta = els.composerText;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + emoji + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + emoji.length;
});
document.addEventListener("click", () => (emojiPicker.style.display = "none"));

// ---------- composer submit ----------
function resetComposer() {
  editingPostId = null;
  pendingFiles = [];
  existingMedia = [];
  removedMediaIds = [];
  els.composerText.value = "";
  els.categorySelect.value = "tweets";
  els.cancelEditBtn.style.display = "none";
  els.publishBtn.textContent = "Post";
  renderMediaPreview();
}

document.getElementById("cancelEditBtn").addEventListener("click", resetComposer);

async function uploadPendingMedia(postId, startPosition) {
  let position = startPosition;
  for (const p of pendingFiles) {
    const path = `${postId}/${crypto.randomUUID()}-${p.file.name}`;
    const { error: upErr } = await window.sb.storage.from("media").upload(path, p.file);
    if (upErr) throw upErr;
    const { data: pub } = window.sb.storage.from("media").getPublicUrl(path);
    const { error: insErr } = await window.sb.from("post_media").insert({
      post_id: postId,
      media_type: p.type,
      url: pub.publicUrl,
      position: position++,
      size_bytes: p.file.size,
    });
    if (insErr) throw insErr;
  }
}

async function removeDeletedMedia() {
  for (const m of removedMediaIds) {
    const path = m.url.split("/storage/v1/object/public/media/")[1];
    if (path) await window.sb.storage.from("media").remove([decodeURIComponent(path)]);
    await window.sb.from("post_media").delete().eq("id", m.id);
  }
  removedMediaIds = [];
}

async function submitPost(status) {
  const content = els.composerText.value.trim();
  const category = els.categorySelect.value;

  if (!content && pendingFiles.length === 0 && existingMedia.length === 0) {
    showToast("Nothing to post");
    return;
  }

  els.draftBtn.disabled = true;
  els.publishBtn.disabled = true;

  try {
    if (editingPostId) {
      const { error } = await window.sb
        .from("posts")
        .update({
          category,
          content,
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .eq("id", editingPostId);
      if (error) throw error;

      await removeDeletedMedia();
      const startPos = existingMedia.length ? Math.max(...existingMedia.map((m) => m.position)) + 1 : 0;
      await uploadPendingMedia(editingPostId, startPos);
    } else {
      const { data: inserted, error } = await window.sb
        .from("posts")
        .insert({
          category,
          content,
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (error) throw error;

      await uploadPendingMedia(inserted.id, 0);
    }

    showToast(status === "published" ? "Posted" : "Draft saved");
    resetComposer();
    await loadAdminPosts();
  } catch (err) {
    showToast(err.message || "Something went wrong");
  } finally {
    els.draftBtn.disabled = false;
    els.publishBtn.disabled = false;
  }
}

els.draftBtn.addEventListener("click", () => submitPost("draft"));
els.publishBtn.addEventListener("click", () => submitPost("published"));

// ---------- admin post list ----------
function renderAdminPost(post) {
  const media = post.post_media || [];
  const mediaHtml = renderMediaHtml(media);

  return `
    <article class="card post" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-author-row">
          <div class="post-author">
            <img class="post-avatar" src="${escapeHtml(settingsCache?.avatar_url || "")}" alt="" />
            <div class="post-author-name">
              <span>${escapeHtml(settingsCache?.name || "")}</span>
              ${post.verified ? svgIcon("verified") : ""}
            </div>
          </div>
          <div class="post-meta-row">
            <span class="post-time">${timeAgo(post.published_at || post.created_at)}</span>
            <span class="status-badge ${post.status}">${post.status}</span>
          </div>
        </div>
        <div class="post-menu-wrap">
          <button class="post-menu-trigger" data-menu-toggle>${svgIcon("kebab")}</button>
          <div class="post-menu">
            <button data-action="edit">Edit</button>
            <button data-action="toggle-status">${post.status === "published" ? "Unpublish" : "Publish"}</button>
            <button data-action="delete">Delete</button>
          </div>
        </div>
      </div>
      ${post.content ? `<p class="post-text">${escapeHtml(post.content)}</p>` : ""}
      ${mediaHtml}
    </article>
  `;
}

async function loadAdminPosts() {
  let query = window.sb
    .from("posts")
    .select("*, post_media(*)")
    .order("created_at", { ascending: false });

  if (adminActiveCategory !== "all") {
    query = query.eq("category", adminActiveCategory);
  }

  const { data, error } = await query;
  if (error) {
    els.adminPosts.innerHTML = `<div class="empty-state">Couldn't load posts.</div>`;
    return;
  }
  if (!data || data.length === 0) {
    els.adminPosts.innerHTML = `<div class="empty-state">No posts yet.</div>`;
    return;
  }
  els.adminPosts.innerHTML = data.map(renderAdminPost).join("");
  wireMediaGalleries(els.adminPosts);
  window.__adminPostsCache = data;
}

document.getElementById("adminTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll("#adminTabs .tab").forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  adminActiveCategory = btn.dataset.cat;
  loadAdminPosts();
});

els.adminPosts.addEventListener("click", async (e) => {
  const toggle = e.target.closest("[data-menu-toggle]");
  if (toggle) {
    const menu = toggle.nextElementSibling;
    document.querySelectorAll(".post-menu.open").forEach((m) => {
      if (m !== menu) m.classList.remove("open");
    });
    menu.classList.toggle("open");
    return;
  }

  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;
  const postId = actionBtn.closest(".post").dataset.postId;
  const post = (window.__adminPostsCache || []).find((p) => p.id === postId);
  if (!post) return;

  if (actionBtn.dataset.action === "delete") {
    if (!confirm("Delete this post permanently?")) return;
    for (const m of post.post_media || []) {
      const path = m.url.split("/storage/v1/object/public/media/")[1];
      if (path) await window.sb.storage.from("media").remove([decodeURIComponent(path)]);
    }
    await window.sb.from("posts").delete().eq("id", postId);
    showToast("Post deleted");
    loadAdminPosts();
  }

  if (actionBtn.dataset.action === "toggle-status") {
    const newStatus = post.status === "published" ? "draft" : "published";
    await window.sb
      .from("posts")
      .update({ status: newStatus, published_at: newStatus === "published" ? new Date().toISOString() : post.published_at })
      .eq("id", postId);
    showToast(newStatus === "published" ? "Posted" : "Moved to draft");
    loadAdminPosts();
  }

  if (actionBtn.dataset.action === "edit") {
    editingPostId = post.id;
    els.composerText.value = post.content || "";
    els.categorySelect.value = post.category;
    existingMedia = [...(post.post_media || [])];
    pendingFiles = [];
    removedMediaIds = [];
    renderMediaPreview();
    els.cancelEditBtn.style.display = "inline-block";
    els.publishBtn.textContent = "Save";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".post-menu-wrap")) {
    document.querySelectorAll(".post-menu.open").forEach((m) => m.classList.remove("open"));
  }
});

// ---------- settings sidebar ----------

async function loadSettingsIntoPanel() {
  const { data } = await window.sb.from("site_settings").select("*").eq("id", 1).single();
  if (!data) return;
  settingsCache = data;

  document.getElementById("setName").value = data.name || "";
  document.getElementById("setTagline").value = data.tagline || "";
  document.getElementById("setAvatar").value = data.avatar_url || "";
  document.getElementById("setBanner").value = data.banner_url || "";
  document.getElementById("setWebsiteLabel").value = data.website_label || "";
  document.getElementById("setWebsiteUrl").value = data.website_url || "";
  document.getElementById("setLinkedinHandle").value = data.linkedin_handle || "";
  document.getElementById("setLinkedinUrl").value = data.linkedin_url || "";
  document.getElementById("setInstagramHandle").value = data.instagram_handle || "";
  document.getElementById("setInstagramUrl").value = data.instagram_url || "";
  document.getElementById("setAccent").value = data.accent_color || "#01a73b";
  document.getElementById("setCtaHireLabel").value = data.cta_hire_label || "";
  document.getElementById("setCtaHireUrl").value = data.cta_hire_url || "";
  document.getElementById("setCtaResumeLabel").value = data.cta_resume_label || "";
  document.getElementById("setCtaResumeUrl").value = data.cta_resume_url || "";

  applyAccentColor(data.accent_color);
  els.composerAvatar.src = data.avatar_url || "";
}

document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
  const payload = {
    name: document.getElementById("setName").value.trim(),
    tagline: document.getElementById("setTagline").value.trim(),
    avatar_url: document.getElementById("setAvatar").value.trim(),
    banner_url: document.getElementById("setBanner").value.trim(),
    website_label: document.getElementById("setWebsiteLabel").value.trim(),
    website_url: document.getElementById("setWebsiteUrl").value.trim(),
    linkedin_handle: document.getElementById("setLinkedinHandle").value.trim(),
    linkedin_url: document.getElementById("setLinkedinUrl").value.trim(),
    instagram_handle: document.getElementById("setInstagramHandle").value.trim(),
    instagram_url: document.getElementById("setInstagramUrl").value.trim(),
    accent_color: document.getElementById("setAccent").value,
    cta_hire_label: document.getElementById("setCtaHireLabel").value.trim(),
    cta_hire_url: document.getElementById("setCtaHireUrl").value.trim(),
    cta_resume_label: document.getElementById("setCtaResumeLabel").value.trim(),
    cta_resume_url: document.getElementById("setCtaResumeUrl").value.trim(),
  };

  const { error } = await window.sb.from("site_settings").update(payload).eq("id", 1);
  if (error) {
    showToast("Couldn't save settings");
    return;
  }
  showToast("Settings saved");
  applyAccentColor(payload.accent_color);
  await loadSettingsIntoPanel();
  await loadAdminPosts();
});

// ---------- init ----------
async function init() {
  await loadSettingsIntoPanel();
  await loadAdminPosts();
}
