/* /assets/js/time.data.js
   Seed & Data Layer pentru Time & Attendance
   Persistență: localStorage
   Chei:
     - TIME_DB_v1
     - TIME_SETTINGS_v1
   Namespace: window.TIME_APP
*/

(function () {
  const DB_KEY = "TIME_DB_v1";
  const SETTINGS_KEY = "TIME_SETTINGS_v1";

  window.TIME_APP = window.TIME_APP || {};
  const APP = window.TIME_APP;

  /* =========================
     HELPERS
     ========================= */
  const uid = () =>
    "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const daysAgoISO = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const rand = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const randFloat = (min, max, decimals = 1) =>
    +(Math.random() * (max - min) + min).toFixed(decimals);

  const isWeekend = (isoDate) => {
    const d = new Date(isoDate);
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  /* =========================
     DEFAULT SETTINGS
     ========================= */
  const DEFAULT_SETTINGS = {
    standardDailyHours: 8,
    timezone: "Europe/Bucharest",
    allowMobileCheckin: true,
    createdAt: new Date().toISOString(),
  };

  /* =========================
     EMPLOYEES (MIN 15)
     ========================= */
  const EMPLOYEES = [
    { id: "E001", name: "Andrei Popescu", department: "IT" },
    { id: "E002", name: "Maria Ionescu", department: "HR" },
    { id: "E003", name: "Alex Dumitru", department: "Finance" },
    { id: "E004", name: "Ioana Marinescu", department: "Operations" },
    { id: "E005", name: "Vlad Georgescu", department: "IT" },
    { id: "E006", name: "Elena Stan", department: "HR" },
    { id: "E007", name: "Mihai Radu", department: "Sales" },
    { id: "E008", name: "Cristina Pop", department: "Marketing" },
    { id: "E009", name: "Radu Enache", department: "Operations" },
    { id: "E010", name: "Ana Dobre", department: "Finance" },
    { id: "E011", name: "Paul Nistor", department: "IT" },
    { id: "E012", name: "Laura Matei", department: "Sales" },
    { id: "E013", name: "Bogdan Ilie", department: "Operations" },
    { id: "E014", name: "Diana Voicu", department: "Marketing" },
    { id: "E015", name: "Sorin Petrescu", department: "IT" },
  ];

  /* =========================
     SEED GENERATORS
     ========================= */
  function generateTimeEntries(days = 30) {
    const entries = [];

    for (let d = 0; d < days; d++) {
      const date = daysAgoISO(d);

      EMPLOYEES.forEach((emp) => {
        // probabilitate să lipsească (ex: concediu)
        if (Math.random() < 0.1) return;

        const startHour = rand(7, 10);
        const startMin = rand(0, 1) ? "00" : "30";
        const workHours = randFloat(7.5, 10);

        const checkIn = `${String(startHour).padStart(2, "0")}:${startMin}`;
        const end = new Date(`${date}T${checkIn}`);
        end.setMinutes(end.getMinutes() + workHours * 60);

        const checkOut = end.toTimeString().slice(0, 5);

        const sourceRand = Math.random();
        let source = "Web";
        if (sourceRand > 0.75) source = "Mobile";
        if (sourceRand > 0.9) source = "AccessSystem";

        entries.push({
          id: uid(),
          employeeId: emp.id,
          date,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          totalHours: +workHours.toFixed(2),
          source,
          createdAt: new Date(`${date}T${checkIn}`).toISOString(),
        });
      });
    }

    return entries;
  }

  function generateShifts(days = 30) {
    const shifts = [];

    for (let d = 0; d < days; d++) {
      const date = daysAgoISO(d);

      EMPLOYEES.forEach((emp) => {
        if (Math.random() < 0.15) return;

        let type = "Zi";
        let start = "09:00";
        let end = "17:00";

        if (isWeekend(date)) {
          type = "Weekend";
          start = "10:00";
          end = "16:00";
        } else if (Math.random() > 0.8) {
          type = "Noapte";
          start = "22:00";
          end = "06:00";
        }

        shifts.push({
          id: uid(),
          employeeId: emp.id,
          date,
          startTime: start,
          endTime: end,
          type,
          location: Math.random() > 0.7 ? "HQ" : "",
        });
      });
    }

    return shifts;
  }

  function generateOvertime(timeEntries, standardHours) {
    const ot = [];

    timeEntries.forEach((te) => {
      if (te.totalHours > standardHours) {
        const hours = +(te.totalHours - standardHours).toFixed(2);
        const approved = Math.random() > 0.5;

        ot.push({
          id: uid(),
          employeeId: te.employeeId,
          date: te.date,
          hours,
          status: approved ? "Approved" : "Pending",
          approvedBy: approved ? "HR Manager" : null,
          approvedAt: approved ? new Date().toISOString() : null,
          exportedToPayroll: approved ? Math.random() > 0.5 : false,
        });
      }
    });

    return ot;
  }

  /* =========================
     INIT DB
     ========================= */
  function initDB() {
    const existing = localStorage.getItem(DB_KEY);
    if (existing) {
      return JSON.parse(existing);
    }

    const timeEntries = generateTimeEntries(30);
    const shifts = generateShifts(30);
    const overtimeEntries = generateOvertime(
      timeEntries,
      DEFAULT_SETTINGS.standardDailyHours
    );

    const db = {
      meta: {
        version: "1.0",
        createdAt: new Date().toISOString(),
        demo: true,
      },
      employees: EMPLOYEES,
      timeEntries,
      shifts,
      overtimeEntries,
      lastSavedAt: new Date().toISOString(),
    };

    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  function initSettings() {
    const existing = localStorage.getItem(SETTINGS_KEY);
    if (existing) {
      return JSON.parse(existing);
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    return DEFAULT_SETTINGS;
  }

  /* =========================
     PUBLIC API
     ========================= */
  APP.storage = {
    DB_KEY,
    SETTINGS_KEY,

    loadDB() {
      return JSON.parse(localStorage.getItem(DB_KEY));
    },

    saveDB(db) {
      db.lastSavedAt = new Date().toISOString();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    },

    loadSettings() {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY));
    },

    saveSettings(settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },

    resetDemo() {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      initSettings();
      return initDB();
    },
  };

  /* =========================
     BOOTSTRAP
     ========================= */
  APP.db = initDB();
  APP.settings = initSettings();
})();
