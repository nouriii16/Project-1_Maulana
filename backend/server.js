import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { DatabaseSync } from "node:sqlite"; // SQLite bawaan Node.js, tanpa install tambahan

const { JWT_SECRET, PORT = 3001, FRONTEND_ORIGIN = "http://localhost:5173" } = process.env;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET belum diatur atau kurang dari 32 karakter. Lihat .env.example.");
  process.exit(1);
}

// ---------- database (file data.db dibuat otomatis) ----------
const db = new DatabaseSync("data.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
const cariEmail = db.prepare("SELECT * FROM users WHERE email = ?");
const cariId = db.prepare("SELECT id, email, created_at FROM users WHERE id = ?");
const tambahUser = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");

// ---------- aplikasi ----------
const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

// Batasi percobaan login/daftar agar sulit ditebak paksa (brute force)
const batasAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { pesan: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." },
});

const emailValid = (e) =>
  typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// bcrypt hanya membaca 72 byte pertama, jadi sandi dibatasi 72 karakter
const sandiValid = (s) => typeof s === "string" && s.length >= 6 && s.length <= 72;

const buatToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

// Hash palsu: dipakai agar waktu respons sama baik email ada maupun tidak
const HASH_PALSU = bcrypt.hashSync("sandi-palsu-untuk-menyamakan-waktu", 12);

// ---------- rute ----------
app.post("/api/register", batasAuth, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const sandi = req.body?.password;

  if (!emailValid(email)) return res.status(400).json({ pesan: "Format email tidak valid." });
  if (!sandiValid(sandi))
    return res.status(400).json({ pesan: "Kata sandi harus 6 sampai 72 karakter." });
  if (cariEmail.get(email)) return res.status(409).json({ pesan: "Email sudah terdaftar." });

  const hash = await bcrypt.hash(sandi, 12);
  const { lastInsertRowid } = tambahUser.run(email, hash);
  const user = { id: Number(lastInsertRowid), email };
  res.status(201).json({ token: buatToken(user), user });
});

app.post("/api/login", batasAuth, async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const sandi = req.body?.password;

  if (!emailValid(email) || typeof sandi !== "string")
    return res.status(400).json({ pesan: "Email atau kata sandi tidak valid." });

  const user = cariEmail.get(email);
  const cocok = await bcrypt.compare(sandi, user?.password_hash ?? HASH_PALSU);

  // Pesan sengaja sama untuk email salah dan sandi salah
  if (!user || !cocok) return res.status(401).json({ pesan: "Email atau kata sandi salah." });

  res.json({ token: buatToken(user), user: { id: user.id, email: user.email } });
});

// Middleware: halaman yang butuh login
const wajibLogin = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ pesan: "Sesi tidak valid atau sudah berakhir. Silakan masuk lagi." });
  }
};

app.get("/api/me", wajibLogin, (req, res) => {
  const user = cariId.get(req.userId);
  if (!user) return res.status(404).json({ pesan: "Akun tidak ditemukan." });
  res.json({ user });
});

// JSON rusak dan error tak terduga
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ pesan: "Format data salah." });
  console.error(err);
  res.status(500).json({ pesan: "Terjadi kesalahan di server." });
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));