const boxes = Array.from(document.querySelectorAll(".passkey-box"));
const errorEl = document.getElementById("loginError");

function currentPasskey() {
  return boxes.map((b) => b.value).join("");
}

async function trySubmit() {
  const passkey = currentPasskey();
  if (passkey.length !== boxes.length) return;

  errorEl.textContent = "";
  boxes.forEach((b) => (b.disabled = true));

  const { error } = await window.sb.auth.signInWithPassword({
    email: window.SUPABASE_CONFIG.adminEmail,
    password: passkey,
  });

  if (error) {
    errorEl.textContent = "Incorrect passkey. Try again.";
    boxes.forEach((b) => {
      b.value = "";
      b.disabled = false;
    });
    boxes[0].focus();
    return;
  }

  window.location.href = "/admin";
}

boxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    box.value = box.value.slice(-1);
    if (box.value && i < boxes.length - 1) {
      boxes[i + 1].focus();
    }
    trySubmit();
  });

  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && i > 0) {
      boxes[i - 1].focus();
    }
  });

  box.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text").trim();
    text.split("").forEach((ch, idx) => {
      if (boxes[idx]) boxes[idx].value = ch;
    });
    const next = Math.min(text.length, boxes.length - 1);
    boxes[next].focus();
    trySubmit();
  });
});

(async function redirectIfLoggedIn() {
  const { data } = await window.sb.auth.getSession();
  if (data.session) {
    window.location.href = "/admin";
  } else {
    boxes[0].focus();
  }
})();
