import './style.css';
import { initAuth, getCurrentUser } from './modules/auth.js';
import { initThemes } from './modules/themes.js';
import { initTimer } from './modules/timer.js';
import { updateCharts, applyHistoryFilters, renderTimeline } from './modules/charts.js'; // Ensure correct imports
import { formatTime, showAlert, showConfirm } from './modules/utils.js';
import { db } from './services/firebaseConfig.js';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore'; loadHistory();
import { loadHistory } from './modules/data.js';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initThemes();
    initTimer();
    bindGlobalEvents();
});

// --- ABSOLUTELY NECESSARY GLOBALS (Glue) ---
// We export these so other modules can import them if needed, 
// OR we attach to window if we are lazy (User asked for modularization, so let's try to be clean, 
// but since HTML onclicks were removed, we need to bind listeners in JS).

const bindGlobalEvents = () => {
    // Tab Switching
    ['tracker', 'dashboard', 'history'].forEach(t => {
        document.getElementById('tab-' + t).onclick = () => switchTab(t);
    });

    // Mobile/General Settings
    document.getElementById('btn-settings-toggle').onclick = () => {
        document.getElementById('modal-settings').classList.remove('hidden');
    };
    document.getElementById('btn-close-settings').onclick = () => {
        document.getElementById('modal-settings').classList.add('hidden');
    };

    // Filters
    document.getElementById('dash-filter-period').onchange = () => toggleCustomDate('dash');
    document.getElementById('dash-start').onchange = updateCharts;
    document.getElementById('dash-end').onchange = updateCharts;
    document.getElementById('dash-filter-subject').onchange = updateCharts;

    document.getElementById('hist-filter-period').onchange = () => toggleCustomDate('hist');
    document.getElementById('hist-filter-start').onchange = () => applyHistoryFilters();
    document.getElementById('hist-filter-end').onchange = () => applyHistoryFilters();
    document.getElementById('hist-filter-subject').onchange = () => applyHistoryFilters();

    // Manual Entry
    document.getElementById('btn-manual-entry').onclick = openManualEntry;
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
    ['tracker', 'dashboard', 'history'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const view = document.getElementById('view-' + t);
        if (t === tab) {
            btn.classList.add('tab-active');
            btn.classList.remove('tab-inactive');
            view.classList.remove('hidden');
        } else {
            btn.classList.remove('tab-active');
            btn.classList.add('tab-inactive');
            view.classList.add('hidden');
        }
    });
    if (tab === 'dashboard') updateCharts();
};

const toggleCustomDate = (prefix) => {
    const val = document.getElementById(`${prefix}-filter-period`).value;
    const div = document.getElementById(`${prefix}-custom-date`);
    if (val === 'custom') div.classList.remove('hidden');
    else div.classList.add('hidden');

    if (prefix === 'dash') updateCharts();
    else applyHistoryFilters();
};

// --- SESSION DETAIL LOGIC ---
let currentDetailId = null;

export const openSessionDetails = async (id) => {
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
    document.getElementById('detail-date-edit').value = d.toISOString().split('T')[0];
    document.getElementById('detail-start-edit').value = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('detail-end-edit').value = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('detail-net-edit').value = Math.floor((session.netDuration || 0) / 60000);
    document.getElementById('detail-pause-edit').value = pauseMins;

    // Setup Dropdowns
    // Get cached lists from DOM or re-fetch? It's easier to grab existing options from the Manual Entry dropdowns which are kept sync
    const subOpts = document.getElementById('man-subject').innerHTML;
    const metOpts = document.getElementById('man-method').innerHTML;
    document.getElementById('detail-subject').innerHTML = subOpts;
    document.getElementById('detail-method').innerHTML = metOpts;

    document.getElementById('detail-subject').value = session.subject;
    document.getElementById('detail-method').value = session.method;

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
    ['detail-subject', 'detail-method', 'detail-date-edit', 'detail-start-edit', 'detail-end-edit'].forEach(id => set(id, true));

    document.getElementById('detail-net-edit-wrapper').classList.add('hidden');
    document.getElementById('detail-net').classList.remove('hidden');
    document.getElementById('detail-pause-edit-wrapper').classList.add('hidden');
    document.getElementById('detail-pause-display').classList.remove('hidden');

    document.getElementById('btn-edit-session').classList.remove('hidden');
    document.getElementById('btn-save-session').classList.add('hidden');
};

const toggleEditSession = () => {
    const set = (id, dis) => {
        const el = document.getElementById(id);
        el.disabled = dis;
        if (dis) el.classList.add('opacity-70', 'bg-gray-50');
        else el.classList.remove('opacity-70', 'bg-gray-50');
    };
    ['detail-subject', 'detail-method', 'detail-date-edit', 'detail-start-edit', 'detail-end-edit'].forEach(id => set(id, false));

    document.getElementById('detail-net-edit-wrapper').classList.remove('hidden');
    document.getElementById('detail-net').classList.add('hidden');
    document.getElementById('detail-pause-edit-wrapper').classList.remove('hidden');
    document.getElementById('detail-pause-display').classList.add('hidden');

    document.getElementById('btn-edit-session').classList.add('hidden');
    document.getElementById('btn-save-session').classList.remove('hidden');
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

        const updateData = {
            subject: newSub,
            method: newMet,
            startTime: startTs,
            endTime: endTs,
            grossDuration: newGross,
            netDuration: finalNetMs,
            efficiency: newEff,
            interruptions: newPauseMs > 0 ? [{
                start: startTs + (finalNetMs / 2),
                end: startTs + (finalNetMs / 2) + newPauseMs,
                duration: newPauseMs,
                reason: "Editado Manualmente"
            }] : []
        };

        if (user) {
            await updateDoc(doc(db, "study_sessions", currentDetailId), updateData);
            disableEditSession();
            showAlert("¡Guardado en Nube!");
            document.getElementById('modal-detail').classList.add('hidden');
        } else {
            const history = window.globalSessionCache || [];
            const idx = history.findIndex(s => s.id == currentDetailId);
            if (idx > -1) {
                // Merge
                history[idx] = { ...history[idx], ...updateData };
                localStorage.setItem('guest_study_history', JSON.stringify(history));
                loadHistory(); // Reload table
                disableEditSession();
                document.getElementById('modal-detail').classList.add('hidden');
                showAlert("Guardado.");
            }
        }
    } catch (err) {
        console.error("Save error:", err);
        showAlert("Ocurrió un error al guardar.");
    }
};

const promptDeleteSession = () => {
    showConfirm("Eliminar", "¿Borrar sesión?", async () => {
        const user = getCurrentUser();
        if (user && currentDetailId) {
            await deleteDoc(doc(db, "study_sessions", currentDetailId));
            document.getElementById('modal-detail').classList.add('hidden');
            showAlert("Eliminado.");
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
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    // Format YYYY-MM-DD
    document.getElementById('man-date').value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    // Format HH:MM
    document.getElementById('man-start').value = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const later = new Date(d.getTime() + 3600000);
    document.getElementById('man-end').value = later.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    // Reset Duration
    document.getElementById('man-duration').value = "";
    document.getElementById('man-pause').value = "0";

    document.getElementById('modal-manual').classList.remove('hidden');
    setupManualSmartLogic();
};

const saveManualEntry = async () => {
    try {
        const sub = document.getElementById('man-subject').value;
        const met = document.getElementById('man-method').value;
        const subMan = document.getElementById('man-subject').value; // already captured

        const dateVal = document.getElementById('man-date').value;
        const startVal = document.getElementById('man-start').value;
        const endVal = document.getElementById('man-end').value;
        const durVal = parseInt(document.getElementById('man-duration').value) || 0;
        const pauseMins = parseInt(document.getElementById('man-pause').value) || 0;

        if (!dateVal) return showAlert("Por favor selecciona una fecha");

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
        pause: getEl('detail-pause-edit')
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
