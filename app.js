const APP_VERSION = "2026.02.27-v4";
const STORAGE_KEY = "fullhub-data-v4";
const SHIFT_HOURS_STANDARD = 9;
const NDFL_RATE = 0.13;

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
  data: loadData(),
  currentUser: null,
  selectedDate: todayISO(),
  viewMonth: new Date(),
  employeeMonth: monthISO(new Date()),
  financeHistoryUserId: null,
  financeActionUserId: null,
  dictEditMode: false,
  dictionaryDraft: null,
  shiftGroup: "samara",
  employeeFilter: { query: "", department: "all", position: "all" },
};

const el = {
  authShell: document.getElementById("auth-shell"),
  appShell: document.getElementById("app-shell"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
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
  employeeFilterForm: document.getElementById("employee-filter-form"),
  birthdayReminderList: document.getElementById("birthday-reminder-list"),
  dictControls: document.getElementById("dictionary-controls"),
  dictEditToggle: document.getElementById("dict-edit-toggle"),
  employeesTable: document.getElementById("employees-table"),
  calendarTitle: document.getElementById("calendar-title"),
  calendar: document.getElementById("calendar"),
  shiftEditorTitle: document.getElementById("shift-editor-title"),
  shiftForm: document.getElementById("shift-form"),
  dayShiftsTable: document.getElementById("day-shifts-table"),
  shiftsPageTitle: document.getElementById("shifts-page-title"),
  financeFilter: document.getElementById("finance-filter"),
  financeTable: document.getElementById("finance-table"),
  financeActionsForm: document.getElementById("finance-actions-form"),
  financeHistoryTitle: document.getElementById("finance-history-title"),
  financeHistoryTable: document.getElementById("finance-history-table"),
  myProfile: document.getElementById("employee-profile"),
  myShifts: document.getElementById("my-shifts-table"),
  myMoneyHistory: document.getElementById("my-money-history-table"),
  tabs: [...document.querySelectorAll(".tab")],
  tabPanels: {
    employees: document.getElementById("tab-employees"),
    shifts_samara: document.getElementById("tab-shifts"),
    shifts_tolyatti: document.getElementById("tab-shifts"),
    finance: document.getElementById("tab-finance"),
  },
};

init();

function init() {
  clearLegacyStorageKeys();
  if (el.appVersionPill) el.appVersionPill.textContent = `Версия: ${APP_VERSION}`;
  wireAuth();
  wireTabs();
  wireDictEditor();
  wireEmployeeCreateToggle();
  document.getElementById("prev-month").onclick = () => {
    state.viewMonth.setMonth(state.viewMonth.getMonth() - 1);
    renderCalendar();
  };
  document.getElementById("next-month").onclick = () => {
    state.viewMonth.setMonth(state.viewMonth.getMonth() + 1);
    renderCalendar();
  };
  render();
}

function wireAuth() {
  el.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = state.data.users.find(
      (u) => u.phone === el.phone.value.trim() && u.password === el.pass.value.trim()
    );
    if (!user) {
      el.loginError.textContent = "Неверный логин или пароль";
      return;
    }
    el.loginError.textContent = "";
    state.currentUser = user;
    render();
  });
  el.logout.onclick = () => {
    state.currentUser = null;
    el.pass.value = "";
    render();
  };

  el.resetDataBtn.onclick = () => {
    clearLegacyStorageKeys(true);
    window.location.reload();
  };
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
        renderCalendar();
        renderShiftForm();
        renderDayShifts();
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
    renderEmployeesTable();
    renderCalendar();
    renderShiftForm();
    renderDayShifts();
    renderFinanceFilter();
    renderFinanceTable();
    renderFinanceHistory();
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
          return `<li>${v} <button type="button" data-key="${key}" data-index="${i}" class="dict-del">Удалить</button></li>`;
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

function renderEmployeesTable() {
  const q = state.employeeFilter.query.toLowerCase();
  const users = state.data.users
    .filter((u) => u.role !== "admin")
    .filter((u) => state.employeeFilter.department === "all" || u.department === state.employeeFilter.department)
    .filter((u) => state.employeeFilter.position === "all" || u.position === state.employeeFilter.position)
    .filter((u) => !q || `${u.lastName} ${u.firstName} ${u.phone}`.toLowerCase().includes(q));
  const headers = [
    "Фамилия",
    "Имя",
    "Отчество",
    "Должность",
    "Оформление",
    "Форма оплаты",
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
      return `<tr data-id="${u.id}">
        <td><input data-f="lastName" value="${u.lastName}"/></td>
        <td><input data-f="firstName" value="${u.firstName}"/></td>
        <td><input data-f="middleName" value="${u.middleName}"/></td>
        <td>${makeSelect("position", state.data.dictionaries.positions, u.position, "data-f=position")}</td>
        <td>${makeSelect("employmentType", ["Официально", "Неофициально"], u.employmentType || "Неофициально", "data-f=employmentType")}</td>
        <td>${makeSelect("payForm", state.data.dictionaries.payForms, u.payForm, "data-f=payForm")}</td>
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

function isUserInCurrentShiftGroup(user) {
  if (!user || user.role !== "employee") return false;
  if (state.shiftGroup === "tolyatti") return user.department === "Склад Тольятти";
  return ["Отдел Упаковки", "Склад Самара", "Водители"].includes(user.department);
}

function renderCalendar() {
  const year = state.viewMonth.getFullYear();
  const month = state.viewMonth.getMonth();
  el.calendarTitle.textContent = new Date(year, month, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  el.calendar.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const iso = dateISO(d);
    const day = document.createElement("button");
    day.type = "button";
    day.className = "day";
    if (d.getMonth() !== month) day.classList.add("muted");
    if (iso === state.selectedDate) day.classList.add("selected");
    day.innerHTML = `<div class="day-num">${d.getDate()}</div>`;

    const shifts = state.data.shifts.filter((s) => s.date === iso && isUserInCurrentShiftGroup(state.data.users.find((u) => u.id === s.userId)));
    shifts.forEach((s) => {
      const user = state.data.users.find((u) => u.id === s.userId);
      if (!user) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `shift-chip ${roleClassByPosition[user.position] || roleClassByPosition[(user.position || "").toLowerCase()] || ""}`;
      chip.textContent = `${user.lastName} ${user.payForm === "Сдельная" ? "(сделка)" : `${s.start}-${s.end}`}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        state.selectedDate = iso;
        render();
      };
      day.appendChild(chip);
    });

    day.onclick = () => {
      state.selectedDate = iso;
      render();
    };
    el.calendar.appendChild(day);
  }
}

function renderShiftForm() {
  const emps = state.data.users.filter((u) => isUserInCurrentShiftGroup(u));
  el.shiftEditorTitle.textContent = `Смены на ${state.selectedDate}`;
  el.shiftForm.innerHTML = `
    <label>Сотрудник<select name="userId">${emps
      .map((u) => `<option value="${u.id}">${u.lastName} ${u.firstName} (${u.payForm})</option>`)
      .join("")}</select></label>
    <label>Начало смены<input type="time" name="start" value="09:00"/></label>
    <label>Конец смены<input type="time" name="end" value="18:00"/></label>
    <label>Сумма за сделку<input type="number" min="0" step="1" name="pieceAmount" placeholder="для сдельной"/></label>
    <button class="btn btn-primary" type="submit">Добавить смену</button>
  `;

  const userSel = el.shiftForm.querySelector('select[name="userId"]');
  const start = el.shiftForm.querySelector('input[name="start"]');
  const end = el.shiftForm.querySelector('input[name="end"]');
  const piece = el.shiftForm.querySelector('input[name="pieceAmount"]');
  const sync = () => {
    const u = state.data.users.find((x) => x.id === userSel.value);
    const isPiece = u?.payForm === "Сдельная";
    start.disabled = isPiece;
    end.disabled = isPiece;
    piece.disabled = !isPiece;
  };
  userSel.onchange = sync;
  sync();

  el.shiftForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.shiftForm);
    const user = state.data.users.find((x) => x.id === fd.get("userId"));
    if (!user) return;

    const shift = {
      id: crypto.randomUUID(),
      date: state.selectedDate,
      userId: String(fd.get("userId") || ""),
      start: user.payForm === "Сдельная" ? "" : String(fd.get("start") || ""),
      end: user.payForm === "Сдельная" ? "" : String(fd.get("end") || ""),
      pieceAmount: user.payForm === "Сдельная" ? Number(fd.get("pieceAmount") || 0) : 0,
    };

    state.data.shifts.push(shift);
    persist();
    render();
  };
}

function renderDayShifts() {
  const rows = state.data.shifts.filter((s) => s.date === state.selectedDate && isUserInCurrentShiftGroup(state.data.users.find((u) => u.id === s.userId)));
  el.dayShiftsTable.innerHTML = `<thead><tr><th>Сотрудник</th><th>Тип</th><th>Начало</th><th>Конец</th><th>Сделка</th><th>Действия</th></tr></thead><tbody>${rows
    .map((s) => {
      const u = state.data.users.find((x) => x.id === s.userId);
      if (!u) return "";
      const isPiece = u.payForm === "Сдельная";
      return `<tr data-id="${s.id}"><td>${u.lastName}</td><td>${u.payForm}</td><td><input type="time" value="${s.start || "09:00"}" ${isPiece ? "disabled" : ""} data-start /></td><td><input type="time" value="${s.end || "18:00"}" ${isPiece ? "disabled" : ""} data-end /></td><td><input type="number" min="0" value="${s.pieceAmount || ""}" ${isPiece ? "" : "disabled"} data-piece /></td><td><button class="btn btn-secondary save-shift">Сохранить</button> <button class="btn btn-secondary del-shift">Удалить</button></td></tr>`;
    })
    .join("")}</tbody>`;

  el.dayShiftsTable.querySelectorAll(".save-shift").forEach((btn) => {
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
      render();
    };
  });

  el.dayShiftsTable.querySelectorAll(".del-shift").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.closest("tr").dataset.id;
      state.data.shifts = state.data.shifts.filter((s) => s.id !== id);
      persist();
      render();
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
  const wd = state.data.workDaysByMonth[f.month] ?? "";
  const employeeOptions = [
    { id: "all", label: "Все сотрудники" },
    ...state.data.users
      .filter((u) => u.role === "employee")
      .map((u) => ({ id: u.id, label: `${u.lastName} ${u.firstName}` })),
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
    <label>Рабочих дней в месяце <input name="workDays" type="number" min="1" max="31" value="${wd}" /></label>
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
    const workDays = Number(fd.get("workDays") || 0);
    const from = String(fd.get("from") || bounds.from);
    const to = String(fd.get("to") || bounds.to);

    state.data.financeFilter = {
      month,
      from,
      to,
      department: String(fd.get("department") || "Все отделы"),
      employeeId: String(fd.get("employeeId") || "all"),
    };
    if (workDays > 0) state.data.workDaysByMonth[month] = workDays;
    persist();
    renderFinanceFilter();
    renderFinanceTable();
    renderFinanceHistory();
  };
}

function renderFinanceTable() {
  const f = state.data.financeFilter;
  const period = getFinancePeriod();
  const monthStart = period.start;
  const monthEnd = period.end;

  const users = state.data.users
    .filter((u) => u.role === "employee")
    .filter((u) => f.department === "Все отделы" || u.department === f.department)
    .filter((u) => (f.employeeId || "all") === "all" || u.id === f.employeeId);

  const rows = users.map((user) => {
    const metrics = computeMonthlyMetrics(user, f.month, monthStart, monthEnd);
    return { user, metrics };
  });

  el.financeTable.innerHTML = `<thead><tr>
    <th>Фамилия</th><th>Должность</th><th>Отдел</th><th>Оформление</th><th>Форма оплаты</th><th>Смен</th><th>Часы</th>
    <th>Начислено</th><th>НДФЛ</th><th>Премии</th><th>Штрафы</th><th>К выплате</th><th>Выплачено</th><th>Остаток</th><th>Действия</th>
  </tr></thead><tbody>${rows
    .map(({ user, metrics }) => {
      return `<tr>
        <td>${user.lastName}</td>
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
        <td>
          <button class="btn btn-secondary payout-btn" data-user-id="${user.id}">Выплата</button>
          <button class="btn btn-secondary bonus-btn" data-user-id="${user.id}">Премия</button>
          <button class="btn btn-secondary fine-btn" data-user-id="${user.id}">Штраф</button>
          <button class="btn btn-secondary history-btn" data-user-id="${user.id}">История</button>
        </td>
      </tr>`;
    })
    .join("")}</tbody>`;

  el.financeTable.querySelectorAll(".payout-btn").forEach((btn) => {
    btn.onclick = () => {
      state.financeActionUserId = btn.dataset.userId;
      renderFinanceActions("payout");
    };
  });

  el.financeTable.querySelectorAll(".bonus-btn").forEach((btn) => {
    btn.onclick = () => {
      state.financeActionUserId = btn.dataset.userId;
      renderFinanceActions("bonus");
    };
  });

  el.financeTable.querySelectorAll(".fine-btn").forEach((btn) => {
    btn.onclick = () => {
      state.financeActionUserId = btn.dataset.userId;
      renderFinanceActions("fine");
    };
  });

  el.financeTable.querySelectorAll(".history-btn").forEach((btn) => {
    btn.onclick = () => {
      state.financeHistoryUserId = btn.dataset.userId;
      renderFinanceHistory();
    };
  });

  if (!state.financeHistoryUserId && users[0]) {
    state.financeHistoryUserId = users[0].id;
  }
  renderFinanceActions();
  renderFinanceHistory();
}

function renderFinanceActions(defaultAction = "payout") {
  const f = state.data.financeFilter;
  const users = state.data.users
    .filter((u) => u.role === "employee")
    .filter((u) => f.department === "Все отделы" || u.department === f.department)
    .filter((u) => (f.employeeId || "all") === "all" || u.id === f.employeeId);

  if (!users.length) {
    el.financeActionsForm.innerHTML = "<p>Нет сотрудников для выбранного фильтра.</p>";
    return;
  }

  if (!state.financeActionUserId || !users.find((u) => u.id === state.financeActionUserId)) {
    state.financeActionUserId = users[0].id;
  }

  el.financeActionsForm.innerHTML = `
    <label>Сотрудник
      <select name="userId">${users
        .map((u) => `<option value="${u.id}" ${u.id === state.financeActionUserId ? "selected" : ""}>${u.lastName} ${u.firstName}</option>`)
        .join("")}</select>
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

  const userSelect = el.financeActionsForm.querySelector('select[name="userId"]');
  userSelect.value = state.financeActionUserId;
  userSelect.onchange = () => {
    state.financeActionUserId = userSelect.value;
  };

  let selectedAction = defaultAction;
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
      highlight();
    };
  });

  el.financeActionsForm.querySelector('[data-action-submit]').onclick = () => {
    const fd = new FormData(el.financeActionsForm);
    const userId = String(fd.get("userId") || "");
    const amount = Number(fd.get("amount") || 0);
    const date = String(fd.get("date") || todayISO());
    const note = String(fd.get("note") || "").trim();
    if (!userId || amount <= 0) return;

    if (selectedAction === "payout") {
      const payoutType = String(fd.get("payoutType") || "Вне графика");
      state.data.payouts.push({
        id: crypto.randomUUID(),
        userId,
        month: f.month,
        amount,
        type: payoutType,
        date,
        note,
      });
    } else {
      if (!note) return;
      state.data.adjustments.push({
        id: crypto.randomUUID(),
        userId,
        month: f.month,
        kind: selectedAction === "bonus" ? "bonus" : "fine",
        amount,
        note,
        createdAt: `${date}T12:00:00.000Z`,
      });
    }

    state.financeActionUserId = userId;
    persist();
    renderFinanceTable();
    renderFinanceHistory();
    renderFinanceActions(selectedAction);
  };
}

function computeMonthlyMetrics(user, month, monthStart, monthEnd) {
  const shifts = state.data.shifts
    .filter((s) => s.userId === user.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    });

  const shiftCount = shifts.length;
  const hours = shifts.reduce((acc, s) => acc + hoursBetween(s.start, s.end), 0);
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

function calculateShiftPay(shift, user, month) {
  if (user.payForm === "Сдельная") return Number(shift.pieceAmount || 0);
  if (user.payForm === "Часовая") {
    return hoursBetween(shift.start, shift.end) * Number(user.hourlyRate || 0);
  }
  const workDays = Number(state.data.workDaysByMonth[month] || 0);
  if (workDays <= 0) return 0;
  const hourlyRate = Number(user.monthlySalary || 0) / workDays / SHIFT_HOURS_STANDARD;
  return hoursBetween(shift.start, shift.end) * hourlyRate;
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

  const hourlyRateForMonth =
    u.payForm === "Оклад" && Number(state.data.workDaysByMonth[month] || 0) > 0
      ? Number(u.monthlySalary || 0) /
        Number(state.data.workDaysByMonth[month]) /
        SHIFT_HOURS_STANDARD
      : Number(u.hourlyRate || 0);

  el.myProfile.innerHTML = `
    <p><strong>${u.lastName} ${u.firstName} ${u.middleName}</strong></p>
    <p>Должность: ${u.position}</p>
    <p>Отдел: ${u.department}</p>
    <p>Форма оплаты: ${u.payForm}${u.payForm === "Оклад" ? ` (${Number(u.monthlySalary || 0).toFixed(2)} ₽/мес)` : ""}${u.payForm === "Часовая" ? ` (${Number(u.hourlyRate || 0).toFixed(2)} ₽/ч)` : ""}</p>
    <p>Расчетная ставка за час в месяце: <b>${hourlyRateForMonth.toFixed(2)} ₽/ч</b></p>
    <form id="month-selector" class="inline-form">
      <label>Месяц <select name="month">${buildMonthOptions(18).map((m) => `<option value="${m.value}" ${m.value === month ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
      <button class="btn btn-secondary" type="submit">Показать</button>
    </form>

    <div class="employee-kpi-grid">
      <div class="kpi-card"><span>Смен за месяц</span><strong>${metrics.shiftCount}</strong></div>
      <div class="kpi-card"><span>Часов за месяц</span><strong>${metrics.hours.toFixed(2)}</strong></div>
      <div class="kpi-card"><span>К выплате</span><strong>${metrics.remaining.toFixed(2)} ₽</strong></div>
      <div class="kpi-card"><span>Ближайшая плановая выплата</span><strong>${nextPayout}</strong></div>
    </div>

    <div class="employee-kpi-grid">
      <div class="kpi-card"><span>Сегодняшняя смена</span><strong>${todayShift ? `${todayShift.start || "сделка"}${todayShift.end ? `–${todayShift.end}` : ""}` : "Нет смены"}</strong></div>
      <div class="kpi-card"><span>Следующая смена</span><strong>${nextShift ? `${formatDateRU(nextShift.date)} • ${nextShift.start || "сделка"}${nextShift.end ? `–${nextShift.end}` : ""}` : "Не назначена"}</strong></div>
    </div>

    <p><strong>За месяц:</strong> начислено <b>${metrics.gross.toFixed(2)} ₽</b>, НДФЛ <b>${metrics.ndfl.toFixed(2)} ₽</b>, премии <b>${metrics.bonuses.toFixed(2)} ₽</b>, штрафы <b>${metrics.fines.toFixed(2)} ₽</b>, выплачено <b>${metrics.paid.toFixed(2)} ₽</b>, осталось к выплате <b>${metrics.remaining.toFixed(2)} ₽</b>.</p>
  `;

  const monthForm = document.getElementById("month-selector");
  monthForm.onsubmit = (e) => {
    e.preventDefault();
    const chosen = String(new FormData(monthForm).get("month") || "");
    if (chosen) state.employeeMonth = chosen;
    renderMyCabinet();
  };

  el.myShifts.innerHTML = `<thead><tr><th>Дата</th><th>Тип</th><th>Время</th><th>Начисление</th><th>График</th></tr></thead><tbody>${shifts
    .map((s) => {
      const amount = calculateShiftPay(s, u, month);
      return `<tr><td>${s.date}</td><td>${u.payForm}</td><td>${s.start || "-"}${s.end ? ` - ${s.end}` : ""}</td><td>${amount.toFixed(2)} ₽</td><td>${s.start && s.end ? `${s.start}–${s.end}` : "сдельная"}</td></tr>`;
    })
    .join("")}</tbody>`;

  const moneyHistory = buildMoneyHistoryEntries(u, month, monthStart, monthEnd);
  el.myMoneyHistory.innerHTML = `<thead><tr><th>Дата</th><th>Операция</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${moneyHistory
    .map((row) => `<tr><td>${row.date}</td><td>${row.type}</td><td>${row.amount.toFixed(2)} ₽</td><td>${row.note}</td></tr>`)
    .join("")}</tbody>`;
}

function renderFinanceHistory() {
  const f = state.data.financeFilter;
  const period = getFinancePeriod();
  const monthStart = period.start;
  const monthEnd = period.end;
  const user = state.data.users.find((u) => u.id === state.financeHistoryUserId && u.role === "employee");

  if (!user) {
    el.financeHistoryTitle.textContent = "История начислений и списаний";
    el.financeHistoryTable.innerHTML = "<tbody><tr><td>Выберите сотрудника в таблице финансов (кнопка «История»).</td></tr></tbody>";
    return;
  }

  el.financeHistoryTitle.textContent = `История: ${user.lastName} ${user.firstName} (${period.label})`;
  const rows = buildMoneyHistoryEntries(user, f.month, monthStart, monthEnd);
  el.financeHistoryTable.innerHTML = `<thead><tr><th>Дата</th><th>Операция</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${rows
    .map((row) => `<tr><td>${row.date}</td><td>${row.type}</td><td>${row.amount.toFixed(2)} ₽</td><td>${row.note}</td></tr>`)
    .join("")}</tbody>`;
}

function buildMoneyHistoryEntries(user, month, monthStart, monthEnd) {
  const shiftRows = state.data.shifts
    .filter((s) => s.userId === user.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .map((s) => ({
      date: s.date,
      type: "Начисление за смену",
      amount: calculateShiftPay(s, user, month),
      note: user.payForm === "Сдельная" ? "Сдельная смена" : `${s.start || "-"} - ${s.end || "-"}`,
    }));

  const metrics = computeMonthlyMetrics(user, month, monthStart, monthEnd);
  const ndflRow = metrics.ndfl > 0 ? [{
    date: `${month}-28`,
    type: "Удержание НДФЛ",
    amount: -metrics.ndfl,
    note: "13% для официального трудоустройства",
  }] : [];

  const adjustmentRows = state.data.adjustments
    .filter((a) => a.userId === user.id && a.month === month)
    .map((a) => ({
      date: (a.createdAt || "").slice(0, 10) || `${month}-01`,
      type: a.kind === "bonus" ? "Премия" : "Штраф",
      amount: a.kind === "bonus" ? Number(a.amount || 0) : -Number(a.amount || 0),
      note: a.note || "",
    }));

  const payoutRows = state.data.payouts
    .filter((p) => p.userId === user.id && p.month === month)
    .map((p) => ({
      date: p.date || `${month}-01`,
      type: (p.type === "Аванс" || p.type === "advance") ? "Выплата аванс" : (p.type === "Зарплата" || p.type === "salary") ? "Выплата зарплата" : "Выплата вне графика",
      amount: -Number(p.amount || 0),
      note: p.note || "",
    }));

  return [...shiftRows, ...ndflRow, ...adjustmentRows, ...payoutRows].sort((a, b) => a.date.localeCompare(b.date));
}

function makeSelect(name, options, selected, extra = "") {
  return `<select name="${name}" ${extra}>${options
    .map((o) => `<option ${o === selected ? "selected" : ""}>${o}</option>`)
    .join("")}</select>`;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const base = {
    dictionaries: {
      positions: ["Грузчик", "Кладовщик", "Упаковщик", "Водитель"],
      payForms: ["Сдельная", "Часовая", "Оклад"],
      departments: ["Отдел Упаковки", "Склад Самара", "Склад Тольятти", "Водители"],
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
  };

  if (!raw) return base;
  const data = JSON.parse(raw);

  data.dictionaries = data.dictionaries || base.dictionaries;
  if (!data.dictionaries.payForms?.includes("Оклад")) data.dictionaries.payForms.push("Оклад");

  data.users = Array.isArray(data.users) ? data.users : base.users;
  data.users.forEach((u) => {
    if (!u.employmentType) u.employmentType = "Неофициально";
    if (!u.payForm) u.payForm = "Часовая";
    if (u.position && /^[а-я]/.test(u.position)) u.position = u.position.charAt(0).toUpperCase() + u.position.slice(1);
    if (u.department === "Отдел упаковки") u.department = "Отдел Упаковки";
    if (u.monthlySalary == null) u.monthlySalary = 0;
    if (u.hourlyRate == null) u.hourlyRate = 0;
    if (!u.birthDate) u.birthDate = "";
  });

  data.shifts = Array.isArray(data.shifts) ? data.shifts : [];
  data.payouts = normalizePayouts(data.payouts);
  data.adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  data.workDaysByMonth = data.workDaysByMonth || {};

  if (!data.financeFilter?.month) {
    data.financeFilter = { month: monthISO(new Date()), from: monthBounds(monthISO(new Date())).from, to: monthBounds(monthISO(new Date())).to, department: "Все отделы", employeeId: "all" };
  }

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

function clearLegacyStorageKeys(force = false) {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith("fullhub-data-v"));
  if (!keys.length) return;
  if (!force && keys.length === 1 && keys[0] === STORAGE_KEY) return;
  keys.forEach((k) => {
    if (force || k !== STORAGE_KEY) localStorage.removeItem(k);
  });
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
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
