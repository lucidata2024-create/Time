/* /assets/js/time.js
   Time & Attendance – UI + Logic
   Namespace: window.TIME_APP
   Fără backend · localStorage · UX simplu și robust
*/

(function () {
  const APP = window.TIME_APP;
  if (!APP || !APP.storage) {
    console.error("TIME_APP.storage lipsă");
    return;
  }

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

  /* =========================
     STATE
     ========================= */
  const state = {
    activeTab: "overview",
    selectedDate: new Date().toISOString().slice(0, 10),
    selectedEmployeeId: null,
    mobileMode: false,
    shiftView: "month",
    shiftCursor: new Date(),
  };

  /* =========================
     DOM HELPERS
     ========================= */
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const safe = (q) => document.querySelector(q);

  const fmtHours = (h) => (+h).toFixed(2);
  const nowTime = () => new Date().toTimeString().slice(0, 8);

  const toast = (msg) => {
    const el = document.createElement("div");
    el.className = "card";
    el.textContent = msg;
    safe("#toastStack")?.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  /* =========================
     LOADER
     ========================= */
  function hideLoader() {
    setTimeout(() => {
      const loader = safe("#appLoader");
      if (loader) loader.style.display = "none";
    }, 400);
  }

  /* =========================
     CLOCK
     ========================= */
  function startClock() {
    const el = safe("#liveClock");
    if (!el) return;
    setInterval(() => {
      el.textContent = nowTime();
    }, 1000);
  }

  /* =========================
     TABS & NAV
     ========================= */
  function switchTab(tab) {
    state.activeTab = tab;

    $$(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === tab)
    );
    $$(".nav-item").forEach((n) =>
      n.classList.toggle("active", n.dataset.tab === tab)
    );
    $$(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.dataset.panel === tab)
    );

    render();
  }

  function bindTabs() {
    $$(".tab").forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab))
    );
    $$(".nav-item").forEach((n) =>
      n.addEventListener("click", () => switchTab(n.dataset.tab))
    );
  }

  /* =========================
     SELECTS (SAFE)
     ========================= */
  function fillEmployeeSelects() {
    const selects = [
      safe("#punchEmployeeSelect"),
      safe("#mpEmployee"),
      safe("#msEmployee"), // poate lipsi
    ].filter(Boolean);

    selects.forEach((sel) => {
      sel.innerHTML = "";
      APP.db.employees.forEach((e) => {
        const o = document.createElement("option");
        o.value = e.id;
        o.textContent = `${e.name} (${e.department})`;
        sel.appendChild(o);
      });
    });

    state.selectedEmployeeId = APP.db.employees[0]?.id || null;
    if (safe("#punchEmployeeSelect")) {
      safe("#punchEmployeeSelect").value = state.selectedEmployeeId;
    }
  }

  /* =========================
     OVERVIEW
     ========================= */
  function renderOverview() {
    const today = state.selectedDate;
    const entriesToday = APP.db.timeEntries.filter(
      (e) => e.date === today
    );

    safe("#kpiCheckedInToday").textContent = entriesToday.length;
    safe("#kpiHoursToday").textContent = fmtHours(
      entriesToday.reduce((s, e) => s + (e.totalHours || 0), 0)
    );

    const month = today.slice(0, 7);
    const otMonth = APP.db.overtimeEntries.filter((o) =>
      o.date.startsWith(month)
    );
    safe("#kpiOTMonth").textContent = fmtHours(
      otMonth.reduce((s, o) => s + o.hours, 0)
    );

    const tbody = safe("#tblRecentCheckins");
    if (!tbody) return;
    tbody.innerHTML = "";

    APP.db.timeEntries
      .slice(-6)
      .reverse()
      .forEach((e) => {
        const emp = APP.db.employees.find(x => x.id === e.employeeId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${emp?.name || e.employeeId}</td>
          <td>${e.date}</td>
          <td>${e.checkInTime}</td>
          <td><span class="badge badge-soft">${e.source}</span></td>
          <td class="right"><span class="badge">OK</span></td>
        `;
        tbody.appendChild(tr);
      });
  }

  /* =========================
     PUNCH
     ========================= */
  function canEdit(entry) {
    return Date.now() - new Date(entry.createdAt).getTime() < 86400000;
  }

  function handleCheckInOut(isCheckIn) {
    const empId = safe("#punchEmployeeSelect")?.value;
    if (!empId) return;

    const date = safe("#punchDate")?.value || state.selectedDate;
    const existing = APP.db.timeEntries.find(
      e => e.employeeId === empId && e.date === date
    );

    if (isCheckIn) {
      if (existing?.checkInTime) {
        toast("Check-in deja efectuat");
        return;
      }

      const entry = existing || {
        id: "id-" + Date.now(),
        employeeId: empId,
        date,
        createdAt: new Date().toISOString(),
      };

      entry.checkInTime = nowTime().slice(0, 5);
      entry.source = state.mobileMode ? "Mobile" : "Web";

      if (!existing) APP.db.timeEntries.push(entry);
      APP.storage.saveDB(APP.db);
    } else {
      if (!existing?.checkInTime || existing.checkOutTime || !canEdit(existing)) {
        toast("Check-out invalid");
        return;
      }

      existing.checkOutTime = nowTime().slice(0, 5);
      const start = new Date(`${date}T${existing.checkInTime}`);
      const end = new Date(`${date}T${existing.checkOutTime}`);
      existing.totalHours = +((end - start) / 36e5).toFixed(2);
      APP.storage.saveDB(APP.db);
    }

    renderPunchDay();
    renderOverview();
  }

  function renderPunchDay() {
    const date = safe("#punchDate")?.value || state.selectedDate;
    const tb = safe("#tblPunchDay");
    if (!tb) return;

    tb.innerHTML = "";
    APP.db.timeEntries
      .filter(e => e.date === date)
      .forEach(e => {
        const emp = APP.db.employees.find(x => x.id === e.employeeId);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${emp?.name}</td>
          <td>${e.checkInTime || "-"}</td>
          <td>${e.checkOutTime || "-"}</td>
          <td>${e.totalHours ? fmtHours(e.totalHours) : "-"}</td>
          <td>${e.source}</td>
          <td class="right">${canEdit(e) ? "—" : "Locked"}</td>
        `;
        tb.appendChild(tr);
      });
  }

  /* =========================
     SETTINGS
     ========================= */
  function loadSettings() {
    safe("#setStandardHours").value = APP.settings.standardDailyHours;
    safe("#setTimezone").value = APP.settings.timezone;
    safe("#setAllowMobile").value = APP.settings.allowMobileCheckin;
    safe("#tzLabel").textContent = APP.settings.timezone;
  }

  function saveSettings() {
    APP.settings.standardDailyHours = +safe("#setStandardHours").value;
    APP.settings.timezone = safe("#setTimezone").value;
    APP.settings.allowMobileCheckin = safe("#setAllowMobile").value === "true";
    APP.storage.saveSettings(APP.settings);
    toast("Setări salvate");
  }

  /* =========================
     RENDER
     ========================= */
  function render() {
    if (state.activeTab === "overview") renderOverview();
    if (state.activeTab === "punch") renderPunchDay();
  }

  /* =========================
     EVENTS
     ========================= */
  function bindEvents() {
    safe("#btnCheckIn")?.addEventListener("click", () => handleCheckInOut(true));
    safe("#btnCheckOut")?.addEventListener("click", () => handleCheckInOut(false));
    safe("#btnQuickCheckIn")?.addEventListener("click", () => handleCheckInOut(true));
    safe("#btnQuickCheckOut")?.addEventListener("click", () => handleCheckInOut(false));

    safe("#toggleMobileMode")?.addEventListener("change", (e) => {
      state.mobileMode = e.target.checked;
      safe("#mobileModeBadge").textContent = state.mobileMode ? "Mobile" : "Web";
    });

    safe("#btnSaveSettings")?.addEventListener("click", saveSettings);
    safe("#btnResetDemo")?.addEventListener("click", () => {
      APP.db = APP.storage.resetDemo();
      fillEmployeeSelects();
      render();
      toast("Demo resetat");
    });
  }

  /* =========================
     INIT
     ========================= */
  function init() {
    safe("#yearNow").textContent = new Date().getFullYear();
    fillEmployeeSelects();
    bindTabs();
    bindEvents();
    loadSettings();
    startClock();
    render();
    hideLoader();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
