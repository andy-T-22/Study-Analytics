import { db } from "../services/firebaseConfig.js";
import { collection, addDoc } from "firebase/firestore";
import { getCurrentUser } from "./auth.js";
import { formatTime, showAlert, showConfirm, getStyle } from "./utils.js";
import { loadHistory, getSubjects, getMethods, renderAllDropdowns } from "./data.js";
import { getFeedback } from "./feedback.js";
import { renderDailyPlan } from "./dailyGoal.js"; // New Import
import { faviconAnimator } from "./favicon.js";

import { appSettings } from './profile.js';

let activeSession = null;
let timerInterval = null;
const dom = {
    setup: () => document.getElementById('tracker-setup'),
    active: () => document.getElementById('tracker-active'),
    dailyPlan: () => document.getElementById('daily-plan-panel'), // New
    display: () => document.getElementById('timer-display'),
    subjDisp: () => document.getElementById('active-subject'),
    methDisp: () => document.getElementById('active-method'),
    overlay: () => document.getElementById('overlay-paused'),
    reasonDisp: () => document.getElementById('pause-reason-display'),
    restDisplay: () => document.getElementById('rest-timer-display'),
    btnToggleSecs: () => document.getElementById('btn-toggle-seconds'),
    btnToggleFav: () => document.getElementById('btn-toggle-favicon'),
    // Post Session Modal
    postModal: () => document.getElementById('modal-post-session'),
    postSub: () => document.getElementById('post-subject-input'),
    postGoalGrid: () => document.getElementById('post-goal'),
    postGoalInput: () => document.getElementById('post-goal-input'),
    postGoalWrap: () => document.getElementById('post-goal-wrapper'),
    postMeth: () => document.getElementById('post-method-input'),
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
    const btnCancelSession = document.getElementById('btn-cancel-session');
    if (btnCancelSession) {
        btnCancelSession.onclick = () => {
            showConfirm("Cancelar Sesión", "¿Descartar esta sesión sin guardar nada?", () => {
                clearInterval(timerInterval);
                faviconAnimator.stop();
                localStorage.removeItem('study_session');
                activeSession = null;
                dom.active().classList.add('hidden');
                dom.setup().classList.remove('hidden');
                import('./dailyGoal.js').then(m => m.renderDailyPlan());
                dom.display().textContent = "00:00";
                document.title = "Study Meter";
            });
        };
    }

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
        resumeSession(); // Resume if cancelled
    };

    // Overlay Resume
    document.getElementById('btn-resume-overlay').onclick = resumeSession;

    // Summary Close
    if (dom.btnCloseSum()) {
        dom.btnCloseSum().onclick = closeSummaryAndReset;
    }


    faviconAnimator.setEnabled(appSettings.showFavicon);

    // Goal Filter Logic
    if (dom.postSub()) dom.postSub().onchange = updatePostGoalDropdown;
    document.addEventListener('goals-updated', updatePostGoalDropdown); // Listen for data changes

    // Post Session Resume
    if (dom.btnPostContinue()) dom.btnPostContinue().onclick = completeSession;

    // Back to Timer from Post Session
    const btnBackPost = document.getElementById('btn-back-post-session');
    if (btnBackPost) {
        btnBackPost.onclick = () => {
            dom.postModal().classList.add('hidden');
            if (activeSession && activeSession.status === 'post-session') {
                const now = Date.now();
                activeSession.interruptions.push({
                    start: activeSession.postSessionStart,
                    end: now,
                    duration: now - activeSession.postSessionStart,
                    reason: 'post-session'
                });
                activeSession.status = 'running';
                delete activeSession.postSessionStart;
                saveLocal();
            }
            // Resume timer visuals
            startLoop();
            faviconAnimator.start();
        };
    }

    // Event listener for remote updates from profile.js
    window.addEventListener('app_settings_updated', () => {
        faviconAnimator.setEnabled(appSettings.showFavicon);
        if (activeSession) tick();
    });
};


const updatePostGoalDropdown = () => {
    const sub = dom.postSub().value;
    const goalWrap = dom.postGoalWrap();
    const goalGrid = dom.postGoalGrid();
    const goalInput = dom.postGoalInput();

    if (!sub || !goalGrid || !goalInput) {
        if(goalWrap) goalWrap.classList.add('hidden');
        if(goalInput) goalInput.value = "";
        return;
    }

    import('./goals.js').then(({ getCurrentGoals }) => {
        const goals = getCurrentGoals().filter(g => g.subject === sub && g.status === 'active');

        if (goals.length > 0) {
            const list = [{id: "", nombre: "-- Sin vincular --"}, ...goals];
            
            let current = goalInput.value;
            if (!list.find(g => g.id === current)) {
                current = "";
                goalInput.value = "";
            }

            goalGrid.innerHTML = list.map(g => {
                const isSelected = g.id === current;
                const baseClass = isSelected ? 'opacity-100 scale-95 shadow-inner bg-card' : 'opacity-80 hover:opacity-100 hover:scale-[1.02] shadow-sm bg-card';
                const selBorder = getStyle('--acc-blue-dark') || '#74a8db';
                const currentBorder = isSelected ? selBorder : 'var(--border-color)';
                
                return `
                <div data-val="${g.id}" class="goal-grid-selectable cursor-pointer flex items-center p-3 rounded-xl border-[2px] transition-all ${baseClass}" style="border-color: ${currentBorder};">
                    <div class="h-4 w-4 rounded-full border mr-2 flex items-center justify-center flex-shrink-0" style="border-color: ${currentBorder}">
                        ${isSelected ? '<div class="h-2 w-2 rounded-full bg-theme"></div>' : ''}
                    </div>
                    <div class="text-xs font-bold flex-1 truncate text-primary">${g.nombre}</div>
                </div>
                `;
            }).join('');

            goalGrid.querySelectorAll('.goal-grid-selectable').forEach(el => {
                el.onclick = () => {
                    goalInput.value = el.getAttribute('data-val');
                    updatePostGoalDropdown();
                };
            });

            goalWrap.classList.remove('hidden');
        } else {
            goalWrap.classList.add('hidden');
            goalInput.value = "";
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
    if (!activeSession) return;

    if (activeSession.status === 'running') {
        const now = Date.now();
        const totalPaused = activeSession.interruptions.reduce((acc, i) => acc + (i.duration || 0), 0);
        const gross = now - activeSession.startTime;
        const net = Math.max(0, gross - totalPaused);

        const timeStr = formatTime(net, appSettings.showSeconds);
        dom.display().textContent = timeStr;
        document.title = `${timeStr} - Study Meter`;
    } else if (activeSession.status === 'paused') {
        const now = Date.now();
        const pauseDur = now - activeSession.pauseStart;
        const timeStr = formatTime(pauseDur, true); // Always show seconds for pause
        if (dom.restDisplay()) dom.restDisplay().textContent = timeStr;
        const modalTimer = document.getElementById('pause-timer-modal');
        if (modalTimer) modalTimer.textContent = timeStr;
        document.title = `⏸️ ${timeStr} - Descanso`;
    }
};

// --- PAUSE ---
const promptPause = () => {
    activeSession.status = 'paused';
    activeSession.pauseStart = Date.now();
    saveLocal();
    faviconAnimator.pause();
    document.getElementById('modal-pause').classList.remove('hidden');
};

const confirmPause = (reason) => {
    document.getElementById('modal-pause').classList.add('hidden');
    activeSession.currentPauseReason = reason;
    saveLocal();

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
    document.title = `⏸️ ${timeStr} - Study Meter`;
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
    activeSession.status = 'post-session';
    activeSession.postSessionStart = Date.now();
    faviconAnimator.stop();
    populatePostSessionModal();
    dom.postModal().classList.remove('hidden');
};

const populatePostSessionModal = () => {
    // Re-render grids specifically
    renderAllDropdowns();

    // Autocomplete from local storage
    const lastSub = localStorage.getItem('last_subject');
    const lastMet = localStorage.getItem('last_method');
    const subs = getSubjects();
    const mets = getMethods();

    if (lastSub && subs.includes(lastSub)) dom.postSub().value = lastSub;
    if (lastMet && mets.includes(lastMet)) dom.postMeth().value = lastMet;

    // We must re-render the grids so they show the correct visual boundary selections:
    renderAllDropdowns(); // 2nd render passes the newly set hidden input values to grid


    // Trigger goal update
    updatePostGoalDropdown();
};

const completeSession = async () => {
    const sub = dom.postSub().value;
    const met = dom.postMeth().value;
    const goalId = dom.postGoalInput().value;

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
    const now = activeSession.postSessionStart ? activeSession.postSessionStart : Date.now();
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
    document.title = "Study Meter";

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


