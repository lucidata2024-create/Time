/* /assets/js/time.js
   Time & Attendance – Firebase Live Version
   Namespace: window.TIME_APP
*/

// 1. IMPORTURI FIREBASE (Curg direct din CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, where, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. CONFIGURAȚIA TA (Lipește aici ce ai în poza de pe laptop)
const firebaseConfig = {
  apiKey: "AIzaSyCNpkbtJSU0lrJ47zpWkWgdKv-EjQc5G0w",
  authDomain: "lucidata-6ae50.firebaseapp.com",
  projectId: "lucidata-6ae50",
  storageBucket: "lucidata-6ae50.firebasestorage.app",
  messagingSenderId: "314162675492",
  appId: "1:314162675492:web:3174cc0ef22537a67dbdb1"
};

// Inițializare
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

(function () {
  const APP = window.TIME_APP;
  
  const state = {
    activeTab: "overview",
    selectedDate: new Date().toISOString().slice(0, 10),
    mobileMode: false,
    allEntries: [] // Aici vom stoca datele care vin din Firebase
  };

  const safe = (q) => document.querySelector(q);
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  const fmtHours = (h) => (+h).toFixed(2);
  const nowTime = () => new Date().toTimeString().slice(0, 8);

  const toast = (msg) => {
    const el = document.createElement("div");
    el.className = "card toast-msg"; // Adaugă un pic de CSS pentru asta
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  /* =========================
     LOGICA FIREBASE (ÎNLOCUIEȘTE STORAGE)
     ========================= */
  
  // ASCULTĂTOR LIVE: Această funcție vede când tatăl tău se pontează
  function startLiveSync() {
    const q = query(collection(db, "timeEntries"), orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
      state.allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render(); // Redesenează totul instantaneu
    });
  }

  async function handleCheckInOut(isCheckIn) {
    const empId = safe("#punchEmployeeSelect")?.value;
    if (!empId) return;

    const date = safe("#punchDate")?.value || state.selectedDate;
    
    // Căutăm dacă există deja un pontaj pe azi pentru acest angajat
    const existing = state.allEntries.find(e => e.employeeId === empId && e.date === date);

    if (isCheckIn) {
      if (existing?.checkInTime) {
        toast("Check-in deja efectuat!");
        return;
      }

      await addDoc(collection(db, "timeEntries"), {
        employeeId: empId,
        date: date,
        checkInTime: nowTime().slice(0, 5),
        source: state.mobileMode ? "Mobile" : "Web",
        createdAt: serverTimestamp() // Ora oficială Google
      });
      toast("Pontaj Intrare salvat global!");
    } else {
      if (!existing || existing.checkOutTime) {
        toast("Nu există check-in activ!");
        return;
      }

      const entryRef = doc(db, "timeEntries", existing.id);
      const checkOutTime = nowTime().slice(0, 5);
      
      // Calcul simplu ore
      const start = new Date(`${date}T${existing.checkInTime}`);
      const end = new Date(`${date}T${checkOutTime}`);
      const totalHours = +((end - start) / 36e5).toFixed(2);

      await updateDoc(entryRef, {
        checkOutTime: checkOutTime,
        totalHours: totalHours
      });
      toast("Pontaj Ieșire salvat global!");
    }
  }

  /* =========================
     RENDERING (UPDATE PENTRU FIREBASE)
     ========================= */
  function renderOverview() {
    const today = state.selectedDate;
    const entriesToday = state.allEntries.filter(e => e.date === today);

    if(safe("#kpiCheckedInToday")) safe("#kpiCheckedInToday").textContent = entriesToday.length;
    
    const tbody = safe("#tblRecentCheckins");
    if (!tbody) return;
    tbody.innerHTML = "";

    state.allEntries.slice(0, 6).forEach((e) => {
      const emp = APP.db.employees.find(x => x.id === e.employeeId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp?.name || "Angajat"}</td>
        <td>${e.date}</td>
        <td>${e.checkInTime}</td>
        <td><span class="badge badge-soft">${e.source}</span></td>
        <td class="right"><span class="badge">LIVE</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderPunchDay() {
    const date = safe("#punchDate")?.value || state.selectedDate;
    const tb = safe("#tblPunchDay");
    if (!tb) return;

    tb.innerHTML = "";
    state.allEntries.filter(e => e.date === date).forEach(e => {
      const emp = APP.db.employees.find(x => x.id === e.employeeId);
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

  /* =========================
     LOGICA EXISTENTĂ (ADAPTATĂ)
     ========================= */
  function render() {
    if (state.activeTab === "overview") renderOverview();
    if (state.activeTab === "punch") renderPunchDay();
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$(".tab, .nav-item, .tab-panel").forEach(el => {
        if(el.dataset.tab === tab || el.dataset.panel === tab) el.classList.add("active");
        else el.classList.remove("active");
    });
    render();
  }

  function init() {
    // Pornim ceasul și sincronizarea
    setInterval(() => { if(safe("#liveClock")) safe("#liveClock").textContent = nowTime(); }, 1000);
    
    // Event Listeners
    safe("#btnCheckIn")?.addEventListener("click", () => handleCheckInOut(true));
    safe("#btnCheckOut")?.addEventListener("click", () => handleCheckInOut(false));
    
    $$(".tab, .nav-item").forEach(el => el.addEventListener("click", () => switchTab(el.dataset.tab)));
    
    // Pornim ascultarea bazei de date
    startLiveSync();
    
    // Ascundem loader-ul
    setTimeout(() => { if(safe("#appLoader")) safe("#appLoader").style.display = "none"; }, 500);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
