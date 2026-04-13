import './style.css';
import { initAuth, getCurrentUser } from './modules/auth.js';
import { initThemes } from './modules/themes.js';
import { initTimer } from './modules/timer.js';
import { updateCharts, applyHistoryFilters, renderTimeline, resetHistoryLimit } from './modules/charts.js'; // Ensure correct imports
import { formatTime, showAlert, showConfirm } from './modules/utils.js';
import { db } from './services/firebaseConfig.js';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { loadHistory } from './modules/data.js';
import { toast } from './modules/toasts.js';

import { initDailyGoalPanel, renderDailyPlan } from './modules/dailyGoal.js';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initThemes();
    initTimer();
    initDailyGoalPanel(); // New
    initPWAInstall();
    bindGlobalEvents();

    // Fade out splash screen after small delay
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('fade-out');
    }, 1200);
});

// --- PWA INSTALLATION ---
const initPWAInstall = () => {
    let deferredPrompt;
    const btnInstall = document.getElementById('btn-install-app');
    if (!btnInstall) return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (window.innerWidth < 768) {
            btnInstall.classList.remove('hidden');
            btnInstall.classList.add('flex');
        }
    });

    btnInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                btnInstall.classList.add('hidden');
            }
            deferredPrompt = null;
        } else {
            showAlert("En iOS: Toca 'Compartir' y elige 'Agregar a inicio'.");
        }
    });

    const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isInStandaloneMode = () => ('standalone' in window.navigator) && window.navigator.standalone;
    const isStandaloneQuery = window.matchMedia('(display-mode: standalone)').matches;

    if (isIos() && !isInStandaloneMode() && !isStandaloneQuery && window.innerWidth < 1024) {
        btnInstall.classList.remove('hidden');
        btnInstall.classList.add('flex');
    }
};


// --- ABSOLUTELY NECESSARY GLOBALS (Glue) ---
// We export these so other modules can import them if needed, 
// OR we attach to window if we are lazy (User asked for modularization, so let's try to be clean, 
// but since HTML onclicks were removed, we need to bind listeners in JS).

const bindGlobalEvents = () => {
    // Tab Switching
    ['tracker', 'dashboard', 'history', 'goals'].forEach(t => {
        document.getElementById('tab-' + t).onclick = () => switchTab(t);
    });

    // Goals UI
    {
        const btnAdd = document.getElementById('btn-add-goal');
        if (btnAdd) btnAdd.onclick = () => import('./modules/goalsUI.js').then(m => m.openCreateGoalModal());

        const btnSave = document.getElementById('btn-save-goal');
        if (btnSave) btnSave.onclick = () => import('./modules/goalsUI.js').then(m => m.saveNewGoal());
    }

    // Mobile/General Settings
    document.getElementById('btn-settings-toggle').onclick = () => {
        document.getElementById('modal-settings').classList.remove('hidden');
    };
    document.getElementById('btn-close-settings').onclick = () => {
        document.getElementById('modal-settings').classList.add('hidden');
    };

    // Filters
    const triggerGlobalFilters = () => {
        updateCharts();
        resetHistoryLimit();
        applyHistoryFilters();
        import('./modules/goalsUI.js').then(m => {
            import('./modules/goals.js').then(g => m.renderGoals(g.getCurrentGoals()));
        });
    };

    document.getElementById('global-filter-period').onchange = () => {
        toggleCustomDate('global');
        triggerGlobalFilters();
    };
    document.getElementById('global-start').onchange = triggerGlobalFilters;
    document.getElementById('global-end').onchange = triggerGlobalFilters;
    document.getElementById('global-filter-subject').onchange = triggerGlobalFilters;

    // Manual Entry
    // Manual Entry
    document.getElementById('btn-manual-entry').onclick = startNewSession;
    document.getElementById('btn-cancel-manual').onclick = () => document.getElementById('modal-manual').classList.add('hidden');
    document.getElementById('btn-save-manual').onclick = saveManualEntry;

    // Detail Modal
    document.getElementById('btn-close-detail').onclick = () => document.getElementById('modal-detail').classList.add('hidden');
    document.getElementById('btn-edit-session').onclick = toggleEditSession;
    document.getElementById('btn-save-session').onclick = saveSessionChanges;
    document.getElementById('btn-delete-session').onclick = promptDeleteSession;
};

// --- NAVIGATION ---
const switchTab = (tab) => {
    ['tracker', 'dashboard', 'history', 'goals'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const view = document.getElementById('view-' + t);
        if (t === tab) {
            btn.classList.add('tab-active');
            btn.classList.remove('tab-inactive');
            view.classList.remove('hidden');
            // Trigger animation restart
            view.classList.remove('fade-in');
            void view.offsetWidth;
            view.classList.add('fade-in');
        } else {
            btn.classList.remove('tab-active');
            btn.classList.add('tab-inactive');
            view.classList.add('hidden');
        }
    });

    // Toggle global filters and contextual buttons visibility
    const topBar = document.getElementById('top-bar');
    const globalCustomDate = document.getElementById('global-custom-date');
    const btnAddGoal = document.getElementById('btn-add-goal');
    const btnManualEntry = document.getElementById('btn-manual-entry');

    if (topBar) {
        if (tab === 'tracker') {
            topBar.classList.add('hidden');
            topBar.classList.remove('flex');
            if (globalCustomDate) {
                globalCustomDate.classList.add('hidden');
                globalCustomDate.classList.remove('flex');
            }
        } else {
            topBar.classList.remove('hidden');
            topBar.classList.add('flex');
            
            // Re-check custom date
            const pVal = document.getElementById('global-filter-period')?.value;
            if (pVal === 'custom' && globalCustomDate) {
                globalCustomDate.classList.remove('hidden');
                globalCustomDate.classList.add('flex');
            }
        }
    }

    if (btnAddGoal) {
        if (tab === 'goals') {
            btnAddGoal.classList.remove('hidden');
            btnAddGoal.classList.add('flex');
        } else {
            btnAddGoal.classList.add('hidden');
            btnAddGoal.classList.remove('flex');
        }
    }

    if (btnManualEntry) {
        if (tab === 'history') {
            btnManualEntry.classList.remove('hidden');
            btnManualEntry.classList.add('flex');
        } else {
            btnManualEntry.classList.add('hidden');
            btnManualEntry.classList.remove('flex');
        }
    }

    if (tab === 'dashboard') updateCharts();
};

const toggleCustomDate = (prefix) => {
    const val = document.getElementById(`${prefix}-filter-period`).value;
    const div = document.getElementById(`${prefix}-custom-date`);
    if (val === 'custom') {
        div.classList.remove('hidden');
        div.classList.add('flex');
    } else {
        div.classList.add('hidden');
        div.classList.remove('flex');
    }
};

// --- NEW SESSION LOGIC ---
export const startNewSession = async () => {
    // 1. Create Default Data
    const now = new Date();
    // Round to nearest minute
    now.setSeconds(0, 0);

    // Get Subjects to pick first default
    let defaultSub = "General";
    try {
        const { getSubjects } = await import('./modules/data.js');
        const subs = getSubjects();
        if (subs.length > 0) defaultSub = subs[0];
    } catch (e) { console.warn("No subjects loaded"); }

    const draftId = `draft_${Date.now()}`;
    const draftSession = {
        id: draftId,
        uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
        subject: defaultSub,
        method: "Cronómetro",
        startTime: now.getTime(),
        endTime: now.getTime(),
        grossDuration: 0,
        netDuration: 0,
        efficiency: 100, // Default optimistic?
        interruptions: [],
        goalId: null,
        isDraft: true // Flag to identify
    };

    // 2. Inject into Cache
    if (!window.globalSessionCache) window.globalSessionCache = [];
    window.globalSessionCache.unshift(draftSession);

    // 3. Open Details
    await openSessionDetails(draftId);

    // 4. Set Edit Mode immediately
    toggleEditSession();

    // 5. UI Adjustments
    document.getElementById('btn-delete-session').classList.add('hidden'); // No delete for draft
};

// --- SESSION DETAIL LOGIC ---
let currentDetailId = null;

export const openSessionDetails = async (id) => {
    // Expose for other modules if needed (e.g. goalsUI)
    window.openSessionDetails = openSessionDetails;

    const data = window.globalSessionCache || [];
    const session = data.find(s => s.id === id);
    if (!session) return;

    currentDetailId = id;

    // Populate UI
    const totalPaused = (session.interruptions || []).reduce((acc, i) => acc + (i.duration || 0), 0);
    const pauseMins = Math.floor(totalPaused / 60000);

    document.getElementById('detail-net').textContent = formatTime(session.netDuration || 0, false);
    document.getElementById('detail-gross').textContent = formatTime(session.grossDuration || 0, false);
    document.getElementById('detail-pause-display').textContent = pauseMins + " min";
    document.getElementById('detail-pause-count').textContent = (session.interruptions || []).length;
    document.getElementById('detail-efficiency').textContent = (session.efficiency || 0) + "%";

    // Setup Edit Fields
    const d = new Date(session.startTime);
    const localYear = d.getFullYear();
    const localMonth = String(d.getMonth() + 1).padStart(2, '0');
    const localDay = String(d.getDate()).padStart(2, '0');
    document.getElementById('detail-date-edit').value = `${localYear}-${localMonth}-${localDay}`;
    document.getElementById('detail-start-edit').value = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('detail-end-edit').value = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('detail-net-edit').value = Math.floor((session.netDuration || 0) / 60000);
    document.getElementById('detail-pause-edit').value = pauseMins;

    // Populate dropdowns (disabled initially)
    const subSel = document.getElementById('detail-subject');
    const methSel = document.getElementById('detail-method');
    const goalSel = document.getElementById('detail-goal');

    // Re-populate to ensure fresh list
    import('./modules/data.js').then(({ getSubjects, getMethods }) => {
        subSel.innerHTML = getSubjects().map(s => `<option value="${s}">${s}</option>`).join('');
        methSel.innerHTML = getMethods().map(m => `<option value="${m}">${m}</option>`).join('');

        subSel.value = session.subject;
        methSel.value = session.method;
    });

    // Populate Goals (filtered by subject)
    import('./modules/goals.js').then(({ getGoalsBySubject }) => {
        const goals = getGoalsBySubject(session.subject);
        goalSel.innerHTML = '<option value="">-- Sin vincular --</option>' +
            goals.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
        goalSel.value = session.goalId || "";
    });

    // Lock UI
    disableEditSession();
    document.getElementById('modal-detail').classList.remove('hidden');

    // Initialize Smart Logic
    setupSmartEditing();

    // Render Timeline (must be after modal is visible for correct sizing)
    setTimeout(() => renderTimeline(session), 50);
};

const disableEditSession = () => {
    // Helper to toggle disabled state
    const set = (id, dis) => {
        const el = document.getElementById(id);
        el.disabled = dis;
        if (dis) el.classList.add('opacity-70', 'bg-gray-50');
        else el.classList.remove('opacity-70', 'bg-gray-50');
    };
    ['detail-subject', 'detail-method', 'detail-goal', 'detail-date-edit', 'detail-start-edit', 'detail-end-edit'].forEach(id => set(id, true));

    document.getElementById('detail-net-edit-wrapper').classList.add('hidden');
    document.getElementById('detail-net').classList.remove('hidden');
    document.getElementById('detail-pause-edit-wrapper').classList.add('hidden');
    document.getElementById('detail-pause-display').classList.remove('hidden');

    document.getElementById('btn-edit-session').classList.remove('hidden');
    document.getElementById('btn-save-session').classList.add('hidden');

    // Ensure Delete is visible (might have been hidden by startNewSession)
    document.getElementById('btn-delete-session').classList.remove('hidden');
};

const toggleEditSession = () => {
    const set = (id, dis) => {
        const el = document.getElementById(id);
        el.disabled = dis;
        if (dis) el.classList.add('opacity-70', 'bg-gray-50');
        else el.classList.remove('opacity-70', 'bg-gray-50');
    };
    ['detail-subject', 'detail-method', 'detail-goal', 'detail-date-edit', 'detail-start-edit', 'detail-end-edit'].forEach(id => set(id, false));

    document.getElementById('detail-net-edit-wrapper').classList.remove('hidden');
    document.getElementById('detail-net').classList.add('hidden');
    document.getElementById('detail-pause-edit-wrapper').classList.remove('hidden');
    document.getElementById('detail-pause-display').classList.add('hidden');

    document.getElementById('btn-edit-session').classList.add('hidden');
    document.getElementById('btn-save-session').classList.remove('hidden');

    // Subject Change Listener
    document.getElementById('detail-subject').onchange = (e) => {
        const sub = e.target.value;
        const goalSel = document.getElementById('detail-goal');
        import('./modules/goals.js').then(({ getGoalsBySubject }) => {
            const goals = getGoalsBySubject(sub);
            goalSel.innerHTML = '<option value="">-- Sin vincular --</option>' +
                goals.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
        });
    };
};

const saveSessionChanges = async () => {
    try {
        const newSub = document.getElementById('detail-subject').value;
        const newMet = document.getElementById('detail-method').value;

        // New Time Values
        const dateVal = document.getElementById('detail-date-edit').value;
        const startVal = document.getElementById('detail-start-edit').value;
        const endVal = document.getElementById('detail-end-edit').value;

        if (!dateVal || !startVal || !endVal) return showAlert("Completa todos los campos de fecha y hora.");

        // Helpers for Time calc
        const startTs = new Date(`${dateVal}T${startVal}`).getTime();
        const endTs = new Date(`${dateVal}T${endVal}`).getTime();

        if (endTs <= startTs) return showAlert("La hora de fin debe ser posterior al inicio.");

        const newGross = endTs - startTs;

        // Get current session data (to confirm exist/auth)
        const user = getCurrentUser();
        // Recalculate based on INPUTS (Smart Edit)
        const newPauseMins = parseInt(document.getElementById('detail-pause-edit').value) || 0;
        const newPauseMs = newPauseMins * 60000;
        const finalNetMs = Math.max(0, newGross - newPauseMs);

        if (finalNetMs < 0) return showAlert("La duración de las pausas excede la duración total.");

        const newEff = newGross > 0 ? Math.round((finalNetMs / newGross) * 100) : 0;

        // Detect if Pause Duration Changed
        // Use a unique name to avoid collision with later usage
        const currentSessionForCheck = window.globalSessionCache.find(s => s.id === currentDetailId);
        const oldInterruptions = currentSessionForCheck ? (currentSessionForCheck.interruptions || []) : [];
        const oldPauseMs = oldInterruptions.reduce((acc, i) => acc + (i.duration || 0), 0);

        let finalInterruptions = [];

        // Logic: If the TOTAL pause time from the edit form (minutes) is roughly equal to the original total pause time,
        // we assume the user did NOT want to start editing the complex pause structure, so we KEEP the original structure.
        // We allow < 60s difference because the input is only in minutes (resolution loss).
        if (Math.abs(newPauseMs - oldPauseMs) < 60000) {
            // Duration didn't change (significantly), PRESERVE HISTORY
            // CRITICAL: If Start Time changed, technical shifts might be needed, but for now just preserving is safer than destroying.
            finalInterruptions = oldInterruptions;
        } else {
            // Duration changed, we must synthesize (lossy) because we don't know WHICH pause changed.
            // This is the fallback "Single Block" interruption.
            finalInterruptions = newPauseMs > 0 ? [{
                start: startTs + (finalNetMs / 2),
                end: startTs + (finalNetMs / 2) + newPauseMs,
                duration: newPauseMs,
                reason: "Editado Manualmente"
            }] : [];
        }

        const updateData = {
            subject: newSub,
            method: newMet,
            goalId: document.getElementById('detail-goal').value || null,
            startTime: startTs,
            endTime: endTs,
            grossDuration: newGross,
            netDuration: finalNetMs,
            efficiency: newEff,
            interruptions: finalInterruptions
        };

        // Handle Goal Progress Update
        // Note: We use 'originalSession' here again or just reuse 'currentSessionForCheck'
        const oldGoalId = currentSessionForCheck.goalId || null;
        const newGoalId = updateData.goalId;
        const oldDuration = currentSessionForCheck.netDuration || 0;
        const newDuration = finalNetMs;

        // Import goals module dynamically
        const { moveSessionGoal, incrementGoalProgress } = await import('./modules/goals.js');

        if (oldGoalId !== newGoalId) {
            // Goal Swapped: Remove from Old, Add New (with NEW duration)
            if (oldGoalId) await incrementGoalProgress(oldGoalId, -oldDuration);
            if (newGoalId) await incrementGoalProgress(newGoalId, newDuration);
        } else if (newGoalId && oldDuration !== newDuration) {
            // Same Goal, Duration Changed
            const diff = newDuration - oldDuration;
            await incrementGoalProgress(newGoalId, diff);
        }

        // Check if Draft
        const isDraft = currentDetailId.startsWith('draft_');

        // Clean cache of draft? Handled later or overwritten.

        if (user) {
            if (isDraft) {
                // CREATE NEW
                const payload = {
                    ...updateData,
                    uid: user.uid,
                    createdAt: Date.now() // Real creation time
                };
                // Remove goalId if null to keep clean? Firestore saves nulls fine.

                await addDoc(collection(db, "study_sessions"), payload);
                showAlert("¡Sesión Creada!");
            } else {
                // UPDATE OLD
                await updateDoc(doc(db, "study_sessions", currentDetailId), updateData);
                showAlert("¡Guardado en Nube!");
            }
            disableEditSession();
            document.getElementById('modal-detail').classList.add('hidden');
        } else {
            // GUEST
            const history = window.globalSessionCache || [];
            if (isDraft) {
                // Convert draft to real local ID
                const newId = Date.now().toString();
                const payload = {
                    ...updateData,
                    id: newId,
                    uid: 'guest',
                    createdAt: Date.now()
                };
                // Remove draft from cache first? 
                // Currently draft is IN cache. We can just mutate it or splice/push.
                const draftIdx = history.findIndex(s => s.id === currentDetailId);
                if (draftIdx > -1) {
                    history[draftIdx] = payload; // Replace draft with real
                } else {
                    history.push(payload);
                }
            } else {
                const idx = history.findIndex(s => s.id == currentDetailId);
                if (idx > -1) {
                    history[idx] = { ...history[idx], ...updateData };
                }
            }

            localStorage.setItem('guest_study_history', JSON.stringify(history));
            loadHistory(); // Reload table
            disableEditSession();
            document.getElementById('modal-detail').classList.add('hidden');
            showAlert("Guardado.");
        }

        // Remove draft from cache logic if user closed without saving is needed in 'Close' handler.
        // But here we SAVED, so draft is now processed.
    } catch (err) {
        console.error("Save error:", err);
        showAlert("Ocurrió un error al guardar.");
    }
};

const promptDeleteSession = () => {
    showConfirm("Eliminar", "¿Borrar sesión?", async () => {
        const user = getCurrentUser();

        // Handle Goal Progress (Decrement)
        const session = window.globalSessionCache.find(s => s.id === currentDetailId);
        if (session && session.goalId) {
            try {
                const { incrementGoalProgress } = await import('./modules/goals.js');
                await incrementGoalProgress(session.goalId, -(session.netDuration || 0));
            } catch (e) {
                console.error("Error updating goal on delete:", e);
            }
        }

        if (user && currentDetailId) {
            // Delete from Cloud
            if (!currentDetailId.startsWith('draft_')) {
                await deleteDoc(doc(db, "study_sessions", currentDetailId));
            }
            document.getElementById('modal-detail').classList.add('hidden');
            showAlert("Eliminado.");
            // Cache update will happen via onSnapshot or reload
        } else {
            // Local
            let h = JSON.parse(localStorage.getItem('guest_study_history') || '[]');
            h = h.filter(s => s.id != currentDetailId);
            localStorage.setItem('guest_study_history', JSON.stringify(h));
            document.getElementById('modal-detail').classList.add('hidden');
            loadHistory();
            showAlert("Eliminado.");
        }
    });
};


// --- MANUAL ENTRY ---
const openManualEntry = () => {
    // Populate dropdowns fresh
    document.getElementById('man-subject').innerHTML = ''; // forced refresh trigger via data.js?
    // Data module has renderAllDropdowns, but we need to trigger it or just rely on it being ready.
    // It's usually ready.

    // Clear fields
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = String(now.getMonth() + 1).padStart(2, '0');
    const localDay = String(now.getDate()).padStart(2, '0');
    document.getElementById('man-date').value = `${localYear}-${localMonth}-${localDay}`;
    document.getElementById('man-start').value = "";
    document.getElementById('man-end').value = "";
    document.getElementById('man-duration').value = "";
    document.getElementById('man-subject').value = "";
    document.getElementById('man-goal').innerHTML = '<option value="">-- Sin vincular --</option>'; // reset

    // Bind Subject Change
    document.getElementById('man-subject').onchange = (e) => {
        const sub = e.target.value;
        const goalSel = document.getElementById('man-goal');
        import('./modules/goals.js').then(({ getGoalsBySubject }) => {
            const goals = getGoalsBySubject(sub);
            goalSel.innerHTML = '<option value="">-- Sin vincular --</option>' +
                goals.map(g => `<option value="${g.id}">${g.nombre}</option>`).join('');
        });
    };
    // Trigger once to load initial subjects goals if any
    document.getElementById('man-subject').dispatchEvent(new Event('change'));

    document.getElementById('modal-manual').classList.remove('hidden');
    setupManualSmartLogic();
};

const saveManualEntry = async () => {
    try {
        const dDate = document.getElementById('man-date').value;
        const dStart = document.getElementById('man-start').value;
        const dEnd = document.getElementById('man-end').value;
        const durRaw = document.getElementById('man-duration').value;
        const sub = document.getElementById('man-subject').value;
        const met = document.getElementById('man-method').value;
        const task = document.getElementById('man-goal').value || null; // Goal ID

        const durVal = parseInt(durRaw) || 0;
        const pauseMins = parseInt(document.getElementById('man-pause').value) || 0;

        if (!dDate) return showAlert("Por favor selecciona una fecha");

        let startTs, endTs, gross, net;
        const pauseMs = pauseMins * 60000;

        // Logic: Compute Times
        if (startVal && endVal) {
            // Strict Start/End
            const d = new Date(dateVal); // Parsing YYYY-MM-DD
            // Construct safe TS
            startTs = new Date(`${dateVal}T${startVal}`).getTime();
            endTs = new Date(`${dateVal}T${endVal}`).getTime();

            if (endTs <= startTs) return showAlert("La hora de fin debe ser posterior al inicio");

            gross = endTs - startTs;
            net = gross - pauseMs;
        } else if (durVal > 0) {
            // Flexible: Duration Driven
            const baseTime = startVal || "12:00";
            startTs = new Date(`${dateVal}T${baseTime}`).getTime();

            net = durVal * 60000;
            gross = net + pauseMs;
            endTs = startTs + gross;
        } else {
            return showAlert("Completa hora de inicio/fin o la duración total");
        }

        if (net < 0) return showAlert("Las pausas exceden la duración total");

        const eff = gross > 0 ? Math.round((net / gross) * 100) : 0;

        const sessionData = {
            uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
            subject: sub,
            method: met,
            startTime: startTs,
            endTime: endTs,
            grossDuration: gross,
            netDuration: net,
            efficiency: eff,
            interruptions: pauseMs > 0 ? [{ start: startTs + (net / 2), end: startTs + (net / 2) + pauseMs, duration: pauseMs, reason: 'Manual' }] : [],
            createdAt: Date.now()
        };

        const user = getCurrentUser();
        if (user) {
            await addDoc(collection(db, 'study_sessions'), sessionData);
            document.getElementById('modal-manual').classList.add('hidden');
            showAlert("Sesión guardada en Nube.");
        } else {
            // Guest needs ID
            sessionData.id = Date.now().toString();
            const history = window.globalSessionCache || [];
            history.push(sessionData);
            localStorage.setItem('guest_study_history', JSON.stringify(history));
            document.getElementById('modal-manual').classList.add('hidden');
            loadHistory();
            showAlert("Sesión agregada.");
        }
    } catch (e) {
        console.error(e);
        showAlert("Error al guardar manual.");
    }
};

// --- SMART EDITING HELPERS ---

function setupSmartEditing() {
    const getEl = (id) => document.getElementById(id);
    const getTs = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const dateVal = getEl('detail-date-edit').value;
        if (!dateVal) return 0;
        const d = new Date(dateVal + 'T00:00:00');
        d.setHours(h, m, 0, 0);
        return d.getTime();
    };

    const formatTs = (ts) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const inputs = {
        start: getEl('detail-start-edit'),
        end: getEl('detail-end-edit'),
        net: getEl('detail-net-edit'),
        pause: getEl('detail-pause-edit'),
        goal: getEl('detail-goal')
    };

    const handleTimeChange = () => {
        const s = getTs(inputs.start.value);
        const e = getTs(inputs.end.value);
        if (e > s && s > 0 && e > 0) {
            const grossMs = e - s;
            const pauseMs = (parseInt(inputs.pause.value) || 0) * 60000;
            const netMs = Math.max(0, grossMs - pauseMs);
            inputs.net.value = Math.floor(netMs / 60000);
        }
    };

    inputs.start.onchange = handleTimeChange;
    inputs.end.onchange = handleTimeChange;

    inputs.net.onchange = () => {
        const s = getTs(inputs.start.value);
        if (s > 0) {
            const netMs = (parseInt(inputs.net.value) || 0) * 60000;
            const pauseMs = (parseInt(inputs.pause.value) || 0) * 60000;
            const grossMs = netMs + pauseMs;
            const newEndTs = s + grossMs;
            inputs.end.value = formatTs(newEndTs);
        }
    };

    inputs.pause.onchange = () => {
        // Keep Start & End constant, update Net
        handleTimeChange();
    };
}

let manualLogicInited = false;
function setupManualSmartLogic() {
    if (manualLogicInited) return;
    manualLogicInited = true;

    const getEl = (id) => document.getElementById(id);
    const inputs = {
        d: getEl('man-date'),
        s: getEl('man-start'),
        e: getEl('man-end'),
        dur: getEl('man-duration'),
        p: getEl('man-pause')
    };

    const getTs = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const dVal = inputs.d.valueAsDate || new Date(inputs.d.value);
        const date = new Date(dVal);
        date.setHours(h, m, 0, 0);
        return date.getTime();
    };

    const formatTime = (ts) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    // 1. Change Start -> Update End (Move Block) or Calc Duration (Resize)
    inputs.s.onchange = () => {
        const s = getTs(inputs.s.value);
        const durVal = parseInt(inputs.dur.value) || 0;
        const pVal = parseInt(inputs.p.value) || 0;

        if (durVal > 0) {
            // Move: Start + Duration -> End
            const grossMs = (durVal + pVal) * 60000;
            inputs.e.value = formatTime(s + grossMs);
        } else if (inputs.e.value) {
            // Resize: End - Start -> Duration
            const e = getTs(inputs.e.value);
            if (e > s) {
                const grossMs = e - s;
                inputs.dur.value = Math.max(0, Math.floor(grossMs / 60000) - pVal);
            }
        }
    };

    // 2. Change End -> Calc Duration (Resize) or Calc Start (Move Backwards)
    inputs.e.onchange = () => {
        const s = getTs(inputs.s.value);
        const e = getTs(inputs.e.value);
        const durVal = parseInt(inputs.dur.value) || 0;
        const pVal = parseInt(inputs.p.value) || 0;

        if (s && e && e > s) {
            // Start + End -> Calc Duration (Resize)
            const grossMs = e - s;
            inputs.dur.value = Math.max(0, Math.floor(grossMs / 60000) - pVal);
        } else if (durVal > 0 && e) {
            // Duration + End -> Calc Start (Move Backwards)
            const grossMs = (durVal + pVal) * 60000;
            inputs.s.value = formatTime(e - grossMs);
        }
    };

    // 3. Change Duration -> Update End (Extend) or Start (Backwards)
    inputs.dur.oninput = () => {
        const durVal = parseInt(inputs.dur.value);
        if (!durVal && durVal !== 0) return;

        const pVal = parseInt(inputs.p.value) || 0;
        const grossMs = (durVal + pVal) * 60000;

        if (inputs.s.value) {
            const s = getTs(inputs.s.value);
            inputs.e.value = formatTime(s + grossMs);
        } else if (inputs.e.value) {
            const e = getTs(inputs.e.value);
            inputs.s.value = formatTime(e - grossMs);
        }
    };

    // 4. Change Pause -> Update End (Extend)
    inputs.p.oninput = () => {
        const s = getTs(inputs.s.value);
        if (s) {
            const d = parseInt(inputs.dur.value) || 0;
            const p = parseInt(inputs.p.value) || 0;
            const grossMs = (d + p) * 60000;
            inputs.e.value = formatTime(s + grossMs);
        }
    };
}

// --- PWA SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('ServiceWorker registration failed: ', err);
    });
  });
}
