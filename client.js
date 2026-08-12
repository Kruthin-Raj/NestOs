const API_BASE = "http://localhost:3000";
const ADMIN_KEY = "change-me";
function showToast(message) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = message;
  t.style.display = "block";
  setTimeout(() => { t.style.display = "none"; }, 2500);
}
function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}
function isApolloEmail(value) {
  return /@(apollo\.edu(\.in)?|apollo\.ac\.in|gla(\.ac)?\.in)$/i.test(value || "");
}
function isPhone(value) {
  return /^[0-9]{10}$/.test((value || "").replace(/\D/g, ""));
}
function validate(fields) {
  for (const f of fields) {
    if (!f.value || !String(f.value).trim()) return false;
  }
  return true;
}
function categoryIcon(cat) {
  const map = { Book: "📚", Wallet: "💳", Phone: "📱", "ID Card": "🪪", Electronics: "💻", Other: "🎒" };
  return map[cat] || "🎒";
}
function resolveImage(src) {
  if (!src) return "";
  if (src.startsWith("/uploads/")) return API_BASE + src;
  return src;
}
async function handleLostSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector("#lost_name").value;
  const roll = form.querySelector("#lost_roll").value;
  const contact = form.querySelector("#lost_contact").value;
  const category = form.querySelector("#lost_category").value;
  const desc = form.querySelector("#lost_desc").value;
  const location = form.querySelector("#lost_location").value;
  const date = form.querySelector("#lost_date").value;
  const file = form.querySelector("#lost_image").files[0];
  const ok = validate([{ value: name }, { value: roll }, { value: contact }, { value: category }, { value: desc }, { value: location }, { value: date }]);
  if (!ok) { showToast("Please fill all required fields"); return; }
  if (!isEmail(contact) && !isPhone(contact)) { showToast("Enter a valid email or phone"); return; }
  const fd = new FormData();
  fd.append("name", name);
  fd.append("roll", roll);
  fd.append("contact", contact);
  fd.append("category", category);
  fd.append("desc", desc);
  fd.append("location", location);
  fd.append("date", date);
  if (file) fd.append("image", file);
  try {
    const res = await fetch(API_BASE + "/api/lost", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Failed");
    showToast("Lost item reported successfully");
    form.reset();
  } catch {
    showToast("Server error. Please try again.");
  }
}
async function handleFoundSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector("#found_name").value;
  const roll = form.querySelector("#found_roll").value;
  const contact = form.querySelector("#found_contact").value;
  const category = form.querySelector("#found_category").value;
  const desc = form.querySelector("#found_desc").value;
  const location = form.querySelector("#found_location").value;
  const date = form.querySelector("#found_date").value;
  const file = form.querySelector("#found_image").files[0];
  const ok = validate([{ value: name }, { value: contact }, { value: category }, { value: desc }, { value: location }, { value: date }]);
  if (!ok) { showToast("Please fill all required fields"); return; }
  if (!isEmail(contact) && !isPhone(contact)) { showToast("Enter a valid email or phone"); return; }
  const fd = new FormData();
  fd.append("name", name);
  fd.append("roll", roll);
  fd.append("contact", contact);
  fd.append("category", category);
  fd.append("desc", desc);
  fd.append("location", location);
  fd.append("date", date);
  if (file) fd.append("image", file);
  try {
    const res = await fetch(API_BASE + "/api/found", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Failed");
    showToast("Found item reported successfully");
    form.reset();
  } catch {
    showToast("Server error. Please try again.");
  }
}
async function renderListings() {
  const target = document.getElementById("listings");
  if (!target) return;
  const q = document.getElementById("search_q")?.value || "";
  const cat = document.getElementById("filter_category")?.value || "";
  const loc = document.getElementById("filter_location")?.value || "";
  const date = document.getElementById("filter_date")?.value || "";
  let list = [];
  try {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (cat) params.set("category", cat);
    if (loc) params.set("location", loc);
    if (date) params.set("date", date);
    const res = await fetch(API_BASE + "/api/lost?" + params.toString());
    const json = await res.json();
    list = json.items || [];
  } catch { list = []; }
  target.innerHTML = "";
  if (!list.length) {
    target.innerHTML = `<div class="guidelines">No items found. Try changing filters.</div>`;
    return;
  }
  for (const item of list) {
    const imgSrc = resolveImage(item.img);
    const img = imgSrc ? `<img src="${imgSrc}" alt="${item.category}" />` : `<div class="card-img">${categoryIcon(item.category)}</div>`;
    const contactHref = isEmail(item.contact) ? `mailto:${item.contact}` : `tel:${item.contact}`;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${item.img ? `<div class="card-img">${img}</div>` : `${img}`}
      <div class="card-body">
        <div class="card-title">${item.category}</div>
        <div class="card-meta">
          <div>Location: ${item.location}</div>
          <div>Date: ${item.date}</div>
        </div>
        <div class="pill">${item.desc}</div>
        <div class="card-actions">
          <div class="avatar">${(item.name || "S")[0].toUpperCase()}</div>
          <a class="contact-btn" href="${contactHref}">Contact Owner</a>
        </div>
      </div>
    `;
    target.appendChild(card);
  }
}
function bindFilters() {
  const ids = ["search_q", "filter_category", "filter_location", "filter_date"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", renderListings);
  }
}
function loginDialog() {
  const email = prompt("Enter your university email");
  if (!email) return;
  if (!isApolloEmail(email)) { showToast("Use your university email"); return; }
  const el = document.getElementById("login_state");
  if (el) el.textContent = email;
  showToast("Logged in");
}
function initNav() {
  const btn = document.getElementById("login_btn");
  if (btn) btn.addEventListener("click", loginDialog);
}
async function renderAdmin() {
  const target = document.getElementById("admin_list");
  if (!target) return;
  let all = [];
  try {
    const res = await fetch(API_BASE + "/api/admin/items");
    const json = await res.json();
    all = (json.items || []).sort((a,b)=>b.createdAt-a.createdAt);
  } catch { all = []; }
  target.innerHTML = "";
  if (!all.length) {
    target.innerHTML = `<div class="guidelines">No submissions yet.</div>`;
    return;
  }
  for (const item of all) {
    const row = document.createElement("div");
    row.className = "card";
    row.style.padding = "12px";
    row.innerHTML = `
      <div class="card-body">
        <div class="card-title">${item.type === "lost" ? "Lost" : "Found"} • ${item.category}</div>
        <div class="card-meta">
          <div>${item.name} (${item.roll || "N/A"})</div>
          <div>${item.location} • ${item.date}</div>
        </div>
        <div class="pill">${item.desc}</div>
        <div class="card-actions">
          <div>${item.approved ? "Approved" : "Pending"}</div>
          <button class="btn light" data-id="${item.id}">${item.approved ? "Revoke" : "Approve"}</button>
        </div>
      </div>
    `;
    target.appendChild(row);
  }
  target.querySelectorAll("button[data-id]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = btn.getAttribute("data-id");
      try {
        const res = await fetch(API_BASE + "/api/moderate/" + id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
          body: JSON.stringify({})
        });
        if (!res.ok) throw new Error("Fail");
        showToast("Moderation updated");
        renderAdmin();
      } catch { showToast("Moderation failed"); }
    });
  });
}
function initTheme() {
  const savedTheme = localStorage.getItem("apollo_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  const toggleBtn = document.getElementById("theme_toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("apollo_theme", next);
      updateThemeIcon(next);
      showToast(`Switched to ${next} mode`);
    });
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("theme_toggle");
  if (btn) {
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
  }
}

async function loadStats() {
  const statTotal = document.getElementById("stat_total");
  if (!statTotal) return;
  try {
    const res = await fetch(API_BASE + "/api/admin/items");
    const json = await res.json();
    const count = (json.items || []).length;
    statTotal.textContent = count > 0 ? `${count}+` : "15+";
  } catch {
    statTotal.textContent = "15+";
  }
}

function init() {
  initTheme();
  initNav();
  loadStats();
  const lf = document.getElementById("lost_form");
  if (lf) lf.addEventListener("submit", handleLostSubmit);
  const ff = document.getElementById("found_form");
  if (ff) ff.addEventListener("submit", handleFoundSubmit);
  bindFilters();
  renderListings();
  renderAdmin();
}
document.addEventListener("DOMContentLoaded", init);
