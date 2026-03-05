const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const JWT_SECRET = process.env.JWT_SECRET || "fullhub_dev_secret_change_me";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "fullhub.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

function monthISO(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 7);
}
function dateISO(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function monthBounds(month) {
  const [year, m] = month.split("-").map(Number);
  const from = `${year}-${String(m).padStart(2, "0")}-01`;
  const to = dateISO(new Date(year, m, 0));
  return { from, to };
}

function buildBaseData() {
  return {
    dictionaries: {
      positions: ["Грузчик", "Кладовщик", "Упаковщик", "Водитель"],
      payForms: ["Сдельная", "Часовая", "Оклад"],
      departments: ["Отдел Упаковки", "Склад Самара", "Склад Тольятти", "Водители"],
      schedules: [
        "5/2 (с понедельника по пятницу)",
        "5/2 (со вторника по субботу)",
        "5/2 (с понедельника по пятницу - свободный)",
        "подработка"
      ]
    },
    users: [
      {
        id: crypto.randomUUID(),
        role: "admin",
        lastName: "Админов",
        firstName: "Иван",
        middleName: "Иванович",
        position: "Управляющий",
        employmentType: "Официально",
        payForm: "Оклад",
        schedule: "5/2 (с понедельника по пятницу)",
        hourlyRate: 0,
        monthlySalary: 120000,
        department: "Офис",
        phone: "79990000000",
        password: "admin123",
        birthDate: ""
      },
      {
        id: crypto.randomUUID(),
        role: "employee",
        lastName: "Фролов",
        firstName: "Павел",
        middleName: "Олегович",
        position: "Грузчик",
        employmentType: "Официально",
        payForm: "Оклад",
        schedule: "5/2 (с понедельника по пятницу)",
        hourlyRate: 0,
        monthlySalary: 55000,
        department: "Склад Самара",
        phone: "79990000001",
        password: "user123",
        birthDate: ""
      }
    ],
    shifts: [],
    payouts: [],
    adjustments: [],
    workDaysByMonth: {
      [monthISO(new Date())]: 20
    },
    financeFilter: {
      month: monthISO(new Date()),
      from: monthBounds(monthISO(new Date())).from,
      to: monthBounds(monthISO(new Date())).to,
      department: "Все отделы",
      employeeId: "all"
    },
    analyticsFilter: {
      from: monthBounds(monthISO(new Date())).from,
      to: monthBounds(monthISO(new Date())).to,
      department: "Все отделы",
      employeeId: "all"
    },
    openShiftsFilter: {
      mode: "day",
      day: dateISO(new Date()),
      from: dateISO(new Date()),
      to: dateISO(new Date())
    },
    holidayDays: [],
    autoFineSettings: {
      windowStart: "08:00",
      windowEnd: "08:50",
      perMinute: 20
    }
  };
}

function normalizeData(data) {
  const base = buildBaseData();
  const out = data && typeof data === "object" ? data : {};
  out.dictionaries = out.dictionaries || base.dictionaries;
  if (!out.dictionaries.payForms?.includes("Оклад")) out.dictionaries.payForms.push("Оклад");
  out.dictionaries.schedules = Array.isArray(out.dictionaries.schedules) && out.dictionaries.schedules.length
    ? out.dictionaries.schedules
    : base.dictionaries.schedules;
  out.users = Array.isArray(out.users) ? out.users : base.users;
  out.users.forEach((u) => {
    if (!u.id) u.id = crypto.randomUUID();
    if (!u.employmentType) u.employmentType = "Неофициально";
    if (!u.payForm) u.payForm = "Часовая";
    if (u.monthlySalary == null) u.monthlySalary = 0;
    if (u.hourlyRate == null) u.hourlyRate = 0;
    if (!u.birthDate) u.birthDate = "";
    if (!u.schedule) u.schedule = "5/2 (с понедельника по пятницу)";
  });
  out.shifts = Array.isArray(out.shifts) ? out.shifts : [];
  out.shifts.forEach((s) => {
    if (!s.id) s.id = crypto.randomUUID();
    if (!s.actualStart) s.actualStart = "";
    if (!s.actualEnd) s.actualEnd = "";
  });
  out.payouts = Array.isArray(out.payouts) ? out.payouts : [];
  out.adjustments = Array.isArray(out.adjustments) ? out.adjustments : [];
  out.workDaysByMonth = out.workDaysByMonth || {};
  if (!out.financeFilter?.month) out.financeFilter = base.financeFilter;
  if (!out.analyticsFilter?.from) out.analyticsFilter = base.analyticsFilter;
  if (!out.openShiftsFilter?.mode) out.openShiftsFilter = base.openShiftsFilter;
  out.holidayDays = Array.isArray(out.holidayDays) ? out.holidayDays : [];
  out.autoFineSettings = out.autoFineSettings || base.autoFineSettings;
  return out;
}

function getState() {
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get();
  if (!row) {
    const payload = normalizeData(buildBaseData());
    db.prepare("INSERT INTO app_state (id, payload, updated_at) VALUES (1, ?, ?)")
      .run(JSON.stringify(payload), new Date().toISOString());
    return payload;
  }
  try {
    return normalizeData(JSON.parse(row.payload));
  } catch {
    const payload = normalizeData(buildBaseData());
    db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
      .run(JSON.stringify(payload), new Date().toISOString());
    return payload;
  }
}

function saveState(data) {
  const payload = normalizeData(data);
  db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(payload), new Date().toISOString());
  return payload;
}

getState();

const app = express();
app.use(express.json({ limit: "5mb" }));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.post("/api/auth/login", (req, res) => {
  const { phone, password } = req.body || {};
  const state = getState();
  const user = state.users.find((u) => String(u.phone) === String(phone || "").trim() && String(u.password) === String(password || ""));
  if (!user) return res.status(401).json({ error: "Неверный логин или пароль" });
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, user });
});

app.get("/api/auth/me", auth, (req, res) => {
  const state = getState();
  const user = state.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user });
});

app.get("/api/state", auth, (req, res) => {
  const state = getState();
  res.json({ data: state });
});

app.put("/api/state", auth, (req, res) => {
  const nextData = req.body?.data;
  if (!nextData || typeof nextData !== "object") return res.status(400).json({ error: "Invalid payload" });
  const saved = saveState(nextData);
  res.json({ ok: true, data: saved });
});

app.post("/api/reset", (req, res) => {
  const payload = normalizeData(buildBaseData());
  db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(payload), new Date().toISOString());
  res.json({ ok: true });
});

app.use(express.static(__dirname));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`FullHub server started on http://0.0.0.0:${PORT}`);
});
