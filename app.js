const APP_VERSION = "2026.02.27-v4";
const STORAGE_KEY = "fullhub-data-v4";
const AUTH_TOKEN_KEY = "fullhub-auth-token";
const SHIFT_HOURS_STANDARD = 9;
const NDFL_RATE = 0.13;
const ATTENDANCE_QR_PREFIX = "FULLHUB_ATTENDANCE";

const roleClassByPosition = {
  грузчик: "role-loader",
  кладовщик: "role-storekeeper",
  упаковщик: "role-packer",
  водитель: "role-driver",
  Грузчик: "role-loader",
  Кладовщик: "role-storekeeper",
  Упаковщик: "role-packer",
  Водитель: "role-driver",
};

const state = {
  data: emptyData(),
  currentUser: null,
  selectedDate: todayISO(),
  viewMonth: new Date(),
  employeeMonth: monthISO(new Date()),
  financeHistoryUserId: null,
  financeActionUserId: null,
  financeSelectedUserIds: [],
  financeActionMode: "payout",
  openShiftsSelection: [],
  holidayDaysPanelOpen: false,
  finesPanelOpen: false,
  workDaysEditMode: false,
  workDaysYear: new Date().getFullYear(),
  workDaysPanelOpen: false,
  financeHistoryPanelOpen: false,
  dictEditMode: false,
  dictionaryDraft: null,
  shiftGroup: "samara",
  shiftViews: {
    samara_logistics: { month: new Date(), selectedDate: todayISO(), open: false },
    samara_packaging: { month: new Date(), selectedDate: todayISO(), open: false },
    samara_drivers: { month: new Date(), selectedDate: todayISO(), open: false },
    tolyatti: { month: new Date(), selectedDate: todayISO(), open: false },
  },
  employeeFilter: { query: "", department: "all", position: "all" },
  employeeEditMode: false,
  myCabinetPanels: { profile: true, kpi: true, shifts: true, money: true },
};

const el = {
  authShell: document.getElementById("auth-shell"),
  appShell: document.getElementById("app-shell"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  openLoginBtn: document.getElementById("open-login-btn"),
  resetDataBtn: document.getElementById("reset-data-btn"),
  appVersionPill: document.getElementById("app-version-pill"),
  phone: document.getElementById("login-phone"),
  pass: document.getElementById("login-password"),
  userBadge: document.getElementById("user-badge"),
  logout: document.getElementById("logout-btn"),
  adminView: document.getElementById("admin-view"),
  employeeView: document.getElementById("employee-view"),
  employeeForm: document.getElementById("employee-form"),
  employeeCreateCard: document.getElementById("employee-create-card"),
  employeeCreateToggle: document.getElementById("employee-create-toggle"),
  employeesEditToggle: document.getElementById("employees-edit-toggle"),
  employeeFilterForm: document.getElementById("employee-filter-form"),
  birthdayReminderList: document.getElementById("birthday-reminder-list"),
  attendanceQrCanvas: document.getElementById("attendance-qr-canvas"),
  attendanceQrToken: document.getElementById("attendance-qr-token"),
  dictControls: document.getElementById("dictionary-controls"),
  dictEditToggle: document.getElementById("dict-edit-toggle"),
  employeesTable: document.getElementById("employees-table"),
  shiftsBlocks: document.getElementById("shifts-blocks"),
  shiftsPageTitle: document.getElementById("shifts-page-title"),
  financeFilter: document.getElementById("finance-filter"),
  analyticsFilter: document.getElementById("analytics-filter"),
  analyticsKpis: document.getElementById("analytics-kpis"),
  analyticsDeptTable: document.getElementById("analytics-dept-table"),
  analyticsEmployeeTable: document.getElementById("analytics-employee-table"),
  analyticsExportBtn: document.getElementById("analytics-export"),
  financeTable: document.getElementById("finance-table"),
  financeActionsCard: document.getElementById("finance-actions-card"),
  financeActionsTitle: document.getElementById("finance-actions-title"),
  financeActionsForm: document.getElementById("finance-actions-form"),
  openShiftsFilter: document.getElementById("open-shifts-filter"),
  openShiftsTable: document.getElementById("open-shifts-table"),
  openShiftsOpenBtn: document.getElementById("open-shifts-open-btn"),
  openShiftsCloseBtn: document.getElementById("open-shifts-close-btn"),
  openShiftsOpenTime: document.getElementById("open-shifts-open-time"),
  openShiftsCloseTime: document.getElementById("open-shifts-close-time"),
  holidayDaysToggle: document.getElementById("holiday-days-toggle"),
  holidayDaysContent: document.getElementById("holiday-days-content"),
  holidayDaysForm: document.getElementById("holiday-days-form"),
  holidayDaysList: document.getElementById("holiday-days-list"),
  finesToggle: document.getElementById("fines-toggle"),
  finesContent: document.getElementById("fines-content"),
  autoFinesSettings: document.getElementById("auto-fines-settings"),
  finesTable: document.getElementById("fines-table"),
  workDaysBlockToggle: document.getElementById("workdays-block-toggle"),
  workDaysEditToggle: document.getElementById("workdays-edit-toggle"),
  workDaysGrid: document.getElementById("workdays-grid"),
  financeHistoryTitle: document.getElementById("finance-history-title"),
  financeHistoryTable: document.getElementById("finance-history-table"),
  financeHistoryToggle: document.getElementById("finance-history-toggle"),
  financeHistoryContent: document.getElementById("finance-history-content"),
  myProfile: document.getElementById("employee-profile"),
  myShifts: document.getElementById("my-shifts-table"),
  myShiftsToggle: document.getElementById("my-shifts-toggle"),
  myShiftsContent: document.getElementById("my-shifts-content"),
  myMoneyHistory: document.getElementById("my-money-history-table"),
  myMoneyToggle: document.getElementById("my-money-toggle"),
  myMoneyContent: document.getElementById("my-money-content"),
  tabs: [...document.querySelectorAll(".tab")],
  tabPanels: {
    employees: document.getElementById("tab-employees"),
    shifts_samara: document.getElementById("tab-shifts"),
    shifts_tolyatti: document.getElementById("tab-shifts"),
    finance: document.getElementById("tab-finance"),
    analytics: document.getElementById("tab-analytics"),
  },
};

let authToken = localStorage.getItem(AUTH_TOKEN_KEY) || "";
let persistInFlight = Promise.resolve();

function setAuthToken(token) {
  authToken = token || "";
  if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function apiRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

init();

async function init() {
  wireAuth();
  wireTabs();
  wireDictEditor();
  wireEmployeeCreateToggle();
  wireWorkDaysEditor();

  if (authToken) {
    try {
      const me = await apiRequest("/api/auth/me");
      state.currentUser = me.user;
      const payload = await apiRequest("/api/state");
      state.data = loadData(payload.data || null);
    } catch (e) {
      setAuthToken("");
      state.currentUser = null;
      state.data = loadData(null);
    }
  } else {
    state.data = loadData(null);
  }

  render();
}

function wireAuth() {
  if (el.openLoginBtn && el.loginForm) {
    el.openLoginBtn.onclick = () => {
      el.openLoginBtn.classList.add("hidden");
      el.loginForm.classList.remove("hidden");
      if (el.phone) el.phone.focus();
    };
  }

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payload = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ phone: el.phone.value.trim(), password: el.pass.value.trim() }),
      });
      setAuthToken(payload.token || "");
      state.currentUser = payload.user;
      const statePayload = await apiRequest("/api/state");
      state.data = loadData(statePayload.data || null);
      el.loginError.textContent = "";
      render();
    } catch (err) {
      el.loginError.textContent = String(err.message || "Неверный логин или пароль");
    }
  });
  el.logout.onclick = () => {
    setAuthToken("");
    state.currentUser = null;
    el.pass.value = "";
    if (el.loginForm) el.loginForm.classList.add("hidden");
    if (el.openLoginBtn) el.openLoginBtn.classList.remove("hidden");
    render();
  };

  if (el.resetDataBtn) {
    el.resetDataBtn.onclick = () => {
      alert("Сброс демо-данных доступен только администратору через защищенный backend endpoint /api/reset.");
    };
  }
}

function wireDictEditor() {
  if (!el.dictEditToggle) return;
  el.dictEditToggle.onclick = () => {
    if (!state.dictEditMode) {
      state.dictEditMode = true;
      state.dictionaryDraft = JSON.parse(JSON.stringify(state.data.dictionaries));
      renderDictionaries();
      return;
    }
    state.dictEditMode = false;
    state.dictionaryDraft = null;
    renderDictionaries();
  };
}

function wireEmployeeCreateToggle() {
  if (!el.employeeCreateToggle || !el.employeeCreateCard) return;
  el.employeeCreateToggle.onclick = () => {
    el.employeeCreateCard.classList.toggle("hidden");
  };
}

function wireWorkDaysEditor() {
  if (el.workDaysBlockToggle) {
    el.workDaysBlockToggle.onclick = () => {
      state.workDaysPanelOpen = !state.workDaysPanelOpen;
      renderWorkDaysByMonthCard();
    };
  }

  if (!el.workDaysEditToggle) return;
  el.workDaysEditToggle.onclick = () => {
    state.workDaysEditMode = !state.workDaysEditMode;
    if (!state.workDaysEditMode) persist();
    renderWorkDaysByMonthCard();
  };
}

function wireTabs() {
  el.tabs.forEach((tab) => {
    tab.onclick = () => {
      const target = tab.dataset.tab;
      if (target === "shifts_samara") {
        state.shiftGroup = "samara";
        if (el.shiftsPageTitle) el.shiftsPageTitle.textContent = "Смены Самара";
      }
      if (target === "shifts_tolyatti") {
        state.shiftGroup = "tolyatti";
        if (el.shiftsPageTitle) el.shiftsPageTitle.textContent = "Смены Тольятти";
      }

      el.tabs.forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      [...new Set(Object.values(el.tabPanels))].forEach((p) => p.classList.add("hidden"));
      el.tabPanels[target].classList.remove("hidden");

      if (target.startsWith("shifts")) {
        renderShiftBlocks();
      }
    };
  });
}

function render() {
  const logged = !!state.currentUser;
  el.authShell.classList.toggle("hidden", logged);
  el.appShell.classList.toggle("hidden", !logged);
  if (!logged) return;

  el.userBadge.textContent = `${state.currentUser.lastName} ${state.currentUser.firstName} (${state.currentUser.role === "admin" ? "Администратор" : "Сотрудник"})`;

  if (state.currentUser.role === "admin") {
    el.adminView.classList.remove("hidden");
    el.employeeView.classList.add("hidden");
    renderEmployeeForm();
    renderDictionaries();
    renderEmployeeFilters();
    renderBirthdayReminder();
    renderAttendanceQrCard();
    renderEmployeesTable();
    renderShiftBlocks();
    renderWorkDaysByMonthCard();
    renderFinanceFilter();
    renderFinanceTable();
    renderFinanceHistory();
    renderOpenShiftsAdmin();
    renderHolidayDaysCard();
    renderFinesAdminCard();
    renderAnalytics();
  } else {
    el.adminView.classList.add("hidden");
    el.employeeView.classList.remove("hidden");
    renderMyCabinet();
  }
}

function renderEmployeeForm() {
  const d = state.data.dictionaries;
  el.employeeForm.innerHTML = `
    <label>Фамилия<input name="lastName" required /></label>
    <label>Имя<input name="firstName" required /></label>
    <label>Отчество<input name="middleName" required /></label>
    <label>Должность${makeSelect("position", d.positions)}</label>
    <label>Трудоустройство${makeSelect("employmentType", ["Официально", "Неофициально"], "Неофициально")}</label>
    <label>Форма оплаты${makeSelect("payForm", d.payForms)}</label>
    <label>График${makeSelect("schedule", d.schedules || [])}</label>
    <label>Часовая ставка<input name="hourlyRate" type="number" min="0" step="0.01" placeholder="Для часовой оплаты" /></label>
    <label>Оклад в месяц<input name="monthlySalary" type="number" min="0" step="1" placeholder="Для оклада" /></label>
    <label>Отдел${makeSelect("department", d.departments)}</label>
    <label>Дата рождения<input name="birthDate" type="date" /></label>
    <label>Телефон (логин)<input name="phone" required /></label>
    <label>Пароль<input name="password" required /></label>
    <button class="btn btn-primary" type="submit">Создать сотрудника</button>
  `;
  const paySel = el.employeeForm.querySelector('select[name="payForm"]');
  const rateInput = el.employeeForm.querySelector('input[name="hourlyRate"]');
  const salaryInput = el.employeeForm.querySelector('input[name="monthlySalary"]');
  const syncPayFields = () => {
    const payForm = paySel.value;
    rateInput.disabled = payForm !== "Часовая";
    salaryInput.disabled = payForm !== "Оклад";
    if (rateInput.disabled) rateInput.value = "";
    if (salaryInput.disabled) salaryInput.value = "";
  };
  paySel.addEventListener("change", syncPayFields);
  syncPayFields();

  el.employeeForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.employeeForm);
    const user = {
      id: crypto.randomUUID(),
      role: "employee",
      lastName: String(fd.get("lastName") || ""),
      firstName: String(fd.get("firstName") || ""),
      middleName: String(fd.get("middleName") || ""),
      position: String(fd.get("position") || ""),
      employmentType: String(fd.get("employmentType") || "Неофициально"),
      payForm: String(fd.get("payForm") || "Часовая"),
      schedule: String(fd.get("schedule") || ""),
      hourlyRate: Number(fd.get("hourlyRate") || 0),
      monthlySalary: Number(fd.get("monthlySalary") || 0),
      department: String(fd.get("department") || ""),
      birthDate: String(fd.get("birthDate") || ""),
      phone: String(fd.get("phone") || ""),
      password: String(fd.get("password") || ""),
    };
    state.data.users.push(user);
    persist();
    if (el.employeeCreateCard) el.employeeCreateCard.classList.add("hidden");
    render();
  };
}

function renderDictionaries() {
  const defs = [
    ["positions", "Должности"],
    ["payForms", "Формы оплаты"],
    ["departments", "Отделы"],
    ["schedules", "Графики"],
  ];

  const source = state.dictEditMode
    ? state.dictionaryDraft || JSON.parse(JSON.stringify(state.data.dictionaries))
    : state.data.dictionaries;

  if (state.dictEditMode && !state.dictionaryDraft) {
    state.dictionaryDraft = JSON.parse(JSON.stringify(state.data.dictionaries));
  }

  if (el.dictEditToggle) {
    el.dictEditToggle.textContent = state.dictEditMode ? "💾" : "⚙️";
    el.dictEditToggle.title = state.dictEditMode ? "Сохранить изменения" : "Редактировать справочники";
  }

  const controls = defs
    .map(([key, title]) => {
      const opts = source[key]
        .map((v, i) => {
          if (!state.dictEditMode) return `<li>${v}</li>`;
          return `<li>${v} <button type="button" data-key="${key}" data-index="${i}" class="dict-del" aria-label="Удалить">✖</button></li>`;
        })
        .join("");
      const addForm = state.dictEditMode
        ? `<form data-key="${key}" class="dict-add"><input name="value" required placeholder="Новое значение"/><button class="btn btn-secondary">Добавить</button></form>`
        : "";
      return `<div class="dict-card"><strong>${title}</strong><ul>${opts}</ul>${addForm}</div>`;
    })
    .join("");

  const actionRow = state.dictEditMode
    ? `<div class="dict-actions"><button type="button" class="btn btn-primary" id="dict-save-btn">Сохранить</button><button type="button" class="btn btn-secondary" id="dict-cancel-btn">Отмена</button></div>`
    : `<p class="dict-hint">Для изменений нажмите ⚙️</p>`;

  el.dictControls.innerHTML = `${controls}${actionRow}`;

  if (!state.dictEditMode) return;

  el.dictControls.querySelectorAll(".dict-add").forEach((form) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const key = form.dataset.key;
      const v = String(new FormData(form).get("value") || "").trim();
      if (!v) return;
      if (!state.dictionaryDraft[key].includes(v)) state.dictionaryDraft[key].push(v);
      renderDictionaries();
    };
  });

  el.dictControls.querySelectorAll(".dict-del").forEach((btn) => {
    btn.onclick = () => {
      const { key, index } = btn.dataset;
      state.dictionaryDraft[key].splice(Number(index), 1);
      renderDictionaries();
    };
  });

  const saveBtn = document.getElementById("dict-save-btn");
  if (saveBtn) {
    saveBtn.onclick = () => {
      state.data.dictionaries = JSON.parse(JSON.stringify(state.dictionaryDraft));
      state.dictEditMode = false;
      state.dictionaryDraft = null;
      persist();
      render();
    };
  }

  const cancelBtn = document.getElementById("dict-cancel-btn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      state.dictEditMode = false;
      state.dictionaryDraft = null;
      renderDictionaries();
    };
  }
}

function renderEmployeeFilters() {
  const deps = ["all", ...state.data.dictionaries.departments];
  const positions = ["all", ...state.data.dictionaries.positions];
  el.employeeFilterForm.innerHTML = `
    <label>Поиск
      <input name="query" value="${state.employeeFilter.query}" placeholder="Фамилия, имя, телефон" />
    </label>
    <label>Отдел
      <select name="department">${deps.map((d) => `<option value="${d}" ${d===state.employeeFilter.department?"selected":""}>${d==="all"?"Все отделы":d}</option>`).join("")}</select>
    </label>
    <label>Должность
      <select name="position">${positions.map((d) => `<option value="${d}" ${d===state.employeeFilter.position?"selected":""}>${d==="all"?"Все должности":d}</option>`).join("")}</select>
    </label>
    <button class="btn btn-secondary" type="submit">Применить</button>
  `;
  el.employeeFilterForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.employeeFilterForm);
    state.employeeFilter = {
      query: String(fd.get("query") || "").trim(),
      department: String(fd.get("department") || "all"),
      position: String(fd.get("position") || "all"),
    };
    renderEmployeesTable();
  };
}

function renderBirthdayReminder() {
  const employees = state.data.users.filter((u) => u.role === "employee" && u.birthDate);
  const today = new Date();
  const upcoming = employees
    .map((u) => {
      const [y, m, d] = u.birthDate.split("-").map(Number);
      const next = new Date(today.getFullYear(), m - 1, d);
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        next.setFullYear(today.getFullYear() + 1);
      }
      const days = Math.ceil((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
      return { u, days, nextDate: next };
    })
    .filter((x) => x.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  if (!el.birthdayReminderList) return;
  if (!upcoming.length) {
    el.birthdayReminderList.innerHTML = '<p class="dict-hint">В ближайшие 30 дней дней рождений нет.</p>';
    return;
  }

  el.birthdayReminderList.innerHTML = upcoming
    .map((x) => `<div class="birthday-item"><span>Через <b>${x.days}</b> дн.</span><strong>${x.u.lastName} ${x.u.firstName} ${x.u.middleName}</strong></div>`)
    .join("");
}

function renderAttendanceQrCard() {
  if (!el.attendanceQrCanvas || !el.attendanceQrToken) return;
  const token = buildTodayAttendanceToken();
  el.attendanceQrToken.textContent = token;

  if (!window.QRCode) return;

  if (typeof window.QRCode.toCanvas === "function") {
    window.QRCode.toCanvas(el.attendanceQrCanvas, token, {
      width: 200,
      margin: 1,
    });
    return;
  }

  if (typeof window.QRCode === "function") {
    const parent = el.attendanceQrCanvas.parentElement;
    if (!parent) return;

    let holder = parent.querySelector(".attendance-qr-fallback");
    if (!holder) {
      holder = document.createElement("div");
      holder.className = "attendance-qr-fallback";
      holder.style.width = "200px";
      holder.style.height = "200px";
      holder.style.background = "#fff";
      holder.style.border = "1px solid #ddd";
      holder.style.borderRadius = "8px";
      holder.style.display = "flex";
      holder.style.alignItems = "center";
      holder.style.justifyContent = "center";
      parent.appendChild(holder);
    }

    holder.innerHTML = "";
    new window.QRCode(holder, {
      text: token,
      width: 196,
      height: 196,
      correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.M : 0,
    });
  }
}

function renderEmployeesTable() {
  const q = state.employeeFilter.query.toLowerCase();
  const users = state.data.users
    .filter((u) => u.role !== "admin")
    .filter((u) => state.employeeFilter.department === "all" || u.department === state.employeeFilter.department)
    .filter((u) => state.employeeFilter.position === "all" || u.position === state.employeeFilter.position)
    .filter((u) => !q || `${u.lastName} ${u.firstName} ${u.phone}`.toLowerCase().includes(q));

  if (el.employeesEditToggle) {
    el.employeesEditToggle.textContent = state.employeeEditMode ? "💾" : "⚙️";
    el.employeesEditToggle.title = state.employeeEditMode ? "Завершить редактирование" : "Редактировать список сотрудников";
    el.employeesEditToggle.onclick = () => {
      state.employeeEditMode = !state.employeeEditMode;
      renderEmployeesTable();
    };
  }

  const headers = [
    "Фамилия",
    "Имя",
    "Отчество",
    "Должность",
    "Оформление",
    "Форма оплаты",
    "График",
    "Ставка",
    "Оклад",
    "Отдел",
    "Дата рождения",
    "Телефон",
    "Пароль",
    "Действия",
  ];

  const rows = users
    .map((u) => {
      if (!state.employeeEditMode) {
        return `<tr data-id="${u.id}">
          <td>${u.lastName || ""}</td>
          <td>${u.firstName || ""}</td>
          <td>${u.middleName || ""}</td>
          <td>${u.position || ""}</td>
          <td>${u.employmentType || ""}</td>
          <td>${u.payForm || ""}</td>
          <td>${u.schedule || ""}</td>
          <td>${u.hourlyRate || ""}</td>
          <td>${u.monthlySalary || ""}</td>
          <td>${u.department || ""}</td>
          <td>${u.birthDate || ""}</td>
          <td>${u.phone || ""}</td>
          <td>${u.password || ""}</td>
          <td>—</td>
        </tr>`;
      }

      return `<tr data-id="${u.id}">
        <td><input data-f="lastName" value="${u.lastName}"/></td>
        <td><input data-f="firstName" value="${u.firstName}"/></td>
        <td><input data-f="middleName" value="${u.middleName}"/></td>
        <td>${makeSelect("position", state.data.dictionaries.positions, u.position, "data-f=position")}</td>
        <td>${makeSelect("employmentType", ["Официально", "Неофициально"], u.employmentType || "Неофициально", "data-f=employmentType")}</td>
        <td>${makeSelect("payForm", state.data.dictionaries.payForms, u.payForm, "data-f=payForm")}</td>
        <td>${makeSelect("schedule", state.data.dictionaries.schedules || [], u.schedule || "", "data-f=schedule")}</td>
        <td><input type="number" min="0" step="0.01" data-f="hourlyRate" value="${u.hourlyRate || ""}"/></td>
        <td><input type="number" min="0" step="1" data-f="monthlySalary" value="${u.monthlySalary || ""}"/></td>
        <td>${makeSelect("department", state.data.dictionaries.departments, u.department, "data-f=department")}</td>
        <td><input type="date" data-f="birthDate" value="${u.birthDate || ""}"/></td>
        <td><input data-f="phone" value="${u.phone}"/></td>
        <td><input data-f="password" value="${u.password}"/></td>
        <td><button class="btn btn-secondary save-user">Сохранить</button> <button class="btn btn-secondary del-user">Удалить</button></td>
      </tr>`;
    })
    .join("");

  el.employeesTable.innerHTML = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;

  if (!state.employeeEditMode) return;

  el.employeesTable.querySelectorAll(".save-user").forEach((btn) => {
    btn.onclick = () => {
      const tr = btn.closest("tr");
      const user = state.data.users.find((x) => x.id === tr.dataset.id);
      tr.querySelectorAll("[data-f]").forEach((f) => {
        user[f.dataset.f] = f.value;
      });
      user.hourlyRate = Number(user.hourlyRate || 0);
      user.monthlySalary = Number(user.monthlySalary || 0);
      persist();
      render();
    };
  });

  el.employeesTable.querySelectorAll(".del-user").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest("tr").dataset.id;
      state.data.users = state.data.users.filter((u) => u.id !== id);
      state.data.shifts = state.data.shifts.filter((s) => s.userId !== id);
      state.data.payouts = state.data.payouts.filter((p) => p.userId !== id);
      state.data.adjustments = state.data.adjustments.filter((a) => a.userId !== id);
      persist();
      render();
    };
  });
}

function shiftBlocksConfig() {
  if (state.shiftGroup === "tolyatti") {
    return [{ key: "tolyatti", title: "Смены Тольятти", department: "Склад Тольятти", collapsible: true }];
  }
  return [
    { key: "samara_logistics", title: "Смены отдела логистики", department: "Склад Самара", collapsible: true },
    { key: "samara_packaging", title: "Смены отдела упаковки", department: "Отдел Упаковки", collapsible: true },
    { key: "samara_drivers", title: "Смены водителей", department: "Водители", collapsible: true },
  ];
}

function getEmployeesByDepartment(department) {
  return state.data.users.filter((u) => u.role === "employee" && u.department === department);
}

function renderShiftBlocks() {
  if (!el.shiftsBlocks) return;
  ensureScheduledShiftsForVisibleMonths();
  const blocks = shiftBlocksConfig();
  el.shiftsBlocks.innerHTML = blocks
    .map((b) => {
      const view = state.shiftViews[b.key] || { month: new Date(), selectedDate: todayISO(), open: false };
      const monthLabel = new Date(view.month.getFullYear(), view.month.getMonth(), 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
      const isOpen = !b.collapsible || !!view.open;
      return `<div class="card shift-block" data-shift-block="${b.key}">
        <div class="card-head">
          <h3>${b.title}</h3>
          <div class="shift-block-actions">
            ${b.collapsible ? `<button class="btn btn-secondary" type="button" data-action="toggle" data-key="${b.key}">${isOpen ? "скрыть" : "открыть"}</button>` : ""}
            <button class="btn btn-secondary" type="button" data-action="prev" data-key="${b.key}" ${!isOpen ? "disabled" : ""}>←</button>
            <strong>${monthLabel}</strong>
            <button class="btn btn-secondary" type="button" data-action="next" data-key="${b.key}" ${!isOpen ? "disabled" : ""}>→</button>
          </div>
        </div>
        <p class="dict-hint">В этом блоке доступны только сотрудники отдела: <b>${b.department}</b>.</p>
        ${isOpen ? `<div class="calendar" data-calendar-key="${b.key}"></div>
        <h4>Смена на дату <span data-selected-date="${b.key}">${view.selectedDate}</span></h4>
        <form class="grid-form" data-shift-form="${b.key}"></form>
        <div class="table-wrap"><table data-day-table="${b.key}"></table></div>` : ""}
      </div>`;
    })
    .join("");

  el.shiftsBlocks.querySelectorAll("[data-action]").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.key;
      const action = btn.dataset.action;
      const view = state.shiftViews[key];
      if (!view) return;
      if (action === "toggle") view.open = !view.open;
      if (action === "prev") view.month.setMonth(view.month.getMonth() - 1);
      if (action === "next") view.month.setMonth(view.month.getMonth() + 1);
      renderShiftBlocks();
    };
  });

  blocks.forEach((b) => {
    const view = state.shiftViews[b.key];
    if (b.collapsible && !view.open) return;
    renderCalendarForBlock(b);
    renderShiftFormForBlock(b);
    renderDayShiftsForBlock(b);
  });
}

function scheduleMode(user) {
  const schedule = String(user?.schedule || "");
  if (schedule === "5/2 (с понедельника по пятницу)") return "weekday_1_5";
  if (schedule === "5/2 (со вторника по субботу)") return "weekday_2_6";
  if (schedule === "5/2 (с понедельника по пятницу - свободный)") return "weekday_1_5_free";
  if (schedule === "подработка") return "part_time";
  return "manual";
}

function isScheduleWorkday(mode, dateObj) {
  const day = dateObj.getDay();
  if (mode === "weekday_1_5" || mode === "weekday_1_5_free") return day >= 1 && day <= 5;
  if (mode === "weekday_2_6") return day >= 2 && day <= 6;
  return false;
}

function ensureScheduledShiftsForVisibleMonths() {
  const months = new Set(Object.values(state.shiftViews || {}).map((v) => monthISO(v.month)));
  state.data.users
    .filter((u) => u.role === "employee")
    .forEach((u) => {
      const mode = scheduleMode(u);
      if (mode !== "weekday_1_5" && mode !== "weekday_2_6" && mode !== "weekday_1_5_free") return;
      months.forEach((m) => ensureScheduledShiftsForEmployeeMonth(u, m, mode));
    });
}

function ensureScheduledShiftsForEmployeeMonth(user, month, mode) {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) return;
  const lastDay = new Date(year, mon, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, mon - 1, d);
    if (!isScheduleWorkday(mode, date)) continue;
    const iso = dateISO(date);
    if (hasShiftSuppression(user.id, iso)) continue;
    const exists = state.data.shifts.some((s) => s.userId === user.id && s.date === iso);
    if (exists) continue;
    const isPiece = user.payForm === "Сдельная";
    const free = mode === "weekday_1_5_free";
    state.data.shifts.push({
      id: crypto.randomUUID(),
      date: iso,
      userId: user.id,
      start: isPiece || free ? "" : "09:00",
      end: isPiece || free ? "" : "18:00",
      pieceAmount: 0,
      actualStart: "",
      actualEnd: "",
      autoGenerated: true,
    });
  }
}

function hasShiftSuppression(userId, date) {
  return Array.isArray(state.data.shiftSuppressions) && state.data.shiftSuppressions.some((x) => x.userId === userId && x.date === date);
}

function addShiftSuppression(userId, date) {
  if (!Array.isArray(state.data.shiftSuppressions)) state.data.shiftSuppressions = [];
  if (hasShiftSuppression(userId, date)) return;
  state.data.shiftSuppressions.push({ userId, date });
}

function removeShiftSuppression(userId, date) {
  if (!Array.isArray(state.data.shiftSuppressions)) return;
  state.data.shiftSuppressions = state.data.shiftSuppressions.filter((x) => !(x.userId === userId && x.date === date));
}

function isAutoScheduleShiftDate(user, date) {
  const mode = scheduleMode(user);
  if (mode !== "weekday_1_5" && mode !== "weekday_2_6" && mode !== "weekday_1_5_free") return false;
  return isScheduleWorkday(mode, new Date(`${date}T00:00:00`));
}

function renderCalendarForBlock(block) {
  const view = state.shiftViews[block.key];
  const year = view.month.getFullYear();
  const month = view.month.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);
  const cal = el.shiftsBlocks.querySelector(`[data-calendar-key="${block.key}"]`);
  if (!cal) return;
  cal.innerHTML = "";

  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = dateISO(d);
    const day = document.createElement("button");
    day.type = "button";
    day.className = "day";
    if (d.getMonth() !== month) day.classList.add("muted");
    if (iso === view.selectedDate) day.classList.add("selected");
    day.innerHTML = `<div class="day-num">${d.getDate()}</div>`;

    const shifts = state.data.shifts.filter((s) => {
      if (s.date !== iso) return false;
      const u = state.data.users.find((x) => x.id === s.userId);
      return u && u.department === block.department;
    });

    shifts.forEach((s) => {
      const user = state.data.users.find((u) => u.id === s.userId);
      if (!user) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `shift-chip ${roleClassByPosition[user.position] || roleClassByPosition[(user.position || "").toLowerCase()] || ""}`;
      chip.textContent = `${user.lastName} ${user.payForm === "Сдельная" ? "(сделка)" : `${s.start}-${s.end}`}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        view.selectedDate = iso;
        renderShiftBlocks();
      };
      day.appendChild(chip);
    });

    day.onclick = () => {
      view.selectedDate = iso;
      renderShiftBlocks();
    };
    cal.appendChild(day);
  }
}

function renderShiftFormForBlock(block) {
  const view = state.shiftViews[block.key];
  const form = el.shiftsBlocks.querySelector(`[data-shift-form="${block.key}"]`);
  if (!form) return;
  const emps = getEmployeesByDepartment(block.department);
  form.innerHTML = `
    <label>Сотрудник<select name="userId">${emps
      .map((u) => `<option value="${u.id}">${u.lastName} ${u.firstName} (${u.payForm})</option>`)
      .join("")}</select></label>
    <label>Начало смены<input type="time" name="start" value="09:00"/></label>
    <label>Конец смены<input type="time" name="end" value="18:00"/></label>
    <label>Сумма за сделку<input type="number" min="0" step="1" name="pieceAmount" placeholder="для сдельной"/></label>
    <button class="btn btn-primary" type="submit">Добавить смену</button>
  `;

  const userSel = form.querySelector('select[name="userId"]');
  const start = form.querySelector('input[name="start"]');
  const end = form.querySelector('input[name="end"]');
  const piece = form.querySelector('input[name="pieceAmount"]');
  const sync = () => {
    const u = state.data.users.find((x) => x.id === userSel.value);
    const isPiece = u?.payForm === "Сдельная";
    const freeSchedule = scheduleMode(u) === "weekday_1_5_free";
    start.disabled = isPiece || freeSchedule;
    end.disabled = isPiece || freeSchedule;
    piece.disabled = !isPiece;
  };
  userSel.onchange = sync;
  sync();

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const user = state.data.users.find((x) => x.id === fd.get("userId"));
    if (!user || user.department !== block.department) return;

    state.data.shifts.push({
      id: crypto.randomUUID(),
      date: view.selectedDate,
      userId: String(fd.get("userId") || ""),
      start: user.payForm === "Сдельная" ? "" : String(fd.get("start") || ""),
      end: user.payForm === "Сдельная" ? "" : String(fd.get("end") || ""),
      pieceAmount: user.payForm === "Сдельная" ? Number(fd.get("pieceAmount") || 0) : 0,
      actualStart: "",
      actualEnd: "",
      autoGenerated: false,
    });

    removeShiftSuppression(user.id, view.selectedDate);

    persist();
    renderShiftBlocks();
  };
}

function renderDayShiftsForBlock(block) {
  const view = state.shiftViews[block.key];
  const table = el.shiftsBlocks.querySelector(`[data-day-table="${block.key}"]`);
  if (!table) return;

  const rows = state.data.shifts.filter((s) => {
    if (s.date !== view.selectedDate) return false;
    const u = state.data.users.find((x) => x.id === s.userId);
    return u && u.department === block.department;
  });

  table.innerHTML = `<thead><tr><th>Сотрудник</th><th>Тип</th><th>Начало</th><th>Конец</th><th>Сделка</th><th>Действия</th></tr></thead><tbody>${rows
    .map((s) => {
      const u = state.data.users.find((x) => x.id === s.userId);
      if (!u) return "";
      const isPiece = u.payForm === "Сдельная";
      return `<tr data-id="${s.id}"><td>${u.lastName}</td><td>${u.payForm}</td><td><input type="time" value="${s.start || "09:00"}" ${isPiece ? "disabled" : ""} data-start /></td><td><input type="time" value="${s.end || "18:00"}" ${isPiece ? "disabled" : ""} data-end /></td><td><input type="number" min="0" value="${s.pieceAmount || ""}" ${isPiece ? "" : "disabled"} data-piece /></td><td><button class="btn btn-secondary save-shift">Сохранить</button> <button class="btn btn-secondary del-shift">Удалить</button></td></tr>`;
    })
    .join("")}</tbody>`;

  table.querySelectorAll(".save-shift").forEach((btn) => {
    btn.onclick = () => {
      const tr = btn.closest("tr");
      const s = state.data.shifts.find((x) => x.id === tr.dataset.id);
      if (!s) return;
      const start = tr.querySelector("[data-start]");
      const end = tr.querySelector("[data-end]");
      const piece = tr.querySelector("[data-piece]");
      if (start && !start.disabled) s.start = String(start.value || "09:00");
      if (end && !end.disabled) s.end = String(end.value || "18:00");
      if (piece && !piece.disabled) s.pieceAmount = Number(piece.value || 0);
      persist();
      renderShiftBlocks();
    };
  });

  table.querySelectorAll(".del-shift").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest("tr").dataset.id;
      const removed = state.data.shifts.find((s) => s.id === id);
      if (removed) {
        const user = state.data.users.find((u) => u.id === removed.userId);
        if (user && isAutoScheduleShiftDate(user, removed.date)) {
          addShiftSuppression(removed.userId, removed.date);
        }
      }
      state.data.shifts = state.data.shifts.filter((s) => s.id !== id);
      persist();
      renderShiftBlocks();
    };
  });
}

function renderWorkDaysByMonthCard() {
  if (!el.workDaysGrid) return;

  if (el.workDaysBlockToggle) {
    el.workDaysBlockToggle.textContent = state.workDaysPanelOpen ? "скрыть" : "открыть";
  }

  el.workDaysGrid.classList.toggle("hidden", !state.workDaysPanelOpen);
  if (!state.workDaysPanelOpen) return;

  if (el.workDaysEditToggle) {
    el.workDaysEditToggle.textContent = state.workDaysEditMode ? "💾" : "⚙️";
    el.workDaysEditToggle.title = state.workDaysEditMode ? "Сохранить рабочие дни" : "Редактировать рабочие дни";
  }

  const year = Number(state.workDaysYear || new Date().getFullYear());
  const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);
  const monthItems = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const iso = `${year}-${month}`;
    const label = new Date(year, i, 1).toLocaleDateString("ru-RU", { month: "long" });
    const val = Number(state.data.workDaysByMonth[iso] || 0);
    if (!state.workDaysEditMode) {
      return `<div class="workday-item"><span>${label}</span><strong>${val || "—"}</strong></div>`;
    }
    return `<label class="workday-item"><span>${label}</span><input data-workdays-month="${iso}" type="number" min="1" max="31" value="${val || ""}" placeholder="—" /></label>`;
  }).join("");

  el.workDaysGrid.innerHTML = `
    <div class="workdays-toolbar">
      <label>Год
        <select id="workdays-year-select">${years.map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}</option>`).join("")}</select>
      </label>
    </div>
    <div class="workdays-grid-inner">${monthItems}</div>
  `;

  const yearSelect = document.getElementById("workdays-year-select");
  if (yearSelect) {
    yearSelect.onchange = () => {
      state.workDaysYear = Number(yearSelect.value || new Date().getFullYear());
      renderWorkDaysByMonthCard();
    };
  }

  if (!state.workDaysEditMode) return;
  el.workDaysGrid.querySelectorAll("[data-workdays-month]").forEach((input) => {
    input.onchange = () => {
      const m = input.dataset.workdaysMonth;
      const val = Number(input.value || 0);
      if (val > 0) state.data.workDaysByMonth[m] = val;
      else delete state.data.workDaysByMonth[m];
    };
  });
}

function renderFinanceFilter() {
  if (!state.data.financeFilter) {
    const month = monthISO(new Date());
    const bounds = monthBounds(month);
    state.data.financeFilter = {
      month,
      from: bounds.from,
      to: bounds.to,
      department: "Все отделы",
      employeeId: "all",
    };
  }

  const f = state.data.financeFilter;
  const departments = ["Все отделы", ...state.data.dictionaries.departments];
  const employeeOptions = [
    { id: "all", label: "Все сотрудники" },
    ...state.data.users
      .filter((u) => u.role === "employee")
      .map((u) => ({ id: u.id, label: `${u.lastName} ${u.firstName} ${u.middleName}` })),
  ];

  const monthOptions = buildMonthOptions(18)
    .map((m) => `<option value="${m.value}" ${m.value === f.month ? "selected" : ""}>${m.label}</option>`)
    .join("");

  el.financeFilter.innerHTML = `
    <label>Месяц <select name="month">${monthOptions}</select></label>
    <label>Период с <input name="from" type="date" value="${f.from || ""}" /></label>
    <label>Период по <input name="to" type="date" value="${f.to || ""}" /></label>
    <label>Отдел <select name="department">${departments
      .map((d) => `<option ${d === f.department ? "selected" : ""}>${d}</option>`)
      .join("")}</select></label>
    <label>Сотрудник <select name="employeeId">${employeeOptions
      .map((o) => `<option value="${o.id}" ${o.id === (f.employeeId || "all") ? "selected" : ""}>${o.label}</option>`)
      .join("")}</select></label>
    <button class="btn btn-primary" type="submit">Применить</button>
  `;

  const monthSelect = el.financeFilter.querySelector('select[name="month"]');
  const fromInput = el.financeFilter.querySelector('input[name="from"]');
  const toInput = el.financeFilter.querySelector('input[name="to"]');
  monthSelect.onchange = () => {
    const bounds = monthBounds(monthSelect.value);
    fromInput.value = bounds.from;
    toInput.value = bounds.to;
  };

  el.financeFilter.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.financeFilter);
    const month = String(fd.get("month") || monthISO(new Date()));
    const bounds = monthBounds(month);
    const from = String(fd.get("from") || bounds.from);
    const to = String(fd.get("to") || bounds.to);

    state.data.financeFilter = {
      month,
      from,
      to,
      department: String(fd.get("department") || "Все отделы"),
      employeeId: String(fd.get("employeeId") || "all"),
    };
    state.financeSelectedUserIds = [];
    persist();
    renderWorkDaysByMonthCard();
    renderFinanceFilter();
    renderFinanceTable();
    renderFinanceHistory();
    renderOpenShiftsAdmin();
    renderHolidayDaysCard();
    renderFinesAdminCard();
    renderAnalytics();
  };
}

function getFilteredFinanceUsers() {
  const f = state.data.financeFilter;
  return state.data.users
    .filter((u) => u.role === "employee")
    .filter((u) => f.department === "Все отделы" || u.department === f.department)
    .filter((u) => (f.employeeId || "all") === "all" || u.id === f.employeeId);
}

function renderFinanceTable() {
  const f = state.data.financeFilter;
  const period = getFinancePeriod();
  const monthStart = period.start;
  const monthEnd = period.end;

  const users = getFilteredFinanceUsers();
  const rows = users.map((user) => {
    const metrics = computeMonthlyMetrics(user, f.month, monthStart, monthEnd);
    return { user, metrics };
  });

  state.financeSelectedUserIds = state.financeSelectedUserIds.filter((id) => users.some((u) => u.id === id));

  const allSelected = users.length > 0 && users.every((u) => state.financeSelectedUserIds.includes(u.id));
  el.financeTable.classList.add("finance-table");
  el.financeTable.innerHTML = `<thead><tr>
    <th><button type="button" class="btn btn-secondary btn-mini" id="finance-select-all">${allSelected ? "Снять всё" : "Выбрать все"}</button></th>
    <th>Фамилия</th><th>Имя</th><th>Отчество</th><th>Должность</th><th>Отдел</th><th>Оформление</th><th>Форма оплаты</th><th>Смен</th><th>Часы</th>
    <th>Начислено</th><th>НДФЛ</th><th>Премии</th><th>Штрафы</th><th>К выплате</th><th>Выплачено</th><th>Остаток</th>
  </tr></thead><tbody>${rows
    .map(({ user, metrics }) => {
      const checked = state.financeSelectedUserIds.includes(user.id) ? "checked" : "";
      return `<tr data-user-id="${user.id}" class="${checked ? "is-selected" : ""}">
        <td><input type="checkbox" data-fin-check="${user.id}" ${checked} /></td>
        <td>${user.lastName}</td>
        <td>${user.firstName}</td>
        <td>${user.middleName}</td>
        <td>${user.position}</td>
        <td>${user.department}</td>
        <td>${user.employmentType || "Неофициально"}</td>
        <td>${user.payForm}</td>
        <td>${metrics.shiftCount}</td>
        <td>${metrics.hours.toFixed(2)}</td>
        <td>${metrics.gross.toFixed(2)}</td>
        <td>${metrics.ndfl.toFixed(2)}</td>
        <td>${metrics.bonuses.toFixed(2)}</td>
        <td>${metrics.fines.toFixed(2)}</td>
        <td>${metrics.netDue.toFixed(2)}</td>
        <td>${metrics.paid.toFixed(2)}</td>
        <td>${metrics.remaining.toFixed(2)}</td>
      </tr>`;
    })
    .join("")}</tbody>`;

  const selectAllBtn = document.getElementById("finance-select-all");
  if (selectAllBtn) {
    selectAllBtn.onclick = () => {
      if (allSelected) state.financeSelectedUserIds = [];
      else state.financeSelectedUserIds = users.map((u) => u.id);
      renderFinanceTable();
    };
  }

  el.financeTable.querySelectorAll("[data-fin-check]").forEach((box) => {
    box.ondblclick = (e) => e.stopPropagation();
    box.onchange = () => {
      const id = box.dataset.finCheck;
      if (box.checked) {
        if (!state.financeSelectedUserIds.includes(id)) state.financeSelectedUserIds.push(id);
      } else {
        state.financeSelectedUserIds = state.financeSelectedUserIds.filter((x) => x !== id);
      }
      renderFinanceActions(state.financeActionMode);
    };
  });

  el.financeTable.querySelectorAll("tbody tr").forEach((tr) => {
    const openHistory = () => {
      state.financeHistoryUserId = tr.dataset.userId;
      renderFinanceHistory();
    };
    tr.ondblclick = openHistory;
    tr.querySelectorAll("td").forEach((cell) => {
      if (cell.querySelector('[data-fin-check]')) return;
      cell.ondblclick = openHistory;
    });
  });

  if (!state.financeHistoryUserId && users[0]) state.financeHistoryUserId = users[0].id;
  renderFinanceActions(state.financeActionMode);
  renderFinanceHistory();
}

function renderFinanceActions(defaultAction = "payout") {
  const users = getFilteredFinanceUsers();
  state.financeActionMode = defaultAction || state.financeActionMode;
  const selectedUsers = users.filter((u) => state.financeSelectedUserIds.includes(u.id));

  if (!selectedUsers.length) {
    el.financeActionsCard?.classList.add("hidden");
    el.financeActionsForm.innerHTML = "";
    return;
  }

  el.financeActionsCard?.classList.remove("hidden");
  const isMass = selectedUsers.length > 1;
  if (el.financeActionsTitle) {
    el.financeActionsTitle.textContent = isMass
      ? `Массовые действия (${selectedUsers.length} сотрудников)`
      : `Действие по сотруднику: ${selectedUsers[0].lastName} ${selectedUsers[0].firstName}`;
  }

  const selectedNames = selectedUsers.map((u) => `${u.lastName} ${u.firstName}`).join(", ");
  el.financeActionsForm.innerHTML = `
    <label>${isMass ? "Выбраны сотрудники" : "Сотрудник"}
      <input value="${selectedNames}" disabled />
    </label>
    <label>Дата
      <input type="date" name="date" value="${todayISO()}" />
    </label>
    <label>Сумма
      <input type="number" min="0" step="0.01" name="amount" placeholder="Введите сумму" />
    </label>
    <label>Тип выплаты
      <select name="payoutType">
        <option value="Аванс">Аванс</option>
        <option value="Зарплата">Зарплата</option>
        <option value="Вне графика" selected>Вне графика</option>
      </select>
    </label>
    <label>Комментарий
      <input name="note" placeholder="Обязателен для премии/штрафа" />
    </label>
    <div class="action-buttons-row">
      <button class="btn btn-primary" type="button" data-action-select="payout">Выплата</button>
      <button class="btn btn-secondary" type="button" data-action-select="bonus">Премия</button>
      <button class="btn btn-secondary" type="button" data-action-select="fine">Штраф</button>
      <button class="btn btn-primary" type="button" data-action-submit>Выполнить</button>
    </div>
  `;

  let selectedAction = state.financeActionMode;
  const selectButtons = [...el.financeActionsForm.querySelectorAll("[data-action-select]")];
  const highlight = () => {
    selectButtons.forEach((b) => {
      b.classList.remove("tab", "active");
      if (b.dataset.actionSelect === selectedAction) b.classList.add("tab", "active");
    });
  };
  highlight();

  selectButtons.forEach((btn) => {
    btn.onclick = () => {
      selectedAction = btn.dataset.actionSelect;
      state.financeActionMode = selectedAction;
      highlight();
    };
  });

  el.financeActionsForm.querySelector('[data-action-submit]').onclick = () => {
    const fd = new FormData(el.financeActionsForm);
    const amount = Number(fd.get("amount") || 0);
    const date = String(fd.get("date") || todayISO());
    const note = String(fd.get("note") || "").trim();
    if (amount <= 0) return;

    selectedUsers.forEach((user) => {
      if (selectedAction === "payout") {
        const payoutType = String(fd.get("payoutType") || "Вне графика");
        state.data.payouts.push({
          id: crypto.randomUUID(),
          userId: user.id,
          month: state.data.financeFilter.month,
          amount,
          type: payoutType,
          date,
          note,
        });
      } else {
        if (!note) return;
        state.data.adjustments.push({
          id: crypto.randomUUID(),
          userId: user.id,
          month: state.data.financeFilter.month,
          kind: selectedAction === "bonus" ? "bonus" : "fine",
          amount,
          note,
          createdAt: `${date}T12:00:00.000Z`,
        });
      }
    });

    state.financeSelectedUserIds = [];
    persist();
    renderFinanceTable();
    renderFinanceHistory();
    renderFinanceActions(selectedAction);
  };
}

function getOpenShiftRows(filter) {
  const mode = filter.mode || "day";
  const from = mode === "day" ? filter.day : (filter.from || filter.day);
  const to = mode === "day" ? filter.day : (filter.to || filter.day);
  return state.data.shifts
    .filter((s) => s.date >= from && s.date <= to)
    .map((s) => ({ s, user: state.data.users.find((u) => u.id === s.userId) }))
    .filter((x) => x.user && x.user.role === "employee")
    .sort((a, b) => (a.s.date === b.s.date ? xName(a.user).localeCompare(xName(b.user)) : a.s.date.localeCompare(b.s.date)));
}

function xName(u) {
  return `${u.lastName} ${u.firstName} ${u.middleName || ""}`.trim();
}

function renderOpenShiftsAdmin() {
  if (!el.openShiftsFilter || !el.openShiftsTable) return;
  if (!state.data.openShiftsFilter) {
    state.data.openShiftsFilter = { mode: "day", day: todayISO(), from: todayISO(), to: todayISO() };
  }
  const f = state.data.openShiftsFilter;

  el.openShiftsFilter.innerHTML = `
    <label>Режим
      <select name="mode">
        <option value="day" ${f.mode === "day" ? "selected" : ""}>Выбранный день</option>
        <option value="period" ${f.mode === "period" ? "selected" : ""}>Период</option>
      </select>
    </label>
    <label>День <input type="date" name="day" value="${f.day || todayISO()}" /></label>
    <label>С <input type="date" name="from" value="${f.from || todayISO()}" /></label>
    <label>По <input type="date" name="to" value="${f.to || todayISO()}" /></label>
    <button class="btn btn-secondary" type="submit">Показать</button>
  `;

  const syncMode = () => {
    const mode = el.openShiftsFilter.querySelector('select[name="mode"]').value;
    const day = el.openShiftsFilter.querySelector('input[name="day"]');
    const from = el.openShiftsFilter.querySelector('input[name="from"]');
    const to = el.openShiftsFilter.querySelector('input[name="to"]');
    day.disabled = mode !== "day";
    from.disabled = mode !== "period";
    to.disabled = mode !== "period";
  };
  el.openShiftsFilter.querySelector('select[name="mode"]').onchange = syncMode;
  syncMode();

  el.openShiftsFilter.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.openShiftsFilter);
    state.data.openShiftsFilter = {
      mode: String(fd.get("mode") || "day"),
      day: String(fd.get("day") || todayISO()),
      from: String(fd.get("from") || todayISO()),
      to: String(fd.get("to") || todayISO()),
    };
    state.openShiftsSelection = [];
    persist();
    renderOpenShiftsAdmin();
  };

  const rows = getOpenShiftRows(state.data.openShiftsFilter);
  state.openShiftsSelection = state.openShiftsSelection.filter((id) => rows.some((r) => r.s.id === id));

  const allChecked = rows.length > 0 && rows.every(({ s }) => state.openShiftsSelection.includes(s.id));
  el.openShiftsTable.innerHTML = `<thead><tr><th><input type="checkbox" data-open-shift-all ${allChecked ? "checked" : ""} /></th><th>Дата</th><th>Сотрудник</th><th>Отдел</th><th>План</th><th>Факт</th><th>Статус</th></tr></thead><tbody>${rows
    .map(({ s, user }) => {
      const checked = state.openShiftsSelection.includes(s.id) ? "checked" : "";
      const status = s.actualStart && s.actualEnd ? "Закрыта" : s.actualStart ? "Открыта" : "Не открыта";
      return `<tr><td><input type="checkbox" data-open-shift="${s.id}" ${checked}/></td><td>${s.date}</td><td>${xName(user)}</td><td>${user.department}</td><td>${s.start || "-"} - ${s.end || "-"}</td><td>${s.actualStart || "-"} - ${s.actualEnd || "-"}</td><td>${status}</td></tr>`;
    })
    .join("")}</tbody>`;

  const allBox = el.openShiftsTable.querySelector('[data-open-shift-all]');
  if (allBox) {
    allBox.onchange = () => {
      if (allBox.checked) {
        state.openShiftsSelection = rows.map(({ s }) => s.id);
      } else {
        state.openShiftsSelection = [];
      }
      renderOpenShiftsAdmin();
    };
  }

  el.openShiftsTable.querySelectorAll('[data-open-shift]').forEach((box) => {
    box.onchange = () => {
      const id = box.dataset.openShift;
      if (box.checked) {
        if (!state.openShiftsSelection.includes(id)) state.openShiftsSelection.push(id);
      } else {
        state.openShiftsSelection = state.openShiftsSelection.filter((x) => x !== id);
      }
      const allSelected = rows.length > 0 && rows.every(({ s }) => state.openShiftsSelection.includes(s.id));
      if (allBox) allBox.checked = allSelected;
    };
  });

  if (el.openShiftsOpenBtn) {
    el.openShiftsOpenBtn.onclick = () => {
      const openTime = String(el.openShiftsOpenTime?.value || nowTimeHHMM());
      state.data.shifts.forEach((s) => {
        if (!state.openShiftsSelection.includes(s.id)) return;
        if (!s.actualStart) s.actualStart = openTime;
        if (!s.start) s.start = normalizeCheckInTime(openTime);
      });
      persist();
      renderOpenShiftsAdmin();
      renderFinanceTable();
    };
  }

  if (el.openShiftsCloseBtn) {
    el.openShiftsCloseBtn.onclick = () => {
      const openTime = String(el.openShiftsOpenTime?.value || nowTimeHHMM());
      const closeTime = String(el.openShiftsCloseTime?.value || nowTimeHHMM());
      state.data.shifts.forEach((s) => {
        if (!state.openShiftsSelection.includes(s.id)) return;
        if (!s.actualStart) s.actualStart = normalizeCheckInTime(openTime);
        if (!s.actualEnd) s.actualEnd = closeTime;
        s.end = closeTime;
      });
      persist();
      renderOpenShiftsAdmin();
      renderFinanceTable();
    };
  }
}

function renderHolidayDaysCard() {
  if (!el.holidayDaysToggle || !el.holidayDaysContent || !el.holidayDaysForm || !el.holidayDaysList) return;
  el.holidayDaysToggle.textContent = state.holidayDaysPanelOpen ? "скрыть" : "открыть";
  el.holidayDaysContent.classList.toggle("hidden", !state.holidayDaysPanelOpen);
  el.holidayDaysToggle.onclick = () => {
    state.holidayDaysPanelOpen = !state.holidayDaysPanelOpen;
    renderHolidayDaysCard();
  };

  if (!state.holidayDaysPanelOpen) return;

  el.holidayDaysForm.innerHTML = `
    <label>Добавить праздничную дату
      <input type="date" name="holidayDate" />
    </label>
    <button class="btn btn-secondary" type="submit">Добавить</button>
  `;

  const days = [...new Set((state.data.holidayDays || []).slice())].sort();
  el.holidayDaysList.innerHTML = days.length
    ? days.map((d) => `<div class="workday-item"><span>${d.split("-").reverse().join(".")}</span><button class="btn btn-secondary btn-mini" data-hol-del="${d}" type="button">Удалить</button></div>`).join("")
    : `<p class="dict-hint">Праздничные дни не добавлены.</p>`;

  el.holidayDaysForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.holidayDaysForm);
    const iso = String(fd.get("holidayDate") || "");
    if (!iso) return;
    const md = iso.slice(5);
    state.data.holidayDays = state.data.holidayDays || [];
    if (!state.data.holidayDays.includes(md)) state.data.holidayDays.push(md);
    persist();
    renderHolidayDaysCard();
    renderFinanceTable();
    renderAnalytics();
  };

  el.holidayDaysList.querySelectorAll('[data-hol-del]').forEach((btn) => {
    btn.onclick = () => {
      const d = btn.dataset.holDel;
      state.data.holidayDays = (state.data.holidayDays || []).filter((x) => x !== d);
      persist();
      renderHolidayDaysCard();
      renderFinanceTable();
      renderAnalytics();
    };
  });
}

function renderFinesAdminCard() {
  if (!el.finesToggle || !el.finesContent || !el.autoFinesSettings || !el.finesTable) return;
  el.finesToggle.textContent = state.finesPanelOpen ? "скрыть" : "открыть";
  el.finesContent.classList.toggle("hidden", !state.finesPanelOpen);
  el.finesToggle.onclick = () => {
    state.finesPanelOpen = !state.finesPanelOpen;
    renderFinesAdminCard();
  };

  if (!state.finesPanelOpen) return;

  const cfg = state.data.autoFineSettings || { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 };
  state.data.autoFineSettings = cfg;

  el.autoFinesSettings.innerHTML = `
    <label>Интервал с <input type="time" name="windowStart" value="${cfg.windowStart}" /></label>
    <label>Интервал по <input type="time" name="windowEnd" value="${cfg.windowEnd}" /></label>
    <label>Штраф за минуту (₽) <input type="number" min="0" step="1" name="perMinute" value="${cfg.perMinute}" /></label>
    <button class="btn btn-secondary" type="submit">Сохранить настройки</button>
    <button class="btn btn-primary" type="button" id="apply-auto-fines">Начислить автоштрафы за период</button>
  `;

  el.autoFinesSettings.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.autoFinesSettings);
    state.data.autoFineSettings = {
      windowStart: String(fd.get("windowStart") || "08:00"),
      windowEnd: String(fd.get("windowEnd") || "08:50"),
      perMinute: Number(fd.get("perMinute") || 20),
    };
    persist();
    renderFinesAdminCard();
  };

  const applyBtn = document.getElementById("apply-auto-fines");
  if (applyBtn) {
    applyBtn.onclick = () => {
      applyAutoFinesForCurrentFinancePeriod();
      renderFinesAdminCard();
      renderFinanceTable();
      renderFinanceHistory();
    };
  }

  const period = getFinancePeriod();
  const from = dateISO(period.start);
  const to = dateISO(period.end);
  const rows = state.data.adjustments
    .filter((a) => a.kind === "fine")
    .filter((a) => {
      const d = (a.createdAt || `${a.month || monthISO(new Date())}-01`).slice(0, 10);
      return d >= from && d <= to;
    })
    .map((a) => ({ a, user: state.data.users.find((u) => u.id === a.userId) }))
    .filter((x) => x.user)
    .sort((x, y) => ((x.a.createdAt || "").localeCompare(y.a.createdAt || "")));

  el.finesTable.innerHTML = `<thead><tr><th>Дата</th><th>Сотрудник</th><th>Тип</th><th>Сумма</th><th>Комментарий</th><th>Действия</th></tr></thead><tbody>${rows
    .map(({ a, user }) => `<tr><td>${(a.createdAt || "").slice(0, 10) || `${a.month}-01`}</td><td>${xName(user)}</td><td>${a.autoFine ? "Автоштраф" : "Ручной штраф"}</td><td>${Number(a.amount || 0).toFixed(2)} ₽</td><td>${a.note || ""}</td><td><button class="btn btn-secondary btn-mini" data-fine-edit="${a.id}" type="button">Изменить</button> <button class="btn btn-secondary btn-mini" data-fine-cancel="${a.id}" type="button">Отменить</button></td></tr>`)
    .join("")}</tbody>`;

  el.finesTable.querySelectorAll('[data-fine-edit]').forEach((btn) => {
    btn.onclick = () => editHistoryEntry("adjustment", btn.dataset.fineEdit);
  });
  el.finesTable.querySelectorAll('[data-fine-cancel]').forEach((btn) => {
    btn.onclick = () => cancelHistoryEntry("adjustment", btn.dataset.fineCancel);
  });
}

function timeToMinutes(t) {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function applyAutoFinesForCurrentFinancePeriod() {
  const cfg = state.data.autoFineSettings || { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 };
  const period = getFinancePeriod();
  const from = dateISO(period.start);
  const to = dateISO(period.end);
  const endMins = timeToMinutes(cfg.windowEnd);

  state.data.shifts
    .filter((s) => s.date >= from && s.date <= to)
    .forEach((s) => {
      const user = state.data.users.find((u) => u.id === s.userId && u.role === "employee");
      if (!user) return;
      if (state.data.adjustments.some((a) => a.autoFine && a.sourceShiftId === s.id)) return;

      const actual = s.actualStart || "";
      const actualMins = actual ? timeToMinutes(actual) : timeToMinutes(s.start || cfg.windowEnd);
      const lateMinutes = Math.max(0, actualMins - endMins);
      if (lateMinutes <= 0) return;

      const amount = lateMinutes * Number(cfg.perMinute || 0);
      if (amount <= 0) return;
      const note = `Автоштраф ${amount} ₽ за опоздание на ${lateMinutes} мин., смена открыта в ${actual || "не открыта"}.`;
      state.data.adjustments.push({
        id: crypto.randomUUID(),
        userId: user.id,
        month: s.date.slice(0, 7),
        kind: "fine",
        amount,
        note,
        createdAt: `${s.date}T12:00:00.000Z`,
        autoFine: true,
        sourceShiftId: s.id,
      });
    });

  persist();
}

function renderAnalytics() {
  if (!el.analyticsFilter || !el.analyticsKpis || !el.analyticsDeptTable || !el.analyticsEmployeeTable) return;

  if (!state.data.analyticsFilter) {
    const month = monthISO(new Date());
    const bounds = monthBounds(month);
    state.data.analyticsFilter = { from: bounds.from, to: bounds.to, department: "Все отделы", employeeId: "all" };
  }

  const f = state.data.analyticsFilter;
  const departments = ["Все отделы", ...state.data.dictionaries.departments];
  const employeeOptions = [{ id: "all", label: "Все сотрудники" }, ...state.data.users.filter((u) => u.role === "employee").map((u) => ({ id: u.id, label: `${u.lastName} ${u.firstName}` }))];

  el.analyticsFilter.innerHTML = `
    <label>Период с <input name="from" type="date" value="${f.from}" /></label>
    <label>Период по <input name="to" type="date" value="${f.to}" /></label>
    <label>Отдел <select name="department">${departments.map((d) => `<option ${d === f.department ? "selected" : ""}>${d}</option>`).join("")}</select></label>
    <label>Сотрудник <select name="employeeId">${employeeOptions.map((o) => `<option value="${o.id}" ${o.id === f.employeeId ? "selected" : ""}>${o.label}</option>`).join("")}</select></label>
    <button class="btn btn-primary" type="submit">Построить</button>
  `;

  el.analyticsFilter.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.analyticsFilter);
    state.data.analyticsFilter = {
      from: String(fd.get("from") || todayISO()),
      to: String(fd.get("to") || todayISO()),
      department: String(fd.get("department") || "Все отделы"),
      employeeId: String(fd.get("employeeId") || "all"),
    };
    persist();
    renderAnalytics();
  };

  const data = buildAnalyticsData(state.data.analyticsFilter);

  el.analyticsKpis.innerHTML = `
    <div class="kpi-card"><span>Сотрудников в отчете</span><strong>${data.users.length}</strong></div>
    <div class="kpi-card"><span>Смен</span><strong>${data.totalShifts}</strong></div>
    <div class="kpi-card"><span>Часов</span><strong>${data.totalHours.toFixed(2)}</strong></div>
    <div class="kpi-card"><span>Начислено</span><strong>${data.totalGross.toFixed(2)} ₽</strong></div>
    <div class="kpi-card"><span>Выплачено</span><strong>${data.totalPaid.toFixed(2)} ₽</strong></div>
    <div class="kpi-card"><span>Премии / Штрафы</span><strong>${data.totalBonuses.toFixed(2)} / ${data.totalFines.toFixed(2)} ₽</strong></div>
    <div class="kpi-card"><span>Опозданий</span><strong>${data.totalLate}</strong></div>
    <div class="kpi-card"><span>Закрытых смен по QR</span><strong>${data.closedByQr}</strong></div>
  `;

  el.analyticsDeptTable.innerHTML = `<thead><tr><th>Отдел</th><th>Сотрудников</th><th>Смен</th><th>Часов</th><th>Начислено</th><th>Выплачено</th><th>Опозданий</th></tr></thead><tbody>${data.byDepartment
    .map((r) => `<tr><td>${r.department}</td><td>${r.users}</td><td>${r.shifts}</td><td>${r.hours.toFixed(2)}</td><td>${r.gross.toFixed(2)} ₽</td><td>${r.paid.toFixed(2)} ₽</td><td>${r.late}</td></tr>`)
    .join("")}</tbody>`;

  el.analyticsEmployeeTable.innerHTML = `<thead><tr><th>Фамилия</th><th>Имя</th><th>Отдел</th><th>Смен</th><th>Часов</th><th>Начислено</th><th>Выплачено</th><th>Остаток</th><th>Опозданий</th></tr></thead><tbody>${data.byEmployee
    .map((r) => `<tr><td>${r.lastName}</td><td>${r.firstName}</td><td>${r.department}</td><td>${r.shifts}</td><td>${r.hours.toFixed(2)}</td><td>${r.gross.toFixed(2)} ₽</td><td>${r.paid.toFixed(2)} ₽</td><td>${Math.max(0, r.gross + r.bonuses - r.fines - r.paid).toFixed(2)} ₽</td><td>${r.late}</td></tr>`)
    .join("")}</tbody>`;

  if (el.analyticsExportBtn) {
    el.analyticsExportBtn.onclick = () => exportAnalyticsReport(data, state.data.analyticsFilter);
  }
}

function buildAnalyticsData(filter) {
  const from = filter.from;
  const to = filter.to;
  const users = state.data.users
    .filter((u) => u.role === "employee")
    .filter((u) => filter.department === "Все отделы" || u.department === filter.department)
    .filter((u) => filter.employeeId === "all" || u.id === filter.employeeId);

  const inRange = (iso) => iso >= from && iso <= to;
  const byEmployee = users.map((u) => {
    const shifts = state.data.shifts.filter((s) => s.userId === u.id && inRange(s.date));
    const closedShifts = shifts.filter(isShiftClosedForPayroll);
    const hours = closedShifts.reduce((acc, s) => {
      const times = getShiftPayrollTimes(s);
      return acc + (times ? hoursBetween(times.start, times.end) : 0);
    }, 0);
    const gross = closedShifts.reduce((acc, s) => acc + calculateShiftPay(s, u, s.date.slice(0, 7)), 0);
    const bonuses = state.data.adjustments
      .filter((a) => a.userId === u.id)
      .filter((a) => {
        const d = (a.createdAt || `${a.month || monthISO(new Date())}-01`).slice(0, 10);
        return inRange(d) && a.kind === "bonus";
      })
      .reduce((acc, a) => acc + Number(a.amount || 0), 0);
    const fines = state.data.adjustments
      .filter((a) => a.userId === u.id)
      .filter((a) => {
        const d = (a.createdAt || `${a.month || monthISO(new Date())}-01`).slice(0, 10);
        return inRange(d) && a.kind === "fine";
      })
      .reduce((acc, a) => acc + Number(a.amount || 0), 0);
    const paid = state.data.payouts
      .filter((p) => p.userId === u.id)
      .filter((p) => inRange((p.date || `${p.month || monthISO(new Date())}-01`).slice(0, 10)))
      .reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const late = closedShifts.filter((s) => s.actualStart && s.actualStart > "09:00").length;
    const closedByQr = closedShifts.length;

    return {
      userId: u.id,
      lastName: u.lastName,
      firstName: u.firstName,
      department: u.department,
      shifts: closedShifts.length,
      hours,
      gross,
      paid,
      bonuses,
      fines,
      late,
      closedByQr,
    };
  });

  const deptMap = new Map();
  byEmployee.forEach((r) => {
    if (!deptMap.has(r.department)) deptMap.set(r.department, { department: r.department, users: 0, shifts: 0, hours: 0, gross: 0, paid: 0, late: 0 });
    const d = deptMap.get(r.department);
    d.users += 1;
    d.shifts += r.shifts;
    d.hours += r.hours;
    d.gross += r.gross;
    d.paid += r.paid;
    d.late += r.late;
  });

  return {
    users,
    byEmployee: byEmployee.sort((a, b) => b.gross - a.gross),
    byDepartment: [...deptMap.values()].sort((a, b) => b.gross - a.gross),
    totalShifts: byEmployee.reduce((a, x) => a + x.shifts, 0),
    totalHours: byEmployee.reduce((a, x) => a + x.hours, 0),
    totalGross: byEmployee.reduce((a, x) => a + x.gross, 0),
    totalPaid: byEmployee.reduce((a, x) => a + x.paid, 0),
    totalBonuses: byEmployee.reduce((a, x) => a + x.bonuses, 0),
    totalFines: byEmployee.reduce((a, x) => a + x.fines, 0),
    totalLate: byEmployee.reduce((a, x) => a + x.late, 0),
    closedByQr: byEmployee.reduce((a, x) => a + x.closedByQr, 0),
  };
}

function exportAnalyticsReport(data, filter) {
  const title = `Аналитика ${filter.from} - ${filter.to}`;
  const deptRows = data.byDepartment
    .map((r) => `<tr><td>${r.department}</td><td>${r.users}</td><td>${r.shifts}</td><td>${r.hours.toFixed(2)}</td><td>${r.gross.toFixed(2)}</td><td>${r.paid.toFixed(2)}</td><td>${r.late}</td></tr>`)
    .join("");
  const empRows = data.byEmployee
    .map((r) => `<tr><td>${r.lastName}</td><td>${r.firstName}</td><td>${r.department}</td><td>${r.shifts}</td><td>${r.hours.toFixed(2)}</td><td>${r.gross.toFixed(2)}</td><td>${r.paid.toFixed(2)}</td><td>${Math.max(0, r.gross + r.bonuses - r.fines - r.paid).toFixed(2)}</td><td>${r.late}</td></tr>`)
    .join("");

  const html = `
    <html><head><meta charset="utf-8" /></head><body>
      <h2>${title}</h2>
      <p>Фильтр: отдел — ${filter.department}, сотрудник — ${filter.employeeId}</p>
      <h3>Сводка по отделам</h3>
      <table border="1"><tr><th>Отдел</th><th>Сотрудников</th><th>Смен</th><th>Часов</th><th>Начислено</th><th>Выплачено</th><th>Опозданий</th></tr>${deptRows}</table>
      <h3>Сводка по сотрудникам</h3>
      <table border="1"><tr><th>Фамилия</th><th>Имя</th><th>Отдел</th><th>Смен</th><th>Часов</th><th>Начислено</th><th>Выплачено</th><th>Остаток</th><th>Опозданий</th></tr>${empRows}</table>
    </body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fullhub-analytics-${filter.from}-${filter.to}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function computeMonthlyMetrics(user, month, monthStart, monthEnd) {
  const shifts = state.data.shifts
    .filter((s) => s.userId === user.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .filter(isShiftClosedForPayroll);

  const shiftCount = shifts.length;
  const hours = shifts.reduce((acc, s) => {
    const times = getShiftPayrollTimes(s);
    return acc + (times ? hoursBetween(times.start, times.end) : 0);
  }, 0);
  const gross = shifts.reduce((acc, s) => acc + calculateShiftPay(s, user, month), 0);

  const monthAdjustments = state.data.adjustments.filter(
    (a) => a.userId === user.id && a.month === month
  );
  const bonuses = monthAdjustments
    .filter((a) => a.kind === "bonus")
    .reduce((acc, a) => acc + Number(a.amount || 0), 0);
  const fines = monthAdjustments
    .filter((a) => a.kind === "fine")
    .reduce((acc, a) => acc + Number(a.amount || 0), 0);
  const adjustmentsNet = bonuses - fines;

  const ndfl = calculateNdfl(user, gross);
  const netDue = Math.max(0, gross - ndfl + adjustmentsNet);

  const paid = state.data.payouts
    .filter((p) => p.userId === user.id && p.month === month)
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const remaining = Math.max(0, netDue - paid);

  return { shiftCount, hours, gross, ndfl, bonuses, fines, adjustmentsNet, netDue, paid, remaining };
}

function calculateNdfl(user, gross) {
  const isOfficial = (user.employmentType || "Неофициально") === "Официально";
  if (!isOfficial) return 0;
  if (user.payForm === "Оклад") {
    const base = Math.min(gross, Number(user.monthlySalary || 0));
    return base * NDFL_RATE;
  }
  return gross * NDFL_RATE;
}

function isHolidayDate(isoDate) {
  const md = String(isoDate || "").slice(5);
  return (state.data.holidayDays || []).includes(md);
}

function shiftMultiplier(shift) {
  return isHolidayDate(shift.date) ? 2 : 1;
}

function getShiftPayrollTimes(shift) {
  if (!shift || !shift.actualStart || !shift.actualEnd) return null;
  return { start: shift.actualStart, end: shift.actualEnd };
}

function isShiftClosedForPayroll(shift) {
  return Boolean(getShiftPayrollTimes(shift));
}

function calculateShiftPay(shift, user, month) {
  const times = getShiftPayrollTimes(shift);
  if (!times) return 0;
  if (user.payForm === "Сдельная") return Number(shift.pieceAmount || 0);
  if (user.payForm === "Часовая") {
    return hoursBetween(times.start, times.end) * Number(user.hourlyRate || 0);
  }
  const workDays = Number(state.data.workDaysByMonth[month] || 0);
  if (workDays <= 0) return 0;
  const hourlyRate = Number(user.monthlySalary || 0) / workDays / SHIFT_HOURS_STANDARD;
  const k = shiftMultiplier(shift);
  return hoursBetween(times.start, times.end) * hourlyRate * k;
}

function renderMyCabinet() {
  const u = state.currentUser;
  const month = state.employeeMonth;
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);

  const metrics = computeMonthlyMetrics(u, month, monthStart, monthEnd);
  const shifts = state.data.shifts
    .filter((s) => s.userId === u.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const allFutureShifts = state.data.shifts
    .filter((s) => s.userId === u.id)
    .filter((s) => new Date(s.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayShift = allFutureShifts.find((s) => s.date === todayISO());
  const nextShift = allFutureShifts.find((s) => s.date > todayISO()) || null;
  const nextPayout = getNextPlannedPayoutDate();
  const shiftToday = state.data.shifts.find((s) => s.userId === u.id && s.date === todayISO()) || null;
  const attendanceState = shiftToday
    ? shiftToday.actualStart && shiftToday.actualEnd
      ? `Смена закрыта: факт ${shiftToday.actualStart}-${shiftToday.actualEnd}, в графике ${shiftToday.start || "-"}-${shiftToday.end || "-"}`
      : shiftToday.actualStart
        ? `Смена начата в ${shiftToday.actualStart}${shiftToday.start && shiftToday.start !== shiftToday.actualStart ? ` (в графике с ${shiftToday.start})` : ""}`
        : "Смена ещё не открыта"
    : "На сегодня смена не назначена";

  const hourlyRateForMonth =
    u.payForm === "Оклад" && Number(state.data.workDaysByMonth[month] || 0) > 0
      ? Number(u.monthlySalary || 0) /
        Number(state.data.workDaysByMonth[month]) /
        SHIFT_HOURS_STANDARD
      : Number(u.hourlyRate || 0);

  const p = state.myCabinetPanels;
  el.myProfile.innerHTML = `
    <div class="cabinet-hero">
      <div>
        <h3>${u.lastName} ${u.firstName} ${u.middleName}</h3>
        <p class="dict-hint">${u.position} • ${u.department}</p>
      </div>
      <div class="cabinet-badges">
        <span class="cabinet-badge">${u.payForm}</span>
        <span class="cabinet-badge">График: ${u.schedule || "—"}</span>
      </div>
    </div>

    <div class="cabinet-section">
      <button class="cabinet-section-toggle" type="button" id="cab-profile-toggle">${p.profile ? "скрыть" : "открыть"} • Профиль и настройки периода</button>
      <div class="cabinet-section-content ${p.profile ? "" : "hidden"}">
        <div class="employee-kpi-grid compact-grid">
          <div class="kpi-card"><span>Форма оплаты</span><strong>${u.payForm}${u.payForm === "Оклад" ? ` (${Number(u.monthlySalary || 0).toFixed(2)} ₽/мес)` : ""}${u.payForm === "Часовая" ? ` (${Number(u.hourlyRate || 0).toFixed(2)} ₽/ч)` : ""}</strong></div>
          <div class="kpi-card"><span>Расчетная ставка за час</span><strong>${hourlyRateForMonth.toFixed(2)} ₽/ч</strong></div>
          <div class="kpi-card"><span>Ближайшая плановая выплата</span><strong>${nextPayout}</strong></div>
        </div>
        <form id="month-selector" class="inline-form">
          <label>Месяц <select name="month">${buildMonthOptions(18).map((m) => `<option value="${m.value}" ${m.value === month ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
          <button class="btn btn-secondary" type="submit">Показать</button>
        </form>
      </div>
    </div>

    <div class="cabinet-section">
      <button class="cabinet-section-toggle" type="button" id="cab-kpi-toggle">${p.kpi ? "скрыть" : "открыть"} • Показатели и QR</button>
      <div class="cabinet-section-content ${p.kpi ? "" : "hidden"}">
        <div class="employee-kpi-grid">
          <div class="kpi-card"><span>Смен за месяц</span><strong>${metrics.shiftCount}</strong></div>
          <div class="kpi-card"><span>Часов за месяц</span><strong>${metrics.hours.toFixed(2)}</strong></div>
          <div class="kpi-card"><span>Начислено</span><strong>${metrics.gross.toFixed(2)} ₽</strong></div>
          <div class="kpi-card"><span>К выплате</span><strong>${metrics.remaining.toFixed(2)} ₽</strong></div>
        </div>
        <div class="employee-kpi-grid compact-grid">
          <div class="kpi-card"><span>Сегодняшняя смена</span><strong>${todayShift ? `${todayShift.start || "сделка"}${todayShift.end ? `–${todayShift.end}` : ""}` : "Нет смены"}</strong></div>
          <div class="kpi-card"><span>Следующая смена</span><strong>${nextShift ? `${formatDateRU(nextShift.date)} • ${nextShift.start || "сделка"}${nextShift.end ? `–${nextShift.end}` : ""}` : "Не назначена"}</strong></div>
        </div>
        <div class="attendance-card">
          <h3>Отметка прихода/ухода по QR</h3>
          <p class="dict-hint">Статус: <b>${attendanceState}</b></p>
          <button class="btn btn-primary" id="scan-attendance-btn" type="button">Сканировать QR-код</button>
        </div>
        <p><strong>Итог за месяц:</strong> начислено <b>${metrics.gross.toFixed(2)} ₽</b>, НДФЛ <b>${metrics.ndfl.toFixed(2)} ₽</b>, премии <b>${metrics.bonuses.toFixed(2)} ₽</b>, штрафы <b>${metrics.fines.toFixed(2)} ₽</b>, выплачено <b>${metrics.paid.toFixed(2)} ₽</b>, осталось к выплате <b>${metrics.remaining.toFixed(2)} ₽</b>.</p>
      </div>
    </div>
  `;

  const wireCabinetPanel = (btnId, key) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = () => {
      state.myCabinetPanels[key] = !state.myCabinetPanels[key];
      renderMyCabinet();
    };
  };
  wireCabinetPanel("cab-profile-toggle", "profile");
  wireCabinetPanel("cab-kpi-toggle", "kpi");

  if (el.myShiftsToggle && el.myShiftsContent) {
    el.myShiftsToggle.textContent = state.myCabinetPanels.shifts ? "скрыть" : "открыть";
    el.myShiftsContent.classList.toggle("hidden", !state.myCabinetPanels.shifts);
    el.myShiftsToggle.onclick = () => {
      state.myCabinetPanels.shifts = !state.myCabinetPanels.shifts;
      renderMyCabinet();
    };
  }

  if (el.myMoneyToggle && el.myMoneyContent) {
    el.myMoneyToggle.textContent = state.myCabinetPanels.money ? "скрыть" : "открыть";
    el.myMoneyContent.classList.toggle("hidden", !state.myCabinetPanels.money);
    el.myMoneyToggle.onclick = () => {
      state.myCabinetPanels.money = !state.myCabinetPanels.money;
      renderMyCabinet();
    };
  }

  const monthForm = document.getElementById("month-selector");
  if (monthForm) {
    monthForm.onsubmit = (e) => {
      e.preventDefault();
      const chosen = String(new FormData(monthForm).get("month") || "");
      if (chosen) state.employeeMonth = chosen;
      renderMyCabinet();
    };
  }

  const scanBtn = document.getElementById("scan-attendance-btn");
  if (scanBtn) {
    scanBtn.onclick = async () => {
      const scanned = await scanAttendanceQrToken();
      if (!scanned) return;
      if (!isAttendanceTokenValid(scanned)) {
        alert("Неверный QR-код. Используйте QR-код из панели администратора.");
        return;
      }
      const msg = await applyAttendanceMark(u.id);
      alert(msg);
      renderMyCabinet();
    };
  }

  if (state.myCabinetPanels.shifts) {
    el.myShifts.innerHTML = `<thead><tr><th>Дата</th><th>Тип</th><th>Время</th><th>Начисление</th><th>График</th></tr></thead><tbody>${shifts
      .map((s) => {
        const amount = calculateShiftPay(s, u, month);
        return `<tr><td>${s.date}</td><td>${u.payForm}</td><td>${s.start || "-"}${s.end ? ` - ${s.end}` : ""}</td><td>${amount.toFixed(2)} ₽</td><td>${s.start && s.end ? `${s.start}–${s.end}` : "сдельная"}</td></tr>`;
      })
      .join("")}</tbody>`;
  }

  if (state.myCabinetPanels.money) {
    const moneyHistory = buildMoneyHistoryEntries(u, month, monthStart, monthEnd);
    el.myMoneyHistory.innerHTML = `<thead><tr><th>Дата</th><th>Операция</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${moneyHistory
      .map((row) => `<tr><td>${row.date}</td><td>${row.type}</td><td>${row.amount.toFixed(2)} ₽</td><td>${row.note}</td></tr>`)
      .join("")}</tbody>`;
  }
}

function renderFinanceHistory() {
  if (el.financeHistoryToggle && el.financeHistoryContent) {
    el.financeHistoryToggle.textContent = state.financeHistoryPanelOpen ? "скрыть" : "открыть";
    el.financeHistoryContent.classList.toggle("hidden", !state.financeHistoryPanelOpen);
    el.financeHistoryToggle.onclick = () => {
      state.financeHistoryPanelOpen = !state.financeHistoryPanelOpen;
      renderFinanceHistory();
    };
  }

  if (!state.financeHistoryPanelOpen) return;

  const f = state.data.financeFilter;
  const period = getFinancePeriod();
  const monthStart = period.start;
  const monthEnd = period.end;
  const user = state.data.users.find((u) => u.id === state.financeHistoryUserId && u.role === "employee");

  if (!user) {
    el.financeHistoryTitle.textContent = "История начислений и списаний";
    el.financeHistoryTable.innerHTML = "<tbody><tr><td>Выберите сотрудника в таблице финансов (двойной клик по строке).</td></tr></tbody>";
    return;
  }

  el.financeHistoryTitle.textContent = `История: ${user.lastName} ${user.firstName} (${period.label})`;
  const rows = buildMoneyHistoryEntries(user, f.month, monthStart, monthEnd);
  el.financeHistoryTable.innerHTML = `<thead><tr><th>Дата</th><th>Операция</th><th>Сумма</th><th>Комментарий</th><th>Действия</th></tr></thead><tbody>${rows
    .map((row) => {
      const actions = row.editable
        ? `<button class="btn btn-secondary btn-mini" data-h-edit-kind="${row.editKind}" data-h-edit-id="${row.editId}">Изменить</button> <button class="btn btn-secondary btn-mini" data-h-cancel-kind="${row.editKind}" data-h-cancel-id="${row.editId}">Отменить</button>`
        : "-";
      return `<tr><td>${row.date}</td><td>${row.type}</td><td>${row.amount.toFixed(2)} ₽</td><td>${row.note}</td><td>${actions}</td></tr>`;
    })
    .join("")}</tbody>`;

  el.financeHistoryTable.querySelectorAll('[data-h-edit-id]').forEach((btn) => {
    btn.onclick = () => {
      editHistoryEntry(btn.dataset.hEditKind, btn.dataset.hEditId);
    };
  });
  el.financeHistoryTable.querySelectorAll('[data-h-cancel-id]').forEach((btn) => {
    btn.onclick = () => {
      cancelHistoryEntry(btn.dataset.hCancelKind, btn.dataset.hCancelId);
    };
  });
}

function buildMoneyHistoryEntries(user, month, monthStart, monthEnd) {
  const shiftRows = state.data.shifts
    .filter((s) => s.userId === user.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .filter(isShiftClosedForPayroll)
    .map((s) => ({
      date: s.date,
      type: "Начисление за смену",
      amount: calculateShiftPay(s, user, month),
      note: user.payForm === "Сдельная" ? "Сдельная смена" : `${s.start || "-"} - ${s.end || "-"}`,
      editable: true,
      editKind: "shift",
      editId: s.id,
    }));

  const metrics = computeMonthlyMetrics(user, month, monthStart, monthEnd);
  const ndflRow = metrics.ndfl > 0 ? [{
    date: `${month}-28`,
    type: "Удержание НДФЛ",
    amount: -metrics.ndfl,
    note: "13% удержание налога",
  }] : [];

  const adjustmentRows = state.data.adjustments
    .filter((a) => a.userId === user.id && a.month === month)
    .map((a) => ({
      date: (a.createdAt || "").slice(0, 10) || `${month}-01`,
      type: a.kind === "bonus" ? "Премия" : "Штраф",
      amount: a.kind === "bonus" ? Number(a.amount || 0) : -Number(a.amount || 0),
      note: a.note || "",
      editable: true,
      editKind: "adjustment",
      editId: a.id,
    }));

  const payoutRows = state.data.payouts
    .filter((p) => p.userId === user.id && p.month === month)
    .map((p) => ({
      date: p.date || `${month}-01`,
      type: (p.type === "Аванс" || p.type === "advance") ? "Выплата аванс" : (p.type === "Зарплата" || p.type === "salary") ? "Выплата зарплата" : "Выплата вне графика",
      amount: -Number(p.amount || 0),
      note: p.note || "",
      editable: true,
      editKind: "payout",
      editId: p.id,
    }));

  return [...shiftRows, ...ndflRow, ...adjustmentRows, ...payoutRows].sort((a, b) => a.date.localeCompare(b.date));
}


function editHistoryEntry(kind, id) {
  if (kind === "shift") {
    const item = state.data.shifts.find((s) => s.id === id);
    if (!item) return;
    const user = state.data.users.find((u) => u.id === item.userId);
    if (!user) return;

    const date = String(window.prompt("Дата смены (YYYY-MM-DD)", item.date || todayISO()) || item.date || todayISO());
    item.date = date;

    if (user.payForm === "Сдельная") {
      const pieceAmount = Number(window.prompt("Сумма за сделку", String(item.pieceAmount || 0)) || item.pieceAmount || 0);
      if (pieceAmount < 0) return;
      item.pieceAmount = pieceAmount;
    } else {
      const start = String(window.prompt("Начало смены (HH:MM)", item.start || "09:00") || item.start || "09:00");
      const end = String(window.prompt("Конец смены (HH:MM)", item.end || "18:00") || item.end || "18:00");
      item.start = start;
      item.end = end;
    }

    item.autoGenerated = false;
    removeShiftSuppression(item.userId, item.date);
  }

  if (kind === "payout") {
    const item = state.data.payouts.find((p) => p.id === id);
    if (!item) return;
    const amount = Number(window.prompt("Новая сумма выплаты", String(item.amount || 0)) || 0);
    if (amount <= 0) return;
    const date = String(window.prompt("Новая дата выплаты (YYYY-MM-DD)", item.date || todayISO()) || item.date || todayISO());
    const note = String(window.prompt("Комментарий", item.note || "") || "").trim();
    item.amount = amount;
    item.date = date;
    item.note = note;
  }

  if (kind === "adjustment") {
    const item = state.data.adjustments.find((a) => a.id === id);
    if (!item) return;
    const amount = Number(window.prompt("Новая сумма", String(item.amount || 0)) || 0);
    if (amount <= 0) return;
    const note = String(window.prompt("Комментарий", item.note || "") || "").trim();
    if (!note) return;
    item.amount = amount;
    item.note = note;
  }

  persist();
  renderFinanceTable();
  renderFinanceHistory();
  renderFinesAdminCard();
}

function cancelHistoryEntry(kind, id) {
  if (!window.confirm("Отменить выбранное действие в истории?")) return;

  if (kind === "payout") {
    state.data.payouts = state.data.payouts.filter((p) => p.id !== id);
  }

  if (kind === "adjustment") {
    state.data.adjustments = state.data.adjustments.filter((a) => a.id !== id);
  }

  if (kind === "shift") {
    const item = state.data.shifts.find((s) => s.id === id);
    if (item) {
      const user = state.data.users.find((u) => u.id === item.userId);
      if (user && isAutoScheduleShiftDate(user, item.date)) {
        addShiftSuppression(item.userId, item.date);
      }
    }
    state.data.shifts = state.data.shifts.filter((s) => s.id !== id);
  }

  persist();
  renderFinanceTable();
  renderFinanceHistory();
  renderFinesAdminCard();
}

function makeSelect(name, options, selected, extra = "") {
  return `<select name="${name}" ${extra}>${options
    .map((o) => `<option ${o === selected ? "selected" : ""}>${o}</option>`)
    .join("")}</select>`;
}

function buildTodayAttendanceToken() {
  return `${ATTENDANCE_QR_PREFIX}|${todayISO()}`;
}

function isAttendanceTokenValid(token) {
  return String(token || "").trim() === buildTodayAttendanceToken();
}

function nowTimeHHMM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Samara",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value || "00";
  const mm = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hh}:${mm}`;
}

function maxTimeHHMM(a, b) {
  return a >= b ? a : b;
}

function normalizeCheckInTime(timeHHMM) {
  return maxTimeHHMM(String(timeHHMM || "09:00"), "09:00");
}

async function applyAttendanceMark(userId) {
  if (authToken) {
    try {
      const payload = await apiRequest("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (payload?.data) {
        state.data = loadData(payload.data);
      }
      return String(payload?.message || "Отметка выполнена.");
    } catch (e) {
      return `Ошибка отметки: ${e.message || e}`;
    }
  }

  const user = state.data.users.find((u) => u.id === userId);
  if (!user) return "Пользователь не найден.";

  let shift = state.data.shifts.find((s) => s.userId === userId && s.date === todayISO());
  if (!shift && scheduleMode(user) === "part_time") {
    shift = {
      id: crypto.randomUUID(),
      date: todayISO(),
      userId,
      start: "",
      end: "",
      pieceAmount: 0,
      actualStart: "",
      actualEnd: "",
      autoGenerated: false,
    };
    state.data.shifts.push(shift);
    removeShiftSuppression(userId, todayISO());
  }

  if (!shift) return "На сегодня вам не назначена смена.";

  const now = nowTimeHHMM();
  if (!shift.actualStart) {
    shift.actualStart = now;
    shift.start = now;
    persist();
    return `Начало смены зафиксировано: ${now}`;
  }

  if (!shift.actualEnd) {
    shift.actualEnd = now;
    shift.end = now;
    persist();
    return `Окончание смены зафиксировано: ${now}`;
  }

  return `Смена уже закрыта (${shift.actualStart} - ${shift.actualEnd}).`;
}

async function scanAttendanceQrToken() {
  if (!window.Html5Qrcode) {
    return window.prompt("Сканер камеры недоступен. Введите значение из QR-кода:", "") || "";
  }

  const modal = document.createElement("div");
  modal.className = "qr-modal";
  modal.innerHTML = `
    <div class="qr-modal-card">
      <h3>Сканирование QR-кода</h3>
      <div id="qr-reader" class="qr-reader"></div>
      <button class="btn btn-secondary" type="button" id="qr-cancel-btn">Отмена</button>
    </div>
  `;
  document.body.appendChild(modal);

  const readerId = "qr-reader";
  const qr = new window.Html5Qrcode(readerId);

  return new Promise((resolve) => {
    const cleanup = async (result = "") => {
      try {
        if (qr.isScanning) await qr.stop();
      } catch (e) {
        // ignore stop errors
      }
      await qr.clear();
      modal.remove();
      resolve(result);
    };

    modal.querySelector("#qr-cancel-btn").onclick = () => cleanup("");

    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText) => cleanup(decodedText),
      () => {}
    ).catch(async () => {
      const fallback = window.prompt("Не удалось запустить камеру. Введите значение из QR-кода:", "") || "";
      await cleanup(fallback);
    });
  });
}

function emptyData() {
  return loadData(null);
}

function loadData(rawInput = null) {
  const raw = rawInput ? JSON.stringify(rawInput) : null;
  const base = {
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
        id: crypto.randomUUID(),
        role: "admin",
        lastName: "Админов",
        firstName: "Иван",
        middleName: "Иванович",
        position: "управляющий",
        employmentType: "Официально",
        payForm: "Оклад",
        schedule: "5/2 (с понедельника по пятницу)",
        hourlyRate: 0,
        monthlySalary: 120000,
        department: "Офис",
        phone: "79990000000",
        password: "admin123",
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
      },
    ],
    shifts: [],
    payouts: [],
    adjustments: [],
    workDaysByMonth: {
      [monthISO(new Date())]: 20,
    },
    financeFilter: {
      month: monthISO(new Date()),
      from: monthBounds(monthISO(new Date())).from,
      to: monthBounds(monthISO(new Date())).to,
      department: "Все отделы",
      employeeId: "all",
    },
    analyticsFilter: {
      from: monthBounds(monthISO(new Date())).from,
      to: monthBounds(monthISO(new Date())).to,
      department: "Все отделы",
      employeeId: "all",
    },
    openShiftsFilter: {
      mode: "day",
      day: todayISO(),
      from: todayISO(),
      to: todayISO(),
    },
    holidayDays: [],
    autoFineSettings: {
      windowStart: "08:00",
      windowEnd: "08:50",
      perMinute: 20,
    },
    shiftSuppressions: [],
  };

  if (!raw) return base;
  const data = JSON.parse(raw);

  data.dictionaries = data.dictionaries || base.dictionaries;
  if (!data.dictionaries.payForms?.includes("Оклад")) data.dictionaries.payForms.push("Оклад");
  data.dictionaries.schedules = Array.isArray(data.dictionaries.schedules) && data.dictionaries.schedules.length
    ? data.dictionaries.schedules
    : base.dictionaries.schedules;

  data.users = Array.isArray(data.users) ? data.users : base.users;
  data.users.forEach((u) => {
    if (!u.employmentType) u.employmentType = "Неофициально";
    if (!u.payForm) u.payForm = "Часовая";
    if (u.position && /^[а-я]/.test(u.position)) u.position = u.position.charAt(0).toUpperCase() + u.position.slice(1);
    if (u.department === "Отдел упаковки") u.department = "Отдел Упаковки";
    if (u.monthlySalary == null) u.monthlySalary = 0;
    if (u.hourlyRate == null) u.hourlyRate = 0;
    if (!u.birthDate) u.birthDate = "";
    if (!u.schedule) u.schedule = "5/2 (с понедельника по пятницу)";
  });

  data.shifts = Array.isArray(data.shifts) ? data.shifts : [];
  data.shifts.forEach((s) => {
    if (!s.actualStart) s.actualStart = "";
    if (!s.actualEnd) s.actualEnd = "";
  });
  data.payouts = normalizePayouts(data.payouts);
  data.adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  data.workDaysByMonth = data.workDaysByMonth || {};

  if (!data.financeFilter?.month) {
    data.financeFilter = { month: monthISO(new Date()), from: monthBounds(monthISO(new Date())).from, to: monthBounds(monthISO(new Date())).to, department: "Все отделы", employeeId: "all" };
  }

  if (!data.analyticsFilter?.from) {
    data.analyticsFilter = { from: monthBounds(monthISO(new Date())).from, to: monthBounds(monthISO(new Date())).to, department: "Все отделы", employeeId: "all" };
  }

  if (!data.openShiftsFilter?.mode) {
    data.openShiftsFilter = { mode: "day", day: todayISO(), from: todayISO(), to: todayISO() };
  }

  data.holidayDays = Array.isArray(data.holidayDays) ? data.holidayDays : [];
  data.autoFineSettings = data.autoFineSettings || { windowStart: "08:00", windowEnd: "08:50", perMinute: 20 };
  data.shiftSuppressions = Array.isArray(data.shiftSuppressions) ? data.shiftSuppressions : [];

  return data;
}

function normalizePayouts(rawPayouts) {
  if (!Array.isArray(rawPayouts)) return [];
  return rawPayouts.map((p) => {
    if (typeof p === "string") {
      return {
        id: crypto.randomUUID(),
        userId: p.split("_")[0],
        month: monthISO(new Date()),
        amount: 0,
        type: "Вне графика",
        date: todayISO(),
        note: "legacy",
      };
    }
    return {
      id: p.id || crypto.randomUUID(),
      userId: p.userId,
      month: p.month || monthFromDates(p.from, p.to) || monthISO(new Date()),
      amount: Number(p.amount || 0),
      type: p.type || "Вне графика",
      date: p.date || (p.paidAt ? String(p.paidAt).slice(0, 10) : todayISO()),
      note: p.note || "",
    };
  });
}

function monthFromDates(from, to) {
  if (typeof from === "string" && from.length >= 7) return from.slice(0, 7);
  if (typeof to === "string" && to.length >= 7) return to.slice(0, 7);
  return "";
}

function getFinancePeriod() {
  const f = state.data.financeFilter;
  const bounds = monthBounds(f.month);
  const from = f.from || bounds.from;
  const to = f.to || bounds.to;
  return {
    start: new Date(`${from}T00:00:00`),
    end: new Date(`${to}T23:59:59`),
    label: `${formatDateRU(from)} — ${formatDateRU(to)}`,
  };
}

function monthBounds(month) {
  const [year, m] = month.split("-").map(Number);
  const from = `${year}-${String(m).padStart(2, "0")}-01`;
  const to = dateISO(new Date(year, m, 0));
  return { from, to };
}

function buildMonthOptions(count = 12) {
  const names = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const now = new Date();
  const opts = [];
  for (let i = -Math.floor(count / 2); i <= Math.floor(count / 2); i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: `${names[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

function getNextPlannedPayoutDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const d10 = new Date(y, m, 10);
  const d25 = new Date(y, m, 25);
  let next = d10;
  if (now <= d10) next = d10;
  else if (now <= d25) next = d25;
  else next = new Date(y, m + 1, 10);

  return formatDateRU(dateISO(next));
}

function formatDateRU(iso) {
  const [y, m, d] = iso.split("-");
  const names = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${Number(d)} ${names[Number(m) - 1]} ${y}`;
}

function clearLegacyStorageKeys() {
  // localStorage data storage is deprecated in backend mode
}

function persist() {
  if (!authToken) return;
  persistInFlight = persistInFlight
    .then(() => apiRequest("/api/state", { method: "PUT", body: JSON.stringify({ data: state.data }) }))
    .catch((e) => {
      console.error("Persist error:", e);
    });
}

function todayISO() {
  return dateISO(new Date());
}

function monthISO(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 7);
}

function dateISO(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}
