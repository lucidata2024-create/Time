/* /assets/js/time.js
   Time & Attendance – Firebase Firestore LIVE
   Namespace: window.TIME_APP
*/

/* =========================
   FIREBASE IMPORTS
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
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

const app = initializeApp(firebaseConfig);
getAnalytics(app);
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
    mobileMode: /Android|iPhone/i.test(navigator.userAgent),
    allEntries: []
  };

  /* =========================
     HELPERS
     ========================= */

  const $ = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const nowTime = () => new Date().toTimeString().slice(0, 5);

  const toast = (msg) => {
    const el = document.createElement("div");
    el.className = "card toast-msg";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  };

  /* =========================
     FIRESTORE LOAD
     ========================= */

  async function loadCloudData() {
    const q = query(
      collection(db, "timeEntries"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);
    state.allEntries = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  }

  /* =========================
     CHECK-IN / CHECK-OUT (CLOUD)
     ========================= */

  async function handleCheckInOut(isCheckIn) {
    const empId = $("#punchEmployeeSelect")?.value;
    if (!empId) return toast("Selectați un angajat");

    const date = $("#punchDate")?.value || state.selectedDate;
    const existing = state.allEntries.find(
      e => e.employeeId === empId && e.date === date
    );

    if (isCheckIn) {
      if (existing?.checkInTime)
        return toast("Check-in deja efectuat");

      await addDoc(collection(db, "timeEntries"), {
        employeeId: empId,
        date,
        checkInTime: nowTime(),
        checkOutTime: null,
        totalHours: null,
        source: state.mobileMode ? "Mobile" : "Web",
        createdAt: serverTimestamp()
      });

      toast("Check-in salvat în cloud");
    } else {
      if (!existing || existing.checkOutTime)
        return toast("Nu există check-in activ");

      const endTime = nowTime();
      const start = new Date(`${date}T${existing.checkInTime}`);
      const end = new Date(`${date}T${endTime}`);
      const totalHours = +((end - start) / 36e5).toFixed(2);

      await updateDoc(doc(db, "timeEntries", existing.id), {
        checkOutTime: endTime,
        totalHours
      });

      toast("Check-out salvat în cloud");
    }

    await loadCloudData();
    render();
  }

  /* =========================
     RENDER
     ========================= */

  function renderOverview() {
    const todayEntries = state.allEntries.filter(
      e => e.date === state.selectedDate
    );

    $("#kpiCheckedInToday") &&
      ($("#kpiCheckedInToday").textContent = todayEntries.length);

    const tb = $("#tblRecentCheckins");
    if (!tb) return;
    tb.innerHTML = "";

    todayEntries.slice(0, 6).forEach(e => {
      const emp = APP.db?.employees?.find(x => x.id === e.employeeId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp?.name || "Angajat"}</td>
        <td>${e.date}</td>
        <td>${e.checkInTime || "-"}</td>
        <td><span class="badge">${e.source}</span></td>
        <td class="right"><span class="badge">LIVE</span></td>
      `;
      tb.appendChild(tr);
    });
  }

  function renderPunchDay() {
    const date = $("#punchDate")?.value || state.selectedDate;
    const tb = $("#tblPunchDay");
    if (!tb) return;
    tb.innerHTML = "";

    state.allEntries.filter(e => e.date === date).forEach(e => {
      const emp = APP.db?.employees?.find(x => x.id === e.employeeId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp?.name || "Angajat"}</td>
        <td>${e.checkInTime || "-"}</td>
        <td>${e.checkOutTime || "-"}</td>
        <td>${e.totalHours || "-"}</td>
        <td>${e.source}</td>
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
     INIT
     ========================= */

  function switchTab(tab) {
    state.activeTab = tab;
    $$(".tab, .nav-item, .tab-panel").forEach(el => {
      el.classList.toggle(
        "active",
        el.dataset.tab === tab || el.dataset.panel === tab
      );
    });
    render();
  }

  async function init() {
    await loadCloudData();

    setInterval(() => {
      $("#liveClock") && ($("#liveClock").textContent = nowTime());
    }, 1000);

    $("#btnCheckIn")?.addEventListener("click", () => handleCheckInOut(true));
    $("#btnCheckOut")?.addEventListener("click", () => handleCheckInOut(false));

    $$(".tab, .nav-item").forEach(el =>
      el.addEventListener("click", () => switchTab(el.dataset.tab))
    );

    render();

    setTimeout(() => {
      $("#appLoader") && ($("#appLoader").style.display = "none");
    }, 400);
  }

  document.addEventListener("DOMContentLoaded", init);

})();
