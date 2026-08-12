const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-me";
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
const lostPath = path.join(DATA_DIR, "lost.json");
const foundPath = path.join(DATA_DIR, "found.json");
if (!fs.existsSync(lostPath)) fs.writeFileSync(lostPath, "[]");
if (!fs.existsSync(foundPath)) fs.writeFileSync(foundPath, "[]");

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return []; }
}
function writeJSON(p, v) {
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
}
function isPhone(v) {
  return /^[0-9]{10}$/.test(String(v || "").replace(/\D/g, ""));
}
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/", express.static(__dirname));

app.get("/", (_, res) => res.json({ ok: true, name: "The Apollo University Lost & Found API" }));

// Submit Lost Item
app.post("/api/lost", upload.single("image"), (req, res) => {
  const { name, roll, contact, category, desc, location, date } = req.body || {};
  if (!name || !roll || !contact || !category || !desc || !location || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!isEmail(contact) && !isPhone(contact)) {
    return res.status(400).json({ error: "Invalid contact" });
  }
  const list = readJSON(lostPath);
  const item = {
    id: uuidv4(),
    name,
    roll,
    contact,
    category,
    desc,
    location,
    date,
    img: req.file ? `/uploads/${req.file.filename}` : "",
    approved: false,
    type: "lost",
    createdAt: Date.now(),
  };
  list.push(item);
  writeJSON(lostPath, list);
  res.json({ ok: true, item });
});

// Submit Found Item
app.post("/api/found", upload.single("image"), (req, res) => {
  const { name, roll, contact, category, desc, location, date } = req.body || {};
  if (!name || !contact || !category || !desc || !location || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!isEmail(contact) && !isPhone(contact)) {
    return res.status(400).json({ error: "Invalid contact" });
  }
  const list = readJSON(foundPath);
  const item = {
    id: uuidv4(),
    name,
    roll,
    contact,
    category,
    desc,
    location,
    date,
    img: req.file ? `/uploads/${req.file.filename}` : "",
    approved: false,
    type: "found",
    createdAt: Date.now(),
  };
  list.push(item);
  writeJSON(foundPath, list);
  res.json({ ok: true, item });
});

// List Lost Items (approved only) with filters
app.get("/api/lost", (req, res) => {
  const q = String(req.query.q || "").toLowerCase();
  const category = req.query.category || "";
  const location = req.query.location || "";
  const date = req.query.date || "";
  let list = readJSON(lostPath).filter(i => i.approved);
  list = list.filter(i => {
    const matchQ = !q || (i.desc.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.location.toLowerCase().includes(q));
    const matchCat = !category || i.category === category;
    const matchLoc = !location || i.location === location;
    const matchDate = !date || i.date === date;
    return matchQ && matchCat && matchLoc && matchDate;
  });
  res.json({ ok: true, items: list });
});

// Admin: list all submissions
app.get("/api/admin/items", (req, res) => {
  const lost = readJSON(lostPath);
  const found = readJSON(foundPath);
  const all = [...lost, ...found].sort((a, b) => b.createdAt - a.createdAt);
  res.json({ ok: true, items: all });
});

// Admin: approve/revoke by id
app.patch("/api/moderate/:id", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const id = req.params.id;
  const body = req.body || {};
  const setApproved = typeof body.approved === "boolean" ? body.approved : undefined;
  let changed = false;
  const lost = readJSON(lostPath);
  const found = readJSON(foundPath);
  for (const i of lost) {
    if (i.id === id) { i.approved = setApproved !== undefined ? setApproved : !i.approved; changed = true; }
  }
  for (const i of found) {
    if (i.id === id) { i.approved = setApproved !== undefined ? setApproved : !i.approved; changed = true; }
  }
  if (!changed) return res.status(404).json({ error: "Not found" });
  writeJSON(lostPath, lost);
  writeJSON(foundPath, found);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`The Apollo University Lost & Found API running at http://localhost:${PORT}/`);
  console.log(`Admin moderation requires x-admin-key header. Configure ADMIN_KEY env.`);
});
