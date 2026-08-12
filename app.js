const DB_KEYS = {
  lost: "apollo_lost_items",
  found: "apollo_found_items",
  session: "apollo_session",
};
function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function readSession() {
  try { return JSON.parse(localStorage.getItem(DB_KEYS.session) || "{}"); } catch { return {}; }
}
function writeSession(value) {
  localStorage.setItem(DB_KEYS.session, JSON.stringify(value));
}
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
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
  const map = {
    Book: "📚",
    Wallet: "💳",
    Phone: "📱",
    "ID Card": "🪪",
    Electronics: "💻",
    Other: "🎒",
  };
  return map[cat] || "🎒";
}
function fileToDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
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
  const img = await fileToDataUrl(file);
  const items = read(DB_KEYS.lost);
  items.push({
    id: uid(),
    name,
    roll,
    contact,
    category,
    desc,
    location,
    date,
    img,
    approved: false,
    type: "lost",
    createdAt: Date.now(),
  });
  write(DB_KEYS.lost, items);
  form.reset();
  showToast("Lost item reported successfully");
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
  const img = await fileToDataUrl(file);
  const items = read(DB_KEYS.found);
  items.push({
    id: uid(),
    name,
    roll,
    contact,
    category,
    desc,
    location,
    date,
    img,
    approved: false,
    type: "found",
    createdAt: Date.now(),
  });
  write(DB_KEYS.found, items);
  form.reset();
  showToast("Found item reported successfully");
}
function renderListings() {
  const target = document.getElementById("listings");
  if (!target) return;
  const q = document.getElementById("search_q")?.value || "";
  const cat = document.getElementById("filter_category")?.value || "";
  const loc = document.getElementById("filter_location")?.value || "";
  const date = document.getElementById("filter_date")?.value || "";
  const lost = read(DB_KEYS.lost);
  const approvedLost = lost.filter(i => i.approved);
  let list = approvedLost;
  list = list.filter(i => {
    const matchQ = !q || (i.desc.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()) || i.location.toLowerCase().includes(q.toLowerCase()));
    const matchCat = !cat || i.category === cat;
    const matchLoc = !loc || i.location === loc;
    const matchDate = !date || i.date === date;
    return matchQ && matchCat && matchLoc && matchDate;
  });
  target.innerHTML = "";
  if (!list.length) {
    target.innerHTML = `<div class="guidelines">No items found. Try changing filters.</div>`;
    return;
  }
  for (const item of list) {
    const img = item.img ? `<img src="${item.img}" alt="${item.category}" />` : `<div class="card-img">${categoryIcon(item.category)}</div>`;
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
function ensureSeed() {
  const lost = read(DB_KEYS.lost);
  if (!lost.length) {
    write(DB_KEYS.lost, [
      { id: uid(), name: "Riya", roll: "21CS123", contact: "riya@apollo.edu.in", category: "Book", desc: "Data Structures textbook", location: "Library", date: "2026-01-10", img: "", approved: true, type: "lost", createdAt: Date.now() },
      { id: uid(), name: "Arjun", roll: "20EE089", contact: "9876543210", category: "Wallet", desc: "Brown leather wallet", location: "Cafeteria", date: "2026-01-20", img: "", approved: true, type: "lost", createdAt: Date.now() }
    ]);
  }
}
function loginDialog() {
  const email = prompt("Enter your university email");
  if (!email) return;
  if (!isApolloEmail(email)) { showToast("Use your university email"); return; }
  writeSession({ email });
  showToast("Logged in");
  const el = document.getElementById("login_state");
  if (el) el.textContent = email;
}
function initNav() {
  const btn = document.getElementById("login_btn");
  if (btn) btn.addEventListener("click", loginDialog);
  const session = readSession();
  const el = document.getElementById("login_state");
  if (el) el.textContent = session.email || "Guest";
}
function renderAdmin() {
  const target = document.getElementById("admin_list");
  if (!target) return;
  const lost = read(DB_KEYS.lost);
  const found = read(DB_KEYS.found);
  const all = [...lost, ...found].sort((a,b)=>b.createdAt-a.createdAt);
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
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      const lost = read(DB_KEYS.lost);
      const found = read(DB_KEYS.found);
      let changed = false;
      for (const i of lost) { if (i.id === id) { i.approved = !i.approved; changed = true; } }
      for (const i of found) { if (i.id === id) { i.approved = !i.approved; changed = true; } }
      if (changed) {
        write(DB_KEYS.lost, lost);
        write(DB_KEYS.found, found);
        renderAdmin();
        showToast("Moderation updated");
      }
    });
  });
}
function initTheme() {
  const savedTheme = localStorage.getItem("apollo_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const btn = document.getElementById("theme_toggle");
  if (btn) btn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("apollo_theme", next);
      btn.textContent = next === "dark" ? "☀️" : "🌙";
      showToast(`Switched to ${next} mode`);
    });
  }
}

function init() {
  initTheme();
  initNav();
  ensureSeed();
  const lf = document.getElementById("lost_form");
  if (lf) lf.addEventListener("submit", handleLostSubmit);
  const ff = document.getElementById("found_form");
  if (ff) ff.addEventListener("submit", handleFoundSubmit);
  bindFilters();
  renderListings();
  renderAdmin();
}
document.addEventListener("DOMContentLoaded", init);
