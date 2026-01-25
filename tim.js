/* /assets/js/time.js
   Time & Attendance – Firebase Firestore (Employees + TimeEntries)
   Namespace: window.TIME_APP
*/

/* =========================
   FIREBASE IMPORTS (CDN)
   ========================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG (exact cum ați cerut)
   ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyA7Yo85miL9_a7d56LGj9MJy2ZGlEpFUr0",
  authDomain: "lucidatatech-time.firebaseapp.com",
  projectId: "lucidatatech-time",
  storageBucket: "lucidatatech-time.firebasestorage.app",
  messagingSenderId: "549755933178",
  appId: "1:549755933178:web:afe40fc567e362e1a69443",
  measurementId: "G-99528FFGYW"
};

/* =========================
   INIT FIREBASE
   ========================= */
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e) { /* analytics poate eșua local/unele browsere */ }
const db = getFirestore(app);

/* =========================
   TIME APP MODULE
   ========================= */
(function () {
  if (!window.TIME_APP) window.TIME_APP = {};
  const APP = window.TIME_APP;

  /* =========================
     STATE
     ========================= */
  const state = {
    activeTab: "overview",
    selectedDate: new Date().toISOString().slice(0, 10),
    mobileMode: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    employees: [],
    allEntries: [] // timeEntries din Firestore
  };

  /* =========================
     HELPERS
     ========================= */
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const nowTimeHHMM = () => new Date().toTimeString().slice(0, 5);

  const toast = (msg) => {
    const el = document.createElement("div");
    el.className = "card toast-msg";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };

  const asBool = (v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return ["true", "1", "yes", "da"].includes(v.trim().toLowerCase());
    return !!v;
  };

  const asNumber = (v) => {
    if (typeof v === "number") return v;
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  /* =========================
     FIRESTORE: LOAD EMPLOYEES
     Colecție: employees
     Câmpuri (din captura dvs.): Nume, activ, email, functie, salariu
     ========================= */
  async function loadEmployees() {
    const snap = await getDocs(collection(db, "employees"));

    state.employees = snap.docs.map((d) => {
      const data = d.data() || {};
      // suportă atât "Nume" cât și "name"
      const name = data.Nume ?? data.name ?? data.nume ?? "Angajat";

      return {
        id: d.id,
        name: String(name),
        email: data.email ? String(data.email) : "",
        functie: data.functie ? String(data.functie) : "",
        activ: asBool(data.activ),
        salariu: asNumber(data.salariu)
      };
    });

    // compatibilitate cu restul platformei (APP.db.employees)
    APP.db = APP.db || {};
    APP.db.employees = state.employees;
  }

  function populateEmployeeSelect() {
    const sel = $("#punchEmployeeSelect");
    if (!sel) return;

    sel.innerHTML = `<option value="">Selectați angajat</option>`;

    (state.employees || [])
      .filter((e) => e.activ !== false) // dacă lipsește, îl considerăm activ
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((e) => {
        const opt = document.createElement("option");
        opt.value = e.id;
        opt.textContent = e.functie ? `${e.name} – ${e.functie}` : e.name;
        sel.appendChild(opt);
      });
  }

  /* =========================
     FIRESTORE: LOAD TIME ENTRIES
     Colecție: timeEntries
     ========================= */
  async function loadTimeEntries() {
    const q = query(
      collection(db, "timeEntries"),
      orderBy("createdAt", "desc"),
      limit(500) // limită rezonabilă pentru UI
    );

    const snap = await getDocs(q);
    state.allEntries = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  }

  /* =========================
     CHECK-IN / CHECK-OUT (CLOUD)
     ========================= */
  async function handleCheckInOut(isCheckIn) {
    const empId = $("#punchEmployeeSelect")?.value;
    if (!empId) return toast("Selectați un angajat.");

    const date = $("#punchDate")?.value || state.selectedDate;

    // Re-încărcăm rapid lista înainte de acțiune pentru consistență
    // (mai ales dacă lucrați în paralel în mai multe device-uri)
    await loadTimeEntries();

    const existing = state.allEntries.find(
      (e) => e.employeeId === empId && e.date === date
    );

    if (isCheckIn) {
      if (existing?.checkInTime) return toast("Check-in deja efectuat.");

      await addDoc(collection(db, "timeEntries"), {
        employeeId: empId,
        date,
        checkInTime: nowTimeHHMM(),
        checkOutTime: null,
        totalHours: null,
        source: state.mobileMode ? "Mobile" : "Web",
        createdAt: serverTimestamp()
      });

      toast("Check-in salvat în cloud.");
    } else {
      if (!existing || existing.checkOutTime) return toast("Nu există check-in activ.");

      const out = nowTimeHHMM();
      const start = new Date(`${date}T${existing.checkInTime}`);
      const end = new Date(`${date}T${out}`);
      const totalHours = +((end - start) / 36e5).toFixed(2);

      await updateDoc(doc(db, "timeEntries", existing.id), {
        checkOutTime: out,
        totalHours
      });

      toast("Check-out salvat în cloud.");
    }

    await loadTimeEntries();
    render();
  }

  /* =========================
     RENDERING
     ========================= */
  function renderOverview() {
    const today = state.selectedDate;
    const entriesToday = state.allEntries.filter((e) => e.date === today);

    if ($("#kpiCheckedInToday")) $("#kpiCheckedInToday").textContent = String(entriesToday.length);

    const tbody = $("#tblRecentCheckins");
    if (!tbody) return;

    tbody.innerHTML = "";

    entriesToday.slice(0, 6).forEach((e) => {
      const emp = (state.employees || []).find((x) => x.id === e.employeeId)
        || APP.db?.employees?.find((x) => x.id === e.employeeId);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp?.name || "Angajat"}</td>
        <td>${e.date || "-"}</td>
        <td>${e.checkInTime || "-"}</td>
        <td><span class="badge badge-soft">${e.source || "Web"}</span></td>
        <td class="right"><span class="badge">CLOUD</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPunchDay() {
    const date = $("#punchDate")?.value || state.selectedDate;
    const tb = $("#tblPunchDay");
    if (!tb) return;

    tb.innerHTML = "";

    state.allEntries
      .filter((e) => e.date === date)
      .forEach((e) => {
        const emp = (state.employees || []).find((x) => x.id === e.employeeId)
          || APP.db?.employees?.find((x) => x.id === e.employeeId);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${emp?.name || "Angajat"}</td>
          <td>${e.checkInTime || "-"}</td>
          <td>${e.checkOutTime || "-"}</td>
          <td>${(e.totalHours ?? "-")}</td>
          <td>${e.source || "Web"}</td>
          <td class="right">Cloud</td>
        `;
        tb.appendChild(tr);
      });
  }

  function render() {
    if (state.activeTab === "overview") renderOverview();
    if (state.activeTab === "punch") renderPunchDay();
  }

  /* =========================
     NAV / INIT
     ========================= */
  function switchTab(tab) {
    state.activeTab = tab;
    $$(".tab, .nav-item, .tab-panel").forEach((el) => {
      el.classList.toggle("active", el.dataset.tab === tab || el.dataset.panel === tab);
    });
    render();
  }

  async function init() {
    // Loader (dacă există)
    const loader = $("#appLoader");
    if (loader) loader.style.display = "";

    // 1) Încărcăm angajații din Firestore
    await loadEmployees();
    populateEmployeeSelect();

    // 2) Încărcăm pontajele din Firestore
    await loadTimeEntries();

    // 3) Ceas
    setInterval(() => {
      const c = $("#liveClock");
      if (c) c.textContent = new Date().toTimeString().slice(0, 8);
    }, 1000);

    // 4) Butoane
    $("#btnCheckIn")?.addEventListener("click", () => handleCheckInOut(true));
    $("#btnCheckOut")?.addEventListener("click", () => handleCheckInOut(false));

    // 5) Tabs
    $$(".tab, .nav-item").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.tab));
    });

    // 6) Render inițial
    render();

    // 7) Ascunde loader
    if (loader) setTimeout(() => (loader.style.display = "none"), 300);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      console.error("TIME init error:", err);
      toast("Eroare inițializare Firebase/Firestore. Verificați consola (F12).");
      const loader = $("#appLoader");
      if (loader) loader.style.display = "none";
    });
  });
})();
