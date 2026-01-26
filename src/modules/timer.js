import { db } from "../services/firebaseConfig.js";
import { collection, addDoc } from "firebase/firestore";
import { getCurrentUser } from "./auth.js";
import { formatTime, showAlert, getStyle } from "./utils.js";
import { loadHistory } from "./data.js";

let activeSession = null;
let timerInterval = null;
let appSettings = JSON.parse(localStorage.getItem('app_settings') || '{"showSeconds": true}');

// DOM Elements (Cached)
const dom = {
    setup: () => document.getElementById('tracker-setup'),
    active: () => document.getElementById('tracker-active'),
    display: () => document.getElementById('timer-display'),
    subjDisp: () => document.getElementById('active-subject'),
    methDisp: () => document.getElementById('active-method'),
    overlay: () => document.getElementById('overlay-paused'),
    reasonDisp: () => document.getElementById('pause-reason-display'),
    btnToggleSecs: () => document.getElementById('btn-toggle-seconds')
};

export const initTimer = () => {
    // Session Recovery
    const saved = localStorage.getItem('study_session');
    if (saved) {
        activeSession = JSON.parse(saved);
        if (activeSession.status === 'running') {
            resumeTimerUI(activeSession);
        } else if (activeSession.status === 'paused') {
            pauseTimerUI(activeSession);
        }
    }

    // Bind Buttons
    document.getElementById('btn-start-session').onclick = startSession;
    document.getElementById('btn-pause-session').onclick = promptPause;
    document.getElementById('btn-stop-session').onclick = stopSession;

    // Pause Logic Buttons
    // Pause Logic Buttons (Delegation for dynamic items)
    const grid = document.getElementById('pause-reasons-grid');
    if (grid) {
        grid.onclick = (e) => {
            const btn = e.target.closest('.btn-pause-reason');
            if (btn) confirmPause(btn.getAttribute('data-reason'));
        };
    }
    document.getElementById('btn-custom-pause').onclick = () => {
        const r = prompt("Motivo:");
        if (r) confirmPause(r);
    };
    document.getElementById('btn-cancel-pause').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
    };

    // Overlay Resume
    document.getElementById('btn-resume-overlay').onclick = resumeSession;

    // Settings (Seconds Toggle)
    const btnSec = document.getElementById('btn-toggle-seconds');
    if (btnSec) btnSec.onclick = toggleSeconds;

    renderSettingsUI();
};

const startSession = () => {
    const sub = document.getElementById('sel-subject').value;
    const met = document.getElementById('sel-method').value;

    if (!sub) return showAlert("Selecciona una materia");

    activeSession = {
        uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
        subject: sub,
        method: met,
        startTime: Date.now(),
        interruptions: [],
        status: 'running'
    };
    saveLocal();
    resumeTimerUI(activeSession);
};

const resumeTimerUI = (session) => {
    dom.setup().classList.add('hidden');
    dom.active().classList.remove('hidden');
    dom.subjDisp().textContent = session.subject;
    dom.methDisp().textContent = session.method;

    startLoop();
};

const startLoop = () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
    tick();
};

const tick = () => {
    if (!activeSession || activeSession.status !== 'running') return;

    const now = Date.now();
    const totalPaused = activeSession.interruptions.reduce((acc, i) => acc + (i.duration || 0), 0);
    const gross = now - activeSession.startTime;
    const net = Math.max(0, gross - totalPaused);

    dom.display().textContent = formatTime(net, appSettings.showSeconds);
};

// --- PAUSE ---
const promptPause = () => {
    document.getElementById('modal-pause').classList.remove('hidden');
};

const confirmPause = (reason) => {
    document.getElementById('modal-pause').classList.add('hidden');
    activeSession.status = 'paused';
    activeSession.pauseStart = Date.now();
    activeSession.currentPauseReason = reason;
    saveLocal();

    clearInterval(timerInterval);
    pauseTimerUI(activeSession);
};

const pauseTimerUI = (session) => {
    dom.setup().classList.add('hidden');
    dom.active().classList.remove('hidden');

    // Show Overlay
    dom.reasonDisp().textContent = session.currentPauseReason;
    dom.overlay().classList.remove('hidden');

    // Update display one last time
    const now = session.pauseStart || Date.now();
    const totalPaused = session.interruptions.reduce((acc, i) => acc + (i.duration || 0), 0);
    const net = Math.max(0, (now - session.startTime) - totalPaused);
    dom.display().textContent = formatTime(net, appSettings.showSeconds);
};

const resumeSession = () => {
    dom.overlay().classList.add('hidden');

    if (activeSession.status === 'paused') {
        const now = Date.now();
        const dur = now - activeSession.pauseStart;

        activeSession.interruptions.push({
            start: activeSession.pauseStart,
            end: now,
            duration: dur,
            reason: activeSession.currentPauseReason
        });

        activeSession.status = 'running';
        delete activeSession.pauseStart;
        delete activeSession.currentPauseReason;
        saveLocal();
        startLoop();
    }
};

const stopSession = async () => {
    clearInterval(timerInterval);
    const now = Date.now();
    let totalPaused = activeSession.interruptions.reduce((acc, i) => acc + (i.duration || 0), 0);
    const gross = now - activeSession.startTime;
    const net = gross - totalPaused;
    let eff = gross > 0 ? Math.round((net / gross) * 100) : 0;

    const sessionData = {
        ...activeSession,
        endTime: now,
        grossDuration: gross,
        netDuration: net,
        efficiency: eff,
        createdAt: now
    };
    delete sessionData.status;

    // Reset UI
    localStorage.removeItem('study_session');
    activeSession = null;
    dom.active().classList.add('hidden');
    dom.setup().classList.remove('hidden');
    dom.display().textContent = "00:00";

    // Save
    const user = getCurrentUser();
    if (user) {
        try {
            await addDoc(collection(db, 'study_sessions'), sessionData);
            showAlert(`Guardado en Nube. Eficiencia: ${eff}%`);
        } catch (e) {
            console.error(e);
            showAlert("Error al guardar en nube.");
        }
    } else {
        const h = JSON.parse(localStorage.getItem('guest_study_history') || '[]');
        h.push(sessionData);
        localStorage.setItem('guest_study_history', JSON.stringify(h));
        showAlert(`Guardado Local. Eficiencia: ${eff}%`);
        loadHistory();
    }
};

const saveLocal = () => {
    if (activeSession) localStorage.setItem('study_session', JSON.stringify(activeSession));
};

// --- SETTINGS ---
const toggleSeconds = () => {
    appSettings.showSeconds = !appSettings.showSeconds;
    localStorage.setItem('app_settings', JSON.stringify(appSettings));
    renderSettingsUI();
    if (activeSession) tick(); // update display
};

const renderSettingsUI = () => {
    const btn = dom.btnToggleSecs();
    if (!btn) return;
    const knob = btn.firstElementChild;
    if (appSettings.showSeconds) {
        btn.className = "w-12 h-6 bg-[#a5f5c3] rounded-full relative transition-colors duration-300";
        knob.className = "w-4 h-4 bg-white rounded-full absolute top-1 right-1 transition-transform duration-300";
    } else {
        btn.className = "w-12 h-6 bg-[#d1cbc1] rounded-full relative transition-colors duration-300";
        knob.className = "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300";
    }
};
