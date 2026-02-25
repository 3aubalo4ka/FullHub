const STORAGE_KEY = "fullhub-data-v2";
const SHIFT_HOURS_STANDARD = 9;
const NDFL_RATE = 0.13;

const roleClassByPosition = {
  грузчик: "role-loader",
  кладовщик: "role-storekeeper",
  упаковщик: "role-packer",
  водитель: "role-driver",
};

const state = {
  data: loadData(),
  currentUser: null,
  selectedDate: todayISO(),
  viewMonth: new Date(),
  employeeMonth: monthISO(new Date()),
};

const el = {
  authShell: document.getElementById("auth-shell"),
  appShell: document.getElementById("app-shell"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  phone: document.getElementById("login-phone"),
  pass: document.getElementById("login-password"),
  userBadge: document.getElementById("user-badge"),
  logout: document.getElementById("logout-btn"),
  adminView: document.getElementById("admin-view"),
  employeeView: document.getElementById("employee-view"),
  employeeForm: document.getElementById("employee-form"),
  dictControls: document.getElementById("dictionary-controls"),
  employeesTable: document.getElementById("employees-table"),
  calendarTitle: document.getElementById("calendar-title"),
  calendar: document.getElementById("calendar"),
  shiftEditorTitle: document.getElementById("shift-editor-title"),
  shiftForm: document.getElementById("shift-form"),
  dayShiftsTable: document.getElementById("day-shifts-table"),
  financeFilter: document.getElementById("finance-filter"),
  financeTable: document.getElementById("finance-table"),
  myProfile: document.getElementById("employee-profile"),
  myShifts: document.getElementById("my-shifts-table"),
  tabs: [...document.querySelectorAll(".tab")],
  tabPanels: {
    employees: document.getElementById("tab-employees"),
    shifts: document.getElementById("tab-shifts"),
    finance: document.getElementById("tab-finance"),
  },
};

init();

function init() {
  wireAuth();
  wireTabs();
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
}

function wireTabs() {
  el.tabs.forEach((tab) => {
    tab.onclick = () => {
      el.tabs.forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      Object.values(el.tabPanels).forEach((p) => p.classList.add("hidden"));
      el.tabPanels[tab.dataset.tab].classList.remove("hidden");
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
    renderEmployeesTable();
    renderCalendar();
    renderShiftForm();
    renderDayShifts();
    renderFinanceFilter();
    renderFinanceTable();
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
      phone: String(fd.get("phone") || ""),
      password: String(fd.get("password") || ""),
    };
    state.data.users.push(user);
    persist();
    render();
  };
}

function renderDictionaries() {
  const defs = [
    ["positions", "Должности"],
    ["payForms", "Формы оплаты"],
    ["departments", "Отделы"],
  ];
  el.dictControls.innerHTML = defs
    .map(([key, title]) => {
      const opts = state.data.dictionaries[key]
        .map(
          (v, i) =>
            `<li>${v} <button type="button" data-key="${key}" data-index="${i}" class="dict-del">Удалить</button></li>`
        )
        .join("");
      return `<div><strong>${title}</strong><ul>${opts}</ul><form data-key="${key}" class="dict-add"><input name="value" required placeholder="Новое значение"/><button class="btn btn-secondary">Добавить</button></form></div>`;
    })
    .join("");

  el.dictControls.querySelectorAll(".dict-add").forEach((form) => {
    form.onsubmit = (e) => {
      e.preventDefault();
      const key = form.dataset.key;
      const v = String(new FormData(form).get("value") || "").trim();
      if (!v) return;
      if (!state.data.dictionaries[key].includes(v)) state.data.dictionaries[key].push(v);
      persist();
      render();
    };
  });

  el.dictControls.querySelectorAll(".dict-del").forEach((btn) => {
    btn.onclick = () => {
      const { key, index } = btn.dataset;
      state.data.dictionaries[key].splice(Number(index), 1);
      persist();
      render();
    };
  });
}

function renderEmployeesTable() {
  const users = state.data.users.filter((u) => u.role !== "admin");
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

    const shifts = state.data.shifts.filter((s) => s.date === iso);
    shifts.forEach((s) => {
      const user = state.data.users.find((u) => u.id === s.userId);
      if (!user) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `shift-chip ${roleClassByPosition[user.position] || ""}`;
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
  const emps = state.data.users.filter((u) => u.role === "employee");
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
  const rows = state.data.shifts.filter((s) => s.date === state.selectedDate);
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
    state.data.financeFilter = { month, department: "Все отделы" };
  }
  const f = state.data.financeFilter;
  const departments = ["Все отделы", ...state.data.dictionaries.departments];
  const wd = state.data.workDaysByMonth[f.month] ?? "";

  el.financeFilter.innerHTML = `
    <label>Месяц <input name="month" type="month" value="${f.month}" /></label>
    <label>Отдел <select name="department">${departments
      .map((d) => `<option ${d === f.department ? "selected" : ""}>${d}</option>`)
      .join("")}</select></label>
    <label>Рабочих дней в месяце <input name="workDays" type="number" min="1" max="31" value="${wd}" /></label>
    <button class="btn btn-primary" type="submit">Применить</button>
  `;

  el.financeFilter.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.financeFilter);
    const month = String(fd.get("month") || monthISO(new Date()));
    const workDays = Number(fd.get("workDays") || 0);
    state.data.financeFilter = {
      month,
      department: String(fd.get("department") || "Все отделы"),
    };
    if (workDays > 0) state.data.workDaysByMonth[month] = workDays;
    persist();
    renderFinanceFilter();
    renderFinanceTable();
  };
}

function renderFinanceTable() {
  const f = state.data.financeFilter;
  const [year, month] = f.month.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const users = state.data.users
    .filter((u) => u.role === "employee")
    .filter((u) => f.department === "Все отделы" || u.department === f.department);

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
          <button class="btn btn-secondary adjust-btn" data-user-id="${user.id}">Премия/штраф</button>
        </td>
      </tr>`;
    })
    .join("")}</tbody>`;

  el.financeTable.querySelectorAll(".payout-btn").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.dataset.userId;
      const user = state.data.users.find((u) => u.id === userId);
      if (!user) return;
      const type = prompt("Тип выплаты: advance / salary / custom", "custom");
      if (!type) return;
      const amount = Number(prompt("Сумма выплаты", "0") || 0);
      if (amount <= 0) return;
      const date = prompt("Дата выплаты (YYYY-MM-DD)", todayISO()) || todayISO();
      const note = prompt("Комментарий (необязательно)", "") || "";
      state.data.payouts.push({
        id: crypto.randomUUID(),
        userId,
        month: f.month,
        amount,
        type,
        date,
        note,
      });
      persist();
      renderFinanceTable();
    };
  });

  el.financeTable.querySelectorAll(".adjust-btn").forEach((btn) => {
    btn.onclick = () => {
      const userId = btn.dataset.userId;
      const kind = prompt("Тип корректировки: bonus / fine", "bonus");
      if (!kind) return;
      const amount = Number(prompt("Сумма", "0") || 0);
      if (amount <= 0) return;
      const note = prompt("Комментарий", "") || "";
      state.data.adjustments.push({
        id: crypto.randomUUID(),
        userId,
        month: f.month,
        kind,
        amount,
        note,
        createdAt: new Date().toISOString(),
      });
      persist();
      renderFinanceTable();
    };
  });
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
    <p>Оформление: ${u.employmentType || "Неофициально"}</p>
    <p>Форма оплаты: ${u.payForm}${u.payForm === "Оклад" ? ` (${Number(u.monthlySalary || 0).toFixed(2)} ₽/мес)` : ""}${u.payForm === "Часовая" ? ` (${Number(u.hourlyRate || 0).toFixed(2)} ₽/ч)` : ""}</p>
    <p>Расчетная ставка за час в месяце: <b>${hourlyRateForMonth.toFixed(2)} ₽/ч</b></p>
    <form id="month-selector" class="inline-form">
      <label>Месяц <input type="month" name="month" value="${month}" /></label>
      <button class="btn btn-secondary" type="submit">Показать</button>
    </form>
    <p><strong>За месяц:</strong> начислено <b>${metrics.gross.toFixed(2)} ₽</b>, НДФЛ <b>${metrics.ndfl.toFixed(2)} ₽</b>, премии <b>${metrics.bonuses.toFixed(2)} ₽</b>, штрафы <b>${metrics.fines.toFixed(2)} ₽</b>, выплачено <b>${metrics.paid.toFixed(2)} ₽</b>, осталось к выплате <b>${metrics.remaining.toFixed(2)} ₽</b>.</p>
  `;

  const monthForm = document.getElementById("month-selector");
  monthForm.onsubmit = (e) => {
    e.preventDefault();
    const chosen = String(new FormData(monthForm).get("month") || "");
    if (chosen) state.employeeMonth = chosen;
    renderMyCabinet();
  };

  el.myShifts.innerHTML = `<thead><tr><th>Дата</th><th>Тип</th><th>Время</th><th>Начисление</th></tr></thead><tbody>${shifts
    .map((s) => {
      const amount = calculateShiftPay(s, u, month);
      return `<tr><td>${s.date}</td><td>${u.payForm}</td><td>${s.start || "-"}${s.end ? ` - ${s.end}` : ""}</td><td>${amount.toFixed(2)} ₽</td></tr>`;
    })
    .join("")}</tbody>`;
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
      positions: ["грузчик", "кладовщик", "упаковщик", "водитель"],
      payForms: ["Сдельная", "Часовая", "Оклад"],
      departments: ["Отдел упаковки", "Склад Самара", "Склад Тольятти", "Водители"],
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
        position: "грузчик",
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
      department: "Все отделы",
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
    if (u.monthlySalary == null) u.monthlySalary = 0;
    if (u.hourlyRate == null) u.hourlyRate = 0;
  });

  data.shifts = Array.isArray(data.shifts) ? data.shifts : [];
  data.payouts = normalizePayouts(data.payouts);
  data.adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];
  data.workDaysByMonth = data.workDaysByMonth || {};

  if (!data.financeFilter?.month) {
    data.financeFilter = { month: monthISO(new Date()), department: "Все отделы" };
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
        type: "custom",
        date: todayISO(),
        note: "legacy",
      };
    }
    return {
      id: p.id || crypto.randomUUID(),
      userId: p.userId,
      month: p.month || monthFromDates(p.from, p.to) || monthISO(new Date()),
      amount: Number(p.amount || 0),
      type: p.type || "custom",
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
