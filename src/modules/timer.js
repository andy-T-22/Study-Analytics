import { db } from "../services/firebaseConfig.js";
import { collection, addDoc } from "firebase/firestore";
import { getCurrentUser } from "./auth.js";
import { formatTime, showAlert, getStyle } from "./utils.js";
import { loadHistory, getSubjects, getMethods } from "./data.js";
import { getFeedback } from "./feedback.js";
import { renderDailyPlan } from "./dailyGoal.js"; // New Import
import { faviconAnimator } from "./favicon.js";

let activeSession = null;
let timerInterval = null;
let appSettings = JSON.parse(localStorage.getItem('app_settings') || '{"showSeconds": true, "showFavicon": true}');

// DOM Elements (Cached)
const dom = {
    setup: () => document.getElementById('tracker-setup'),
    active: () => document.getElementById('tracker-active'),
    dailyPlan: () => document.getElementById('daily-plan-panel'), // New
    display: () => document.getElementById('timer-display'),
    subjDisp: () => document.getElementById('active-subject'),
    methDisp: () => document.getElementById('active-method'),
    overlay: () => document.getElementById('overlay-paused'),
    reasonDisp: () => document.getElementById('pause-reason-display'),
    btnToggleSecs: () => document.getElementById('btn-toggle-seconds'),
    btnToggleFav: () => document.getElementById('btn-toggle-favicon'),
    // Post Session Modal
    postModal: () => document.getElementById('modal-post-session'),
    postSub: () => document.getElementById('post-subject'),
    postGoal: () => document.getElementById('post-goal'),
    postGoalWrap: () => document.getElementById('post-goal-wrapper'),
    postMeth: () => document.getElementById('post-method'),
    btnPostContinue: () => document.getElementById('btn-post-continue'),
    // Summary Modal
    summaryModal: () => document.getElementById('modal-summary'),
    sumPhrase: () => document.getElementById('sum-phrase'),
    sumSugerencia: () => document.getElementById('sum-sugerencia'),
    sumConcVal: () => document.getElementById('sum-conc-val'),
    sumStudyTime: () => document.getElementById('sum-study-time'),
    sumTotalTime: () => document.getElementById('sum-total-time'),
    sumPauseTime: () => document.getElementById('sum-pause-time'),
    sumPauseCount: () => document.getElementById('sum-pause-count'),
    barStudy: () => document.getElementById('bar-study'),
    barPause: () => document.getElementById('bar-pause'),
    btnCloseSum: () => document.getElementById('btn-close-summary')
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

    // Summary Close
    if (dom.btnCloseSum()) {
        dom.btnCloseSum().onclick = closeSummaryAndReset;
    }

    // Settings (Seconds Toggle)
    const btnSec = document.getElementById('btn-toggle-seconds');
    if (btnSec) btnSec.onclick = toggleSeconds;

    const btnFav = document.getElementById('btn-toggle-favicon');
    if (btnFav) btnFav.onclick = toggleFavicon;

    // Initialize Favicon State
    faviconAnimator.setEnabled(appSettings.showFavicon);

    // Goal Filter Logic
    if (dom.postSub()) dom.postSub().onchange = updatePostGoalDropdown;
    document.addEventListener('goals-updated', updatePostGoalDropdown); // Listen for data changes

    // Post Session Resume
    if (dom.btnPostContinue()) dom.btnPostContinue().onclick = completeSession;

    renderSettingsUI();
    initDebug();
};

const initDebug = () => {
    const btn = document.getElementById('btn-debug-sim');
    if (btn) {
        btn.onclick = () => {
            const totalMin = parseInt(document.getElementById('dbg-total').value) || 60;
            const count = parseInt(document.getElementById('dbg-count').value) || 0;
            const intMin = parseInt(document.getElementById('dbg-int-min').value) || 0;
            simulateSession(totalMin, count, intMin);
        };
    }
};

const simulateSession = (totalMin, intCount, intMin) => {
    // Force close settings header
    document.getElementById('modal-settings').classList.add('hidden');

    const now = Date.now();
    const totalMs = totalMin * 60000;
    const intMs = intMin * 60000;

    // Create fake interruptions
    const interruptions = [];
    if (intCount > 0) {
        const avgInt = intMs / intCount;
        for (let i = 0; i < intCount; i++) {
            interruptions.push({
                duration: avgInt,
                reason: 'Simulated Debug'
            });
        }
    }

    // Set global activeSession (bypass checks)
    activeSession = {
        uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
        subject: 'Debug Matter',
        method: 'Debug Method',
        goalId: null,
        startTime: now - totalMs,
        interruptions: interruptions,
        status: 'running'
    };

    // Trigger stop logic immediately
    stopSession();
};

const updatePostGoalDropdown = () => {
    const sub = dom.postSub().value;
    const goalWrap = dom.postGoalWrap();
    const goalSel = dom.postGoal();

    if (!sub) {
        goalWrap.classList.add('hidden');
        return;
    }

    import('./goals.js').then(({ getCurrentGoals }) => {
        const goals = getCurrentGoals().filter(g => g.subject === sub && g.status === 'active');

        if (goals.length > 0) {
            goalSel.innerHTML = '<option value="">-- Sin vincular --</option>' +
                goals.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
            goalWrap.classList.remove('hidden');
        } else {
            goalWrap.classList.add('hidden');
            goalSel.value = "";
        }
    });
};

const startSession = () => {
    activeSession = {
        uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
        subject: 'Sin asignar',
        method: 'Cronómetro',
        goalId: null,
        startTime: Date.now(),
        interruptions: [],
        status: 'running'
    };
    saveLocal();
    resumeTimerUI(activeSession);
};

const resumeTimerUI = (session) => {
    dom.setup().classList.add('hidden');
    if (dom.dailyPlan()) dom.dailyPlan().classList.add('hidden'); // Hide Plan
    dom.active().classList.remove('hidden');
    dom.subjDisp().textContent = session.subject;
    dom.methDisp().textContent = session.method;

    startLoop();
    faviconAnimator.start();
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

    const timeStr = formatTime(net, appSettings.showSeconds);
    dom.display().textContent = timeStr;
    document.title = `${timeStr} - Focus Analytics`;
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
    faviconAnimator.pause();

    // Show Overlay
    dom.reasonDisp().textContent = session.currentPauseReason;
    dom.overlay().classList.remove('hidden');

    // Update display one last time
    const now = session.pauseStart || Date.now();
    const totalPaused = session.interruptions.reduce((acc, i) => acc + (i.duration || 0), 0);
    const net = Math.max(0, (now - session.startTime) - totalPaused);
    const timeStr = formatTime(net, appSettings.showSeconds);
    dom.display().textContent = timeStr;
    document.title = `⏸️ ${timeStr} - Focus Analytics`;
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
        faviconAnimator.start();
    }
};

const stopSession = async () => {
    clearInterval(timerInterval);
    faviconAnimator.stop();
    populatePostSessionModal();
    dom.postModal().classList.remove('hidden');
};

const populatePostSessionModal = () => {
    // 1. Subjects
    const subs = getSubjects();
    dom.postSub().innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');

    // 2. Methods
    const mets = getMethods();
    dom.postMeth().innerHTML = mets.map(m => `<option value="${m}">${m}</option>`).join('');

    // 3. Autocomplete from local storage
    const lastSub = localStorage.getItem('last_subject');
    const lastMet = localStorage.getItem('last_method');

    if (lastSub && subs.includes(lastSub)) dom.postSub().value = lastSub;
    if (lastMet && mets.includes(lastMet)) dom.postMeth().value = lastMet;

    // Trigger goal update
    updatePostGoalDropdown();
};

const completeSession = async () => {
    const sub = dom.postSub().value;
    const met = dom.postMeth().value;
    const goalId = dom.postGoal().value;

    if (!sub || !met) return showAlert("Por favor completa la información.");

    // Update Session
    activeSession.subject = sub;
    activeSession.method = met;
    activeSession.goalId = goalId || null;

    // Save defaults
    localStorage.setItem('last_subject', sub);
    localStorage.setItem('last_method', met);

    dom.postModal().classList.add('hidden');
    finalizeSessionProcessing();
};

const finalizeSessionProcessing = async () => {
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

    // GENERATE FEEDBACK & SHOW SUMMARY
    const feedback = getFeedback(sessionData);
    showSummaryUI(feedback, sessionData);

    // Save (Background)
    const user = getCurrentUser();
    saveToStorage(sessionData, user); // Helper function extracted
};

const showSummaryUI = (fb, sessionData) => {
    // 1. Phrase & Suggestion
    dom.sumPhrase().textContent = `"${fb.frase}"`;
    if (fb.sugerencia) {
        dom.sumSugerencia().textContent = `💡 ${fb.sugerencia}`;
        dom.sumSugerencia().classList.remove('hidden');
    } else {
        dom.sumSugerencia().classList.add('hidden');
    }

    // 2. Concentration
    dom.sumConcVal().textContent = `${fb.concentracion}%`;
    // Color logic
    dom.sumConcVal().className = "text-6xl font-black tracking-tighter transition-colors"; // reset
    if (fb.concentracion_tipo === 'alta') dom.sumConcVal().classList.add('text-acc-green');
    else if (fb.concentracion_tipo === 'media') dom.sumConcVal().classList.add('text-acc-blue');
    else dom.sumConcVal().classList.add('text-acc-red');

    // 3. Times
    dom.sumStudyTime().textContent = `${fb.tiempo_estudio_min} min`;
    dom.sumTotalTime().textContent = `${fb.duracion_total_min} min`;
    dom.sumPauseTime().textContent = `${fb.tiempo_interrupcion_min} min`;
    if (dom.sumPauseCount()) dom.sumPauseCount().textContent = `${fb.cantidad_interrupciones}`;

    // 4. Bar
    const totalMin = fb.duracion_total_min || 1; // avoid div 0
    const studyPct = Math.min(100, (fb.tiempo_estudio_min / totalMin) * 100);
    const pausePct = 100 - studyPct;

    dom.barStudy().style.width = `${studyPct}%`;
    dom.barPause().style.width = `${pausePct}%`;

    // Show Modal
    dom.summaryModal().classList.remove('hidden');
};

const closeSummaryAndReset = () => {
    dom.summaryModal().classList.add('hidden');

    // Reset UI
    localStorage.removeItem('study_session');
    activeSession = null;
    dom.active().classList.add('hidden');
    dom.setup().classList.remove('hidden');

    // Restore Daily Plan (if goals exist)
    renderDailyPlan();

    dom.display().textContent = "00:00";
    document.title = "Focus Analytics";

    // Reload history to show new entry
    loadHistory();
    faviconAnimator.stop();
};

const saveToStorage = async (sessionData, user) => {
    if (user) {
        try {
            await addDoc(collection(db, 'study_sessions'), sessionData);
            if (sessionData.goalId) {
                import('./goals.js').then(({ incrementGoalProgress }) => {
                    incrementGoalProgress(sessionData.goalId, sessionData.netDuration);
                });
            }
        } catch (e) {
            console.error(e);
            showAlert("Error al guardar en nube.");
        }
    } else {
        const h = JSON.parse(localStorage.getItem('guest_study_history') || '[]');
        h.push(sessionData);
        localStorage.setItem('guest_study_history', JSON.stringify(h));

        if (sessionData.goalId) {
            import('./goals.js').then(({ incrementGoalProgress }) => {
                incrementGoalProgress(sessionData.goalId, sessionData.netDuration);
            });
        }
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

const toggleFavicon = () => {
    appSettings.showFavicon = !appSettings.showFavicon;
    localStorage.setItem('app_settings', JSON.stringify(appSettings));
    faviconAnimator.setEnabled(appSettings.showFavicon);
    renderSettingsUI();
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

    const btnFav = dom.btnToggleFav();
    if (btnFav) {
        const knobFav = btnFav.firstElementChild;
        if (appSettings.showFavicon) {
            btnFav.className = "w-12 h-6 bg-[#a5f5c3] rounded-full relative transition-colors duration-300";
            knobFav.className = "w-4 h-4 bg-white rounded-full absolute top-1 right-1 transition-transform duration-300";
        } else {
            btnFav.className = "w-12 h-6 bg-[#d1cbc1] rounded-full relative transition-colors duration-300";
            knobFav.className = "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300";
        }
    }
};
