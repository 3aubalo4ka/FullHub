const STORAGE_KEY = "fullhub-data-v1";

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
    <label>Форма оплаты${makeSelect("payForm", d.payForms)}</label>
    <label>Часовая ставка<input name="hourlyRate" type="number" min="0" step="1" placeholder="Для часовой оплаты" /></label>
    <label>Отдел${makeSelect("department", d.departments)}</label>
    <label>Телефон (логин)<input name="phone" required /></label>
    <label>Пароль<input name="password" required /></label>
    <button class="btn btn-primary" type="submit">Создать сотрудника</button>
  `;
  const paySel = el.employeeForm.querySelector('select[name="payForm"]');
  const rateInput = el.employeeForm.querySelector('input[name="hourlyRate"]');
  const syncRate = () => {
    rateInput.disabled = paySel.value !== "Часовая";
    if (rateInput.disabled) rateInput.value = "";
  };
  paySel.addEventListener("change", syncRate);
  syncRate();

  el.employeeForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.employeeForm);
    const user = {
      id: crypto.randomUUID(),
      role: "employee",
      lastName: fd.get("lastName"),
      firstName: fd.get("firstName"),
      middleName: fd.get("middleName"),
      position: fd.get("position"),
      payForm: fd.get("payForm"),
      hourlyRate: Number(fd.get("hourlyRate") || 0),
      department: fd.get("department"),
      phone: fd.get("phone"),
      password: fd.get("password"),
    };
    state.data.users.push(user);
    persist();
    el.employeeForm.reset();
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
      const v = new FormData(form).get("value").toString().trim();
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
  const head = ["Фамилия", "Имя", "Отчество", "Должность", "Форма оплаты", "Ставка", "Отдел", "Телефон", "Пароль", "Действия"];
  const rows = users
    .map((u) => {
      return `<tr data-id="${u.id}">
        <td><input data-f="lastName" value="${u.lastName}"/></td>
        <td><input data-f="firstName" value="${u.firstName}"/></td>
        <td><input data-f="middleName" value="${u.middleName}"/></td>
        <td>${makeSelect("position", state.data.dictionaries.positions, u.position, "data-f=position")}</td>
        <td>${makeSelect("payForm", state.data.dictionaries.payForms, u.payForm, "data-f=payForm")}</td>
        <td><input type="number" min="0" data-f="hourlyRate" value="${u.hourlyRate || ""}"/></td>
        <td>${makeSelect("department", state.data.dictionaries.departments, u.department, "data-f=department")}</td>
        <td><input data-f="phone" value="${u.phone}"/></td>
        <td><input data-f="password" value="${u.password}"/></td>
        <td><button class="btn btn-secondary save-user">Сохранить</button> <button class="btn btn-secondary del-user">Удалить</button></td>
      </tr>`;
    })
    .join("");
  el.employeesTable.innerHTML = `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;

  el.employeesTable.querySelectorAll(".save-user").forEach((b) => {
    b.onclick = () => {
      const tr = b.closest("tr");
      const user = state.data.users.find((x) => x.id === tr.dataset.id);
      tr.querySelectorAll("[data-f]").forEach((f) => {
        user[f.dataset.f] = f.value;
      });
      user.hourlyRate = Number(user.hourlyRate || 0);
      persist();
      render();
    };
  });
  el.employeesTable.querySelectorAll(".del-user").forEach((b) => {
    b.onclick = () => {
      const id = b.closest("tr").dataset.id;
      state.data.users = state.data.users.filter((u) => u.id !== id);
      state.data.shifts = state.data.shifts.filter((s) => s.userId !== id);
      state.data.payouts = state.data.payouts.filter((p) => p.userId !== id);
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
      chip.textContent = `${user.lastName} ${user.payForm === "Часовая" ? `${s.start}-${s.end}` : "(сделка)"}`;
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
    const hourly = u?.payForm === "Часовая";
    start.disabled = !hourly;
    end.disabled = !hourly;
    piece.disabled = hourly;
  };
  userSel.onchange = sync;
  sync();

  el.shiftForm.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.shiftForm);
    const user = state.data.users.find((x) => x.id === fd.get("userId"));
    const row = {
      id: crypto.randomUUID(),
      date: state.selectedDate,
      userId: fd.get("userId"),
      start: user.payForm === "Часовая" ? fd.get("start") : "",
      end: user.payForm === "Часовая" ? fd.get("end") : "",
      pieceAmount: user.payForm === "Сдельная" ? Number(fd.get("pieceAmount") || 0) : 0,
    };
    state.data.shifts.push(row);
    persist();
    render();
  };
}

function renderDayShifts() {
  const rows = state.data.shifts.filter((s) => s.date === state.selectedDate);
  el.dayShiftsTable.innerHTML = `<thead><tr><th>Сотрудник</th><th>Тип</th><th>Время</th><th>Сделка</th><th>Действия</th></tr></thead><tbody>${rows
    .map((s) => {
      const u = state.data.users.find((x) => x.id === s.userId);
      if (!u) return "";
      return `<tr data-id="${s.id}"><td>${u.lastName}</td><td>${u.payForm}</td><td>${s.start || "-"} ${s.end ? `- ${s.end}` : ""}</td><td><input type="number" min="0" value="${s.pieceAmount || ""}" ${u.payForm === "Часовая" ? "disabled" : ""} data-piece /></td><td><button class="btn btn-secondary save-shift">Сохранить</button> <button class="btn btn-secondary del-shift">Удалить</button></td></tr>`;
    })
    .join("")}</tbody>`;
  el.dayShiftsTable.querySelectorAll(".save-shift").forEach((b) => {
    b.onclick = () => {
      const tr = b.closest("tr");
      const s = state.data.shifts.find((x) => x.id === tr.dataset.id);
      if (!s) return;
      const piece = tr.querySelector("[data-piece]");
      if (piece && !piece.disabled) s.pieceAmount = Number(piece.value || 0);
      persist();
      render();
    };
  });
  el.dayShiftsTable.querySelectorAll(".del-shift").forEach((b) => {
    b.onclick = () => {
      const id = b.closest("tr").dataset.id;
      state.data.shifts = state.data.shifts.filter((s) => s.id !== id);
      persist();
      render();
    };
  });
}

function renderFinanceFilter() {
  const deps = ["Все отделы", ...state.data.dictionaries.departments];
  if (!state.data.financeFilter) {
    state.data.financeFilter = {
      from: todayISO(),
      to: todayISO(),
      department: "Все отделы",
    };
  }
  const f = state.data.financeFilter;
  el.financeFilter.innerHTML = `
    <label>С <input name="from" type="date" value="${f.from}" /></label>
    <label>По <input name="to" type="date" value="${f.to}" /></label>
    <label>Отдел <select name="department">${deps
      .map((d) => `<option ${d === f.department ? "selected" : ""}>${d}</option>`)
      .join("")}</select></label>
    <button class="btn btn-primary" type="submit">Выгрузить</button>
  `;
  el.financeFilter.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(el.financeFilter);
    state.data.financeFilter = {
      from: fd.get("from"),
      to: fd.get("to"),
      department: fd.get("department"),
    };
    persist();
    renderFinanceTable();
  };
}

function renderFinanceTable() {
  const f = state.data.financeFilter;
  const users = state.data.users.filter((u) => u.role === "employee");
  const from = new Date(f.from);
  const to = new Date(f.to);
  const rows = users
    .filter((u) => f.department === "Все отделы" || u.department === f.department)
    .map((u) => {
      const own = state.data.shifts.filter((s) => {
        if (s.userId !== u.id) return false;
        const d = new Date(s.date);
        return d >= from && d <= to;
      });
      const shiftCount = own.length;
      const hours = own.reduce((acc, s) => acc + hoursBetween(s.start, s.end), 0);
      const salary = own.reduce((acc, s) => acc + calculateShiftPay(s, u), 0);
      const paid = state.data.payouts
        .filter((p) => p.userId === u.id && p.from === f.from && p.to === f.to)
        .reduce((acc, p) => acc + p.amount, 0);
      const due = Math.max(0, salary - paid);
      return { u, shiftCount, hours, salary, paid, due };
    });

  el.financeTable.innerHTML = `<thead><tr><th>Фамилия</th><th>Должность</th><th>Отдел</th><th>Смен</th><th>Часы</th><th>Зарплата</th><th>Выплачено</th><th>Осталось</th><th>Выплатить</th></tr></thead><tbody>${rows
    .map((r) => {
      return `<tr><td>${r.u.lastName}</td><td>${r.u.position}</td><td>${r.u.department}</td><td>${r.shiftCount}</td><td>${r.hours}</td><td>${r.salary.toFixed(2)}</td><td>${r.paid.toFixed(2)}</td><td>${r.due.toFixed(2)}</td><td><button class="btn btn-secondary pay-btn" data-user-id="${r.u.id}" data-amount="${r.due}" ${r.due <= 0 ? "disabled" : ""}>Выплатить</button></td></tr>`;
    })
    .join("")}</tbody>`;

  el.financeTable.querySelectorAll(".pay-btn").forEach((b) => {
    b.onclick = () => {
      const amount = Number(b.dataset.amount || 0);
      if (amount <= 0) return;
      state.data.payouts.push({
        id: crypto.randomUUID(),
        userId: b.dataset.userId,
        amount,
        from: f.from,
        to: f.to,
        paidAt: new Date().toISOString(),
      });
      persist();
      renderFinanceTable();
    };
  });
}

function renderMyCabinet() {
  const u = state.currentUser;
  const nowMonth = state.employeeMonth;
  const [year, month] = nowMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const myMonthShifts = state.data.shifts
    .filter((s) => s.userId === u.id)
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const earned = myMonthShifts.reduce((acc, s) => acc + calculateShiftPay(s, u), 0);
  const paid = state.data.payouts
    .filter((p) => p.userId === u.id)
    .filter((p) => {
      const from = new Date(p.from);
      const to = new Date(p.to);
      return to >= monthStart && from <= monthEnd;
    })
    .reduce((acc, p) => acc + p.amount, 0);
  const due = Math.max(0, earned - paid);

  el.myProfile.innerHTML = `
    <p><strong>${u.lastName} ${u.firstName} ${u.middleName}</strong></p>
    <p>Должность: ${u.position}</p>
    <p>Отдел: ${u.department}</p>
    <p>Форма оплаты: ${u.payForm}${u.payForm === "Часовая" ? ` (${u.hourlyRate} ₽/ч)` : ""}</p>
    <form id="month-selector" class="inline-form">
      <label>Месяц <input type="month" name="month" value="${nowMonth}" /></label>
      <button class="btn btn-secondary" type="submit">Показать</button>
    </form>
    <p><strong>За месяц:</strong> начислено <b>${earned.toFixed(2)} ₽</b>, выплачено <b>${paid.toFixed(2)} ₽</b>, осталось к выплате <b>${due.toFixed(2)} ₽</b>.</p>
  `;

  const monthForm = document.getElementById("month-selector");
  monthForm.onsubmit = (e) => {
    e.preventDefault();
    const chosen = new FormData(monthForm).get("month");
    if (chosen) state.employeeMonth = chosen.toString();
    renderMyCabinet();
  };

  el.myShifts.innerHTML = `<thead><tr><th>Дата</th><th>Тип</th><th>Время</th><th>Начисление</th></tr></thead><tbody>${myMonthShifts
    .map((s) => {
      const amount = calculateShiftPay(s, u);
      return `<tr><td>${s.date}</td><td>${u.payForm}</td><td>${s.start || "-"}${s.end ? ` - ${s.end}` : ""}</td><td>${amount.toFixed(2)} ₽</td></tr>`;
    })
    .join("")}</tbody>`;
}

function calculateShiftPay(shift, user) {
  if (user.payForm === "Часовая") {
    return hoursBetween(shift.start, shift.end) * Number(user.hourlyRate || 0);
  }
  return Number(shift.pieceAmount || 0);
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
      payForms: ["Сдельная", "Часовая"],
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
        payForm: "Часовая",
        hourlyRate: 0,
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
        payForm: "Часовая",
        hourlyRate: 277,
        department: "Склад Самара",
        phone: "79990000001",
        password: "user123",
      },
    ],
    shifts: [],
    payouts: [],
    financeFilter: null,
  };

  if (!raw) return base;
  const data = JSON.parse(raw);
  data.payouts = Array.isArray(data.payouts) ? data.payouts : [];
  return data;
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
