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
        const user = getCurrentUser();
        if (!currentDetailId) return;

        const newSub = document.getElementById('detail-subject').value;
        const newMet = document.getElementById('detail-method').value;

        // 1. Get Values
        const newNet = (parseInt(document.getElementById('detail-net-edit').value) || 0) * 60000;
        const newPauseTotal = (parseInt(document.getElementById('detail-pause-edit').value) || 0) * 60000;
        const newGross = newNet + newPauseTotal;
        const newEff = newGross > 0 ? Math.round((newNet / newGross) * 100) : 0;

        // 2. Find Session
        const session = window.globalSessionCache.find(s => s.id === currentDetailId);
        if (!session) return showAlert("Error: Sesión no encontrada en caché.");

        // Safe Date Parsing
        const getMs = (val) => val instanceof Date ? val.getTime() : new Date(val).getTime();
        const startMs = getMs(session.startTime);

        // Check Validity
        if (isNaN(startMs)) return showAlert("Error: Fecha de inicio inválida.");

        // 3. Handle Interruptions
        let currentInts = session.interruptions ? [...session.interruptions] : [];
        let currentSum = currentInts.reduce((acc, i) => acc + (i.duration || 0), 0);
        let diff = newPauseTotal - currentSum;

        if (diff > 0) {
            let oldEndMs = getMs(session.endTime);
            let anchor = !isNaN(oldEndMs) ? oldEndMs : (startMs + newNet);

            currentInts.push({
                reason: "Ajuste Manual",
                start: anchor,
                end: anchor + diff,
                duration: diff
            });
        } else if (diff < 0) {
            let toRemove = Math.abs(diff);
            for (let i = currentInts.length - 1; i >= 0; i--) {
                if (toRemove <= 0) break;
                let int = currentInts[i];
                if (int.duration >= toRemove) {
                    int.duration -= toRemove;
                    int.end -= toRemove;
                    toRemove = 0;
                } else {
                    toRemove -= int.duration;
                    currentInts.splice(i, 1);
                }
            }
        }

        // 4. Recalculate EndTime
        const newEndTime = new Date(startMs + newGross);

        // Update Local Cache Object in memory
        session.subject = newSub;
        session.method = newMet;
        session.netDuration = newNet;
        session.grossDuration = newGross;
        session.efficiency = newEff;
        session.interruptions = currentInts;
        session.endTime = newEndTime;

        if (user) {
            await updateDoc(doc(db, "study_sessions", currentDetailId), {
                subject: newSub,
                method: newMet,
                netDuration: newNet,
                grossDuration: newGross,
                efficiency: newEff,
                interruptions: currentInts,
                endTime: newEndTime
            });
            showAlert("Datos actualizados.");
        } else {
            // Guest Mode
            const h = window.globalSessionCache;
            localStorage.setItem('guest_study_history', JSON.stringify(h));
            showAlert("Datos actualizados (Local).");
            loadHistory();
        }

        disableEditSession();
        openSessionDetails(currentDetailId);
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
    document.getElementById('modal-manual').classList.remove('hidden');
};

const saveManualEntry = async () => {
    // Basic Manual Save
    const sub = document.getElementById('man-subject').value;
    const met = document.getElementById('man-method').value;
    const dur = parseInt(document.getElementById('man-duration').value) || 0;

    if (dur <= 0) return showAlert("Duración inválida");

    const sessionData = {
        uid: getCurrentUser() ? getCurrentUser().uid : 'guest',
        subject: sub,
        method: met,
        startTime: Date.now() - (dur * 60000),
        endTime: Date.now(),
        grossDuration: dur * 60000,
        netDuration: dur * 60000,
        efficiency: 100,
        createdAt: Date.now()
    };

    const user = getCurrentUser();
    if (user) {
        await addDoc(collection(db, 'study_sessions'), sessionData);
    } else {
        const h = JSON.parse(localStorage.getItem('guest_study_history') || '[]');
        sessionData.id = Date.now();
        h.push(sessionData);
        localStorage.setItem('guest_study_history', JSON.stringify(h));
        loadHistory();
    }
    document.getElementById('modal-manual').classList.add('hidden');
    showAlert("Agregado.");
};
