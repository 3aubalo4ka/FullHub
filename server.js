const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const PORT = Number(process.env.PORT || 4173);
const JWT_SECRET = process.env.JWT_SECRET || "";
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "fullhub.db");
const PASSWORD_SENTINEL = "__HASHED__";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET is required and must be at least 32 characters.");
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

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
function nowIso() {
  return new Date().toISOString();
}

const MIGRATIONS = [
  {
    id: "001_init",
    up: () => {
      db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        last_name TEXT NOT NULL,
        first_name TEXT NOT NULL,
        middle_name TEXT NOT NULL,
        position TEXT NOT NULL,
        employment_type TEXT NOT NULL,
        pay_form TEXT NOT NULL,
        schedule TEXT NOT NULL,
        hourly_rate REAL NOT NULL DEFAULT 0,
        monthly_salary REAL NOT NULL DEFAULT 0,
        department TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        birth_date TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dictionaries (
        dkey TEXT NOT NULL,
        dvalue TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        PRIMARY KEY (dkey, dvalue)
      );
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start TEXT NOT NULL DEFAULT '',
        "end" TEXT NOT NULL DEFAULT '',
        piece_amount REAL NOT NULL DEFAULT 0,
        actual_start TEXT NOT NULL DEFAULT '',
        actual_end TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS adjustments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        kind TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        auto_fine INTEGER NOT NULL DEFAULT 0,
        source_shift_id TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        skey TEXT PRIMARY KEY,
        svalue TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS holiday_days (
        day TEXT PRIMARY KEY
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
      );
      `);
    },
  },
];

function runMigrations() {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
  const has = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?");
  const insert = db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
  MIGRATIONS.forEach((m) => {
    if (!has.get(m.id)) {
      const tx = db.transaction(() => {
        m.up();
        insert.run(m.id, nowIso());
      });
      tx();
    }
  });
}

function logAudit(actorUserId, action, entity, entityId, payload) {
  const prev = db.prepare("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1").get();
  const prevHash = prev?.hash || "GENESIS";
  const record = `${nowIso()}|${actorUserId || "system"}|${action}|${entity}|${entityId}|${JSON.stringify(payload)}|${prevHash}`;
  const hash = crypto.createHash("sha256").update(record).digest("hex");
  db.prepare(`
    INSERT INTO audit_log (created_at, actor_user_id, action, entity, entity_id, payload_json, prev_hash, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nowIso(), actorUserId || null, action, entity, entityId, JSON.stringify(payload || {}), prevHash, hash);
}

function baseSeedData() {
  return {
    dictionaries: {
      positions: ["Грузчик", "Кладовщик", "Упаковщик", "Водитель"],
      payForms: ["Сдельная", "Часовая", "Оклад"],
      departments: ["Отдел Упаковки", "Склад Самара", "Склад Тольятти", "Водители"],
      schedules: [
        "5/2 (с понедельника по пятницу)",
        "5/2 (со вторника по субботу)",
        "5/2 (с понедельника по пятницу - свободный)",
        "подработка",
      ],
    },
    users: [
      {
        id: crypto.randomUUID(), role: "admin", lastName: "Смирнов", firstName: "Андрей", middleName: "Игоревич",
        position: "Управляющий", employmentType: "Официально", payForm: "Оклад", schedule: "5/2 (с понедельника по пятницу)",
        hourlyRate: 0, monthlySalary: 120000, department: "Офис", phone: "79991112233", password: "Adm!n-FullHub-2026", birthDate: "",
      },
      {
        id: crypto.randomUUID(), role: "employee", lastName: "Ковалёв", firstName: "Павел", middleName: "Олегович",
        position: "Грузчик", employmentType: "Официально", payForm: "Оклад", schedule: "5/2 (с понедельника по пятницу)",
        hourlyRate: 0, monthlySalary: 55000, department: "Склад Самара", phone: "79992223344", password: "User-FullHub-2026!", birthDate: "",
      },
    ],
    shifts: [], payouts: [], adjustments: [], holidayDays: [],
    workDaysByMonth: { [monthISO(new Date())]: 20 },
    financeFilter: { month: monthISO(new Date()), from: monthBounds(monthISO(new Date())).from, to: monthBounds(monthISO(new Date())).to, department: "Все отделы", employeeId: "all" },
    analyticsFilter: { from: monthBounds(monthISO(new Date())).from, to: monthBounds(monthISO(new Date())).to, department: "Все отделы", employeeId: "all" },
    openShiftsFilter: { mode: "day", day: dateISO(new Date()), from: dateISO(new Date()), to: dateISO(new Date()) },
    autoFineSettings: { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 },
  };
}

function replaceStateFromPayload(payload) {
  const tx = db.transaction((p) => {
    db.exec("DELETE FROM dictionaries; DELETE FROM shifts; DELETE FROM payouts; DELETE FROM adjustments; DELETE FROM holiday_days;");

    const existingHashes = new Map(db.prepare("SELECT id, password_hash FROM users").all().map((x) => [x.id, x.password_hash]));
    db.exec("DELETE FROM users;");

    const insUser = db.prepare(`
      INSERT INTO users (id, role, last_name, first_name, middle_name, position, employment_type, pay_form, schedule, hourly_rate, monthly_salary, department, phone, password_hash, birth_date, created_at, updated_at)
      VALUES (@id,@role,@last_name,@first_name,@middle_name,@position,@employment_type,@pay_form,@schedule,@hourly_rate,@monthly_salary,@department,@phone,@password_hash,@birth_date,@created_at,@updated_at)
    `);

    for (const u of p.users || []) {
      const pwd = String(u.password || "");
      const prevHash = existingHashes.get(u.id) || "";
      const passwordHash = pwd === PASSWORD_SENTINEL && prevHash ? prevHash : bcrypt.hashSync(pwd || crypto.randomUUID(), 10);
      insUser.run({
        id: u.id || crypto.randomUUID(), role: u.role || "employee",
        last_name: u.lastName || "", first_name: u.firstName || "", middle_name: u.middleName || "",
        position: u.position || "", employment_type: u.employmentType || "Неофициально", pay_form: u.payForm || "Часовая",
        schedule: u.schedule || "5/2 (с понедельника по пятницу)", hourly_rate: Number(u.hourlyRate || 0), monthly_salary: Number(u.monthlySalary || 0),
        department: u.department || "", phone: String(u.phone || ""), password_hash: passwordHash, birth_date: u.birthDate || "",
        created_at: nowIso(), updated_at: nowIso(),
      });
    }

    const insDict = db.prepare("INSERT INTO dictionaries (dkey, dvalue, sort_order) VALUES (?, ?, ?)");
    ["positions", "payForms", "departments", "schedules"].forEach((k) => {
      (p.dictionaries?.[k] || []).forEach((v, i) => insDict.run(k, String(v), i));
    });

    const insShift = db.prepare('INSERT INTO shifts (id, date, user_id, start, "end", piece_amount, actual_start, actual_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    (p.shifts || []).forEach((s) => insShift.run(s.id || crypto.randomUUID(), s.date || "", s.userId || "", s.start || "", s.end || "", Number(s.pieceAmount || 0), s.actualStart || "", s.actualEnd || ""));

    const insPayout = db.prepare("INSERT INTO payouts (id, user_id, month, amount, type, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)");
    (p.payouts || []).forEach((x) => insPayout.run(x.id || crypto.randomUUID(), x.userId || "", x.month || monthISO(new Date()), Number(x.amount || 0), x.type || "Вне графика", x.date || dateISO(new Date()), x.note || ""));

    const insAdj = db.prepare("INSERT INTO adjustments (id, user_id, month, kind, amount, note, auto_fine, source_shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    (p.adjustments || []).forEach((a) => insAdj.run(a.id || crypto.randomUUID(), a.userId || "", a.month || monthISO(new Date()), a.kind || "fine", Number(a.amount || 0), a.note || "", a.autoFine ? 1 : 0, a.sourceShiftId || "", a.createdAt || nowIso()));

    const insHoliday = db.prepare("INSERT OR IGNORE INTO holiday_days (day) VALUES (?)");
    (p.holidayDays || []).forEach((d) => insHoliday.run(d));

    const insSetting = db.prepare("INSERT OR REPLACE INTO settings (skey, svalue) VALUES (?, ?)");
    insSetting.run("workDaysByMonth", JSON.stringify(p.workDaysByMonth || {}));
    insSetting.run("financeFilter", JSON.stringify(p.financeFilter || {}));
    insSetting.run("analyticsFilter", JSON.stringify(p.analyticsFilter || {}));
    insSetting.run("openShiftsFilter", JSON.stringify(p.openShiftsFilter || {}));
    insSetting.run("autoFineSettings", JSON.stringify(p.autoFineSettings || { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 }));
  });
  tx(payload);
}

function readState() {
  const dictRows = db.prepare("SELECT dkey, dvalue, sort_order FROM dictionaries ORDER BY dkey, sort_order").all();
  const dictionaries = { positions: [], payForms: [], departments: [], schedules: [] };
  dictRows.forEach((r) => { if (!dictionaries[r.dkey]) dictionaries[r.dkey] = []; dictionaries[r.dkey].push(r.dvalue); });

  const users = db.prepare("SELECT * FROM users").all().map((u) => ({
    id: u.id, role: u.role, lastName: u.last_name, firstName: u.first_name, middleName: u.middle_name,
    position: u.position, employmentType: u.employment_type, payForm: u.pay_form, schedule: u.schedule,
    hourlyRate: Number(u.hourly_rate || 0), monthlySalary: Number(u.monthly_salary || 0), department: u.department,
    phone: u.phone, password: PASSWORD_SENTINEL, birthDate: u.birth_date || "",
  }));

  const shifts = db.prepare('SELECT id, date, user_id, start, "end", piece_amount, actual_start, actual_end FROM shifts').all().map((s) => ({
    id: s.id, date: s.date, userId: s.user_id, start: s.start || "", end: s.end || "", pieceAmount: Number(s.piece_amount || 0), actualStart: s.actual_start || "", actualEnd: s.actual_end || "",
  }));

  const payouts = db.prepare("SELECT * FROM payouts").all().map((p) => ({ id: p.id, userId: p.user_id, month: p.month, amount: Number(p.amount || 0), type: p.type, date: p.date, note: p.note || "" }));
  const adjustments = db.prepare("SELECT * FROM adjustments").all().map((a) => ({
    id: a.id, userId: a.user_id, month: a.month, kind: a.kind, amount: Number(a.amount || 0), note: a.note || "", autoFine: !!a.auto_fine, sourceShiftId: a.source_shift_id || "", createdAt: a.created_at || "",
  }));
  const holidayDays = db.prepare("SELECT day FROM holiday_days ORDER BY day").all().map((r) => r.day);
  const settingsRows = db.prepare("SELECT skey, svalue FROM settings").all();
  const settings = Object.fromEntries(settingsRows.map((r) => [r.skey, JSON.parse(r.svalue)]));

  return {
    dictionaries,
    users,
    shifts,
    payouts,
    adjustments,
    workDaysByMonth: settings.workDaysByMonth || {},
    financeFilter: settings.financeFilter || { month: monthISO(new Date()), ...monthBounds(monthISO(new Date())), department: "Все отделы", employeeId: "all" },
    analyticsFilter: settings.analyticsFilter || { ...monthBounds(monthISO(new Date())), department: "Все отделы", employeeId: "all" },
    openShiftsFilter: settings.openShiftsFilter || { mode: "day", day: dateISO(new Date()), from: dateISO(new Date()), to: dateISO(new Date()) },
    holidayDays,
    autoFineSettings: settings.autoFineSettings || { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 },
  };
}

function ensureSeedData() {
  const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (usersCount > 0) return;
  replaceStateFromPayload(baseSeedData());
}

function nowTimeHHMM() { return new Date().toTimeString().slice(0, 5); }
function maxTimeHHMM(a, b) { return a >= b ? a : b; }
function normalizeCheckInTime(timeHHMM) { return maxTimeHHMM(String(timeHHMM || "09:00"), "09:00"); }

function applyAttendanceMarkForUser(userId) {
  const state = readState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return { message: "Пользователь не найден.", state };

  let shift = state.shifts.find((s) => s.userId === userId && s.date === dateISO(new Date()));
  const schedule = String(user.schedule || "");
  if (!shift && schedule === "подработка") {
    shift = { id: crypto.randomUUID(), date: dateISO(new Date()), userId, start: "", end: "", pieceAmount: 0, actualStart: "", actualEnd: "" };
    state.shifts.push(shift);
  }
  if (!shift) return { message: "На сегодня вам не назначена смена.", state };

  const now = nowTimeHHMM();
  if (!shift.actualStart) {
    shift.actualStart = now;
    const effectiveStart = normalizeCheckInTime(now);
    shift.start = effectiveStart;
    replaceStateFromPayload(state);
    return { message: `Начало смены зафиксировано: ${now}${effectiveStart !== now ? ` (в расчет пошло ${effectiveStart})` : ""}`, state: readState() };
  }
  if (!shift.actualEnd) {
    shift.actualEnd = now;
    shift.end = now;
    replaceStateFromPayload(state);
    return { message: `Окончание смены зафиксировано: ${now}`, state: readState() };
  }
  return { message: `Смена уже закрыта (${shift.actualStart} - ${shift.actualEnd}).`, state };
}

runMigrations();
ensureSeedData();

const app = express();
app.use(express.json({ limit: "5mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const line = `${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms\n`;
    fs.appendFile(path.join(DATA_DIR, "access.log"), line, () => {});
  });
  next();
});

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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

app.get("/api/health", (req, res) => res.json({ ok: true, ts: nowIso() }));

app.post("/api/auth/login", (req, res) => {
  const { phone, password } = req.body || {};
  const row = db.prepare("SELECT * FROM users WHERE phone = ?").get(String(phone || "").trim());
  if (!row || !bcrypt.compareSync(String(password || ""), row.password_hash)) {
    logAudit(null, "login_failed", "auth", String(phone || ""), {});
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }
  const user = {
    id: row.id, role: row.role, lastName: row.last_name, firstName: row.first_name, middleName: row.middle_name,
    position: row.position, employmentType: row.employment_type, payForm: row.pay_form, schedule: row.schedule,
    hourlyRate: Number(row.hourly_rate || 0), monthlySalary: Number(row.monthly_salary || 0), department: row.department,
    phone: row.phone, password: PASSWORD_SENTINEL, birthDate: row.birth_date || "",
  };
  const token = jwt.sign({ id: row.id, role: row.role }, JWT_SECRET, { expiresIn: "12h" });
  logAudit(row.id, "login_success", "auth", row.id, { role: row.role });
  res.json({ token, user });
});

app.get("/api/auth/me", auth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!row) return res.status(401).json({ error: "Unauthorized" });
  res.json({ user: { id: row.id, role: row.role, lastName: row.last_name, firstName: row.first_name, middleName: row.middle_name, position: row.position, employmentType: row.employment_type, payForm: row.pay_form, schedule: row.schedule, hourlyRate: Number(row.hourly_rate || 0), monthlySalary: Number(row.monthly_salary || 0), department: row.department, phone: row.phone, password: PASSWORD_SENTINEL, birthDate: row.birth_date || "" } });
});

app.get("/api/state", auth, (req, res) => {
  const state = readState();
  if (req.user.role !== "admin") {
    const uid = req.user.id;
    state.users = state.users.filter((u) => u.id === uid);
    state.shifts = state.shifts.filter((s) => s.userId === uid);
    state.payouts = state.payouts.filter((p) => p.userId === uid);
    state.adjustments = state.adjustments.filter((a) => a.userId === uid);
  }
  res.json({ data: state });
});

app.put("/api/state", auth, requireRole("admin"), (req, res) => {
  const nextData = req.body?.data;
  if (!nextData || typeof nextData !== "object") return res.status(400).json({ error: "Invalid payload" });
  replaceStateFromPayload(nextData);
  logAudit(req.user.id, "state_update", "app_state", "singleton", { by: req.user.role });
  res.json({ ok: true, data: readState() });
});

app.post("/api/attendance/mark", auth, (req, res) => {
  const userId = req.user.role === "admin" ? String(req.body?.userId || req.user.id) : req.user.id;
  const result = applyAttendanceMarkForUser(userId);
  logAudit(req.user.id, "attendance_mark", "user", userId, { message: result.message });
  const data = req.user.role === "admin" ? result.state : { ...result.state, users: result.state.users.filter((u) => u.id === req.user.id), shifts: result.state.shifts.filter((s) => s.userId === req.user.id), payouts: result.state.payouts.filter((p) => p.userId === req.user.id), adjustments: result.state.adjustments.filter((a) => a.userId === req.user.id) };
  res.json({ message: result.message, data });
});

app.post("/api/reset", auth, requireRole("admin"), (req, res) => {
  const allow = String(process.env.RESET_IP_ALLOWLIST || "").split(",").map((x) => x.trim()).filter(Boolean);
  const ip = req.ip || req.connection.remoteAddress || "";
  if (allow.length && !allow.includes(ip)) return res.status(403).json({ error: "IP is not allowed for reset" });
  replaceStateFromPayload(baseSeedData());
  logAudit(req.user.id, "reset", "app_state", "singleton", { ip });
  res.json({ ok: true });
});

app.use(express.static(__dirname));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
  console.log(`FullHub server started on http://0.0.0.0:${PORT}`);
});
