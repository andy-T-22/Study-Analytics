import { db } from "../services/firebaseConfig.js";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc } from "firebase/firestore";
import { renderHistoryList, applyHistoryFilters, updateCharts } from "./charts.js"; // Circular dep potential? We'll see. Ideally signals.
import { showAlert, showConfirm } from "./utils.js";

// Global Cache for Analysis
window.globalSessionCache = [];

let subjects = [];
let methods = [];
let currentUserRef = null;

export const initData = async (user) => {
    currentUserRef = user;
    await loadPreferences();
    loadHistory(); // Start listener
    setupManagerUI();
};

// --- PREFERENCES (Lists) ---
const loadPreferences = async () => {
    if (currentUserRef) {
        // Firestore Strategy
        const docRef = doc(db, 'user_preferences', currentUserRef.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            subjects = data.subjects || defaultSubjects();
            methods = data.methods || defaultMethods();
        } else {
            // Initial Save
            subjects = defaultSubjects();
            methods = defaultMethods();
            await setDoc(docRef, { subjects, methods });
        }
    } else {
        // LocalStorage Strategy (Legacy/Guest)
        subjects = JSON.parse(localStorage.getItem('study_subjects') || JSON.stringify(defaultSubjects()));
        methods = JSON.parse(localStorage.getItem('study_methods') || JSON.stringify(defaultMethods()));
    }
    renderAllDropdowns();
};

const defaultSubjects = () => ["Matemáticas", "Historia", "Programación", "Idioma"];
const defaultMethods = () => ["Leer", "Resumir", "Ejercicios", "Repaso"];

const savePreferences = async () => {
    if (currentUserRef) {
        try {
            await updateDoc(doc(db, 'user_preferences', currentUserRef.uid), {
                subjects,
                methods
            });
        } catch (e) {
            console.error("Error saving prefs:", e);
        }
    } else {
        localStorage.setItem('study_subjects', JSON.stringify(subjects));
        localStorage.setItem('study_methods', JSON.stringify(methods));
    }
    renderAllDropdowns();
};

// --- HISTORY LOADING ---
export const loadHistory = () => {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<tr><td colspan="5" class="p-8 text-center italic">Cargando...</td></tr>';

    if (currentUserRef) {
        const q = query(collection(db, 'study_sessions'), where('uid', '==', currentUserRef.uid));

        onSnapshot(q, (snapshot) => {
            let docs = [];
            snapshot.forEach(doc => {
                let d = doc.data();
                d.id = doc.id;
                // Normalize Timestamps
                if (d.startTime && typeof d.startTime.toDate === 'function') d.startTime = d.startTime.toDate();
                if (d.endTime && typeof d.endTime.toDate === 'function') d.endTime = d.endTime.toDate();
                if (d.createdAt && typeof d.createdAt.toDate === 'function') d.createdAt = d.createdAt.toDate();
                docs.push(d);
            });
            window.globalSessionCache = docs;
            processDataChange(docs);
        }, (err) => {
            console.error(err);
            listEl.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Error cargando datos.</td></tr>';
        });

    } else {
        const local = JSON.parse(localStorage.getItem('guest_study_history') || '[]');
        local.forEach((item, idx) => {
            item.id = item.id || idx;
            if (item.startTime) item.startTime = new Date(item.startTime);
            if (item.endTime) item.endTime = new Date(item.endTime);
            if (item.createdAt) item.createdAt = new Date(item.createdAt);
        });
        window.globalSessionCache = local;
        processDataChange(local);
    }
};

const processDataChange = (docs) => {
    docs.sort((a, b) => b.createdAt - a.createdAt);
    // Refresh UI
    applyHistoryFilters();
    updateCharts();
};

// --- DROPDOWNS ---
const renderAllDropdowns = () => {
    // Helper to populate
    const pop = (id, list) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = list.map(i => `<option value="${i}">${i}</option>`).join('');
    };

    // Tracker Setup
    pop('sel-subject', subjects);
    pop('sel-method', methods);

    // Manual Entry
    pop('man-subject', subjects);
    pop('man-method', methods);

    // Filters (needs "All")
    const popFilter = (id, list) => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value || 'all';
        el.innerHTML = `<option value="all">Todas</option>` + list.map(i => `<option value="${i}">${i}</option>`).join('');
        el.value = current;
    };
    popFilter('dash-filter-subject', subjects);
    popFilter('hist-filter-subject', subjects);
};

// --- MANAGER UI LOGIC ---
let currentManagerType = null; // 'Subjects' or 'Methods'

const setupManagerUI = () => {
    // Open Buttons
    document.querySelectorAll('.btn-manage-subjects').forEach(b => {
        b.onclick = () => openManager('Subjects');
    });
    document.querySelectorAll('.btn-manage-methods').forEach(b => {
        b.onclick = () => openManager('Methods');
    });

    // Close Button
    document.getElementById('btn-close-manager').onclick = closeManager;
    document.getElementById('btn-add-manager-item').onclick = addManagerItem;
};

const openManager = (type) => {
    currentManagerType = type;
    document.getElementById('manager-title').textContent = type === 'Subjects' ? 'Gestionar Materias' : 'Gestionar Métodos';
    document.getElementById('modal-manager').classList.remove('hidden');
    renderManagerList();
};

const closeManager = () => {
    document.getElementById('modal-manager').classList.add('hidden');
    currentManagerType = null;
};

const renderManagerList = () => {
    const listData = currentManagerType === 'Subjects' ? subjects : methods;
    const container = document.getElementById('manager-list');
    container.innerHTML = '';

    listData.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'manager-item';
        div.innerHTML = `
            <input type="text" value="${item}" readonly class="text-primary text-sm bg-transparent" id="man-input-${index}">
            <div class="flex items-center gap-2 ml-2">
                <button class="btn-edit w-8 h-8 rounded-full hover:bg-blue-50 text-acc-blue-dark flex items-center justify-center transition-colors">
                    <i class="fas fa-pencil-alt text-xs"></i>
                </button>
                <button class="btn-del w-8 h-8 rounded-full hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;

        // Bind events
        div.querySelector('.btn-edit').onclick = () => enableEdit(index, div.querySelector('button i'));
        div.querySelector('.btn-del').onclick = () => deleteItem(index);

        // Enter key save
        const input = div.querySelector('input');
        input.onkeydown = (e) => { if (e.key === 'Enter') saveEdit(index, input.value); };

        container.appendChild(div);
    });
};

const enableEdit = (index, iconEl) => {
    const input = document.getElementById(`man-input-${index}`);
    if (input.readOnly) {
        input.readOnly = false;
        input.focus();
        iconEl.className = "fas fa-check text-green-500";
        // Override click to save
        iconEl.parentElement.onclick = () => saveEdit(index, input.value);
    }
};

const saveEdit = (index, newValue) => {
    const listData = currentManagerType === 'Subjects' ? subjects : methods;
    if (newValue.trim()) {
        listData[index] = newValue.trim();
        savePreferences();
        renderManagerList();
    }
};

const deleteItem = (index) => {
    const listData = currentManagerType === 'Subjects' ? subjects : methods;
    showConfirm("Confirmar", "¿Eliminar este elemento?", () => {
        listData.splice(index, 1);
        savePreferences();
        renderManagerList();
    });
};

const addManagerItem = () => {
    const listData = currentManagerType === 'Subjects' ? subjects : methods;
    listData.push("Nuevo Elemento");
    savePreferences().then(() => {
        renderManagerList();
        // Auto-edit last item
        const idx = listData.length - 1;
        const input = document.getElementById(`man-input-${idx}`);
        if (input) {
            // Find the edit button for this index
            const btn = input.nextElementSibling.querySelector('button');
            if (btn) btn.click();
        }
    });
};

export const getSubjects = () => subjects;
export const getMethods = () => methods;
