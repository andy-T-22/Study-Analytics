import { db } from "../services/firebaseConfig.js";
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, updateDoc } from "firebase/firestore";
import { renderHistoryList, applyHistoryFilters, updateCharts } from "./charts.js"; // Circular dep potential? We'll see. Ideally signals.
import { showAlert, showConfirm, getStyle } from "./utils.js";
import { initGoals } from "./goals.js";
import { renderGoals } from "./goalsUI.js";

// Global Cache for Analysis
window.globalSessionCache = [];

let subjects = [];
let methods = [];
let reasons = [];
let subjectColors = {};
let currentUserRef = null;

export const initData = async (user) => {
    currentUserRef = user;
    await loadPreferences();
    loadHistory(); // Start listener

    // Init Goals Listener
    initGoals(user, (goals) => {
        renderGoals(goals);
    });

    setupManagerUI();
};

// --- PREFERENCES (Lists) ---
const loadPreferences = async () => {
    let isOnboarded = false;
    let needsInitialSave = false;

    if (currentUserRef) {
        // Firestore Strategy
        const docRef = doc(db, 'user_preferences', currentUserRef.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            subjects = data.subjects || defaultSubjects();
            methods = data.methods || defaultMethods();
            reasons = data.reasons || defaultReasons();
            subjectColors = data.subjectColors || defaultSubjectColors();
            
            if (data.onboarded === undefined) {
                // Legacy users who registered before this update
                isOnboarded = true;
                // Silently upgrade them so we don't ask again
                updateDoc(docRef, { onboarded: true }).catch(console.error);
            } else {
                isOnboarded = data.onboarded === true;
            }
        } else {
            // Initial Save
            subjects = [];
            methods = [];
            reasons = defaultReasons();
            subjectColors = defaultSubjectColors();
            isOnboarded = false;
            needsInitialSave = true;
        }
    } else {
        // LocalStorage Strategy (Legacy/Guest)
        subjects = JSON.parse(localStorage.getItem('study_subjects') || JSON.stringify(defaultSubjects()));
        methods = JSON.parse(localStorage.getItem('study_methods') || JSON.stringify(defaultMethods()));
        reasons = JSON.parse(localStorage.getItem('study_reasons') || JSON.stringify(defaultReasons()));
        subjectColors = JSON.parse(localStorage.getItem('study_subject_colors') || JSON.stringify(defaultSubjectColors()));
        
        // Handle guest onboarding
        const guestOnb = localStorage.getItem('guest_onboarded');
        if (guestOnb) {
            isOnboarded = true;
        } else {
            subjects = [];
            methods = [];
            isOnboarded = false;
        }
    }
    
    if (needsInitialSave && currentUserRef) {
        const docRef = doc(db, 'user_preferences', currentUserRef.uid);
        await setDoc(docRef, { subjects, methods, reasons, subjectColors, onboarded: false });
    }

    renderAllDropdowns();

    if (!isOnboarded) {
        showOnboardingUI();
    }
};

const showOnboardingUI = () => {
    const modal = document.getElementById('modal-onboarding');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    let tempSubs = [];
    let tempMets = [];

    const inputSub = document.getElementById('onboarding-subject-input');
    const btnSub = document.getElementById('btn-onb-add-sub');
    const containerSub = document.getElementById('onboarding-subjects-list');

    const inputMet = document.getElementById('onboarding-method-input');
    const btnMet = document.getElementById('btn-onb-add-met');
    const containerMet = document.getElementById('onboarding-methods-list');

    const btnFinish = document.getElementById('btn-onboarding-finish');
    const errMsg = document.getElementById('onb-error-msg');

    const renderOnboardingChips = () => {
        const drawChips = (arr, container, colorClass, type) => {
            container.innerHTML = arr.map((item, idx) => `
                <div class="bg-card border border-theme px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-2 shadow-sm animate-slide-up">
                    ${item}
                    <button class="text-red-400 hover:text-red-500 delete-onb-chip" data-type="${type}" data-idx="${idx}"><i class="fas fa-times"></i></button>
                </div>
            `).join('');

            container.querySelectorAll('.delete-onb-chip').forEach(btn => {
                btn.onclick = (e) => {
                    const t = e.currentTarget.getAttribute('data-type');
                    const i = parseInt(e.currentTarget.getAttribute('data-idx'));
                    if (t === 'subject') tempSubs.splice(i, 1);
                    else tempMets.splice(i, 1);
                    renderOnboardingChips();
                };
            });
        };

        drawChips(tempSubs, containerSub, 'bg-acc-blue', 'subject');
        drawChips(tempMets, containerMet, 'bg-acc-peach', 'method');
    };

    const addSub = () => {
        const val = inputSub.value.trim();
        if (val && !tempSubs.includes(val)) {
            tempSubs.push(val);
            inputSub.value = '';
            renderOnboardingChips();
            errMsg.classList.add('hidden');
        }
    };

    const addMet = () => {
        const val = inputMet.value.trim();
        if (val && !tempMets.includes(val)) {
            tempMets.push(val);
            inputMet.value = '';
            renderOnboardingChips();
            errMsg.classList.add('hidden');
        }
    };

    btnSub.onclick = addSub;
    inputSub.onkeydown = (e) => { if (e.key === 'Enter') addSub(); };

    btnMet.onclick = addMet;
    inputMet.onkeydown = (e) => { if (e.key === 'Enter') addMet(); };

    btnFinish.onclick = async () => {
        if (tempSubs.length === 0 || tempMets.length === 0) {
            errMsg.classList.remove('hidden');
            return;
        }

        // Apply global
        subjects = tempSubs;
        methods = tempMets;
        
        // Colors random init
        tempSubs.forEach(s => {
            if(!subjectColors[s]) {
                const randColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                subjectColors[s] = randColor;
            }
        });

        // Close modal
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        
        // Save
        if (currentUserRef) {
            try {
                await updateDoc(doc(db, 'user_preferences', currentUserRef.uid), { 
                    subjects, 
                    methods, 
                    subjectColors,
                    onboarded: true 
                });
            } catch (e) {
                console.error("Save error", e);
            }
        } else {
            localStorage.setItem('guest_onboarded', 'true');
            await savePreferences(); // using existing function for generic saves
        }
        
        renderAllDropdowns();

        // Launch tutorial
        import('./tutorial.js').then((tut) => {
            tut.startTutorial();
        });
    };
};

const defaultSubjects = () => ["Matemáticas", "Historia", "Programación", "Idioma"];
const defaultMethods = () => ["Leer", "Resumir", "Ejercicios", "Repaso"];
const defaultReasons = () => ["Descanso", "Celular", "Llamada", "Comida"];
const defaultSubjectColors = () => ({"Matemáticas": "#3b82f6", "Historia": "#eab308", "Programación": "#10b981", "Idioma": "#a855f7"});

const savePreferences = async () => {
    if (currentUserRef) {
        try {
            await updateDoc(doc(db, 'user_preferences', currentUserRef.uid), {
                subjects,
                methods,
                reasons,
                subjectColors
            });
        } catch (e) {
            console.error("Error saving prefs:", e);
        }
    } else {
        localStorage.setItem('study_subjects', JSON.stringify(subjects));
        localStorage.setItem('study_methods', JSON.stringify(methods));
        localStorage.setItem('study_reasons', JSON.stringify(reasons));
        localStorage.setItem('study_subject_colors', JSON.stringify(subjectColors));
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

const updateStreak = (docs) => {
    const uniqueDays = new Set();
    docs.forEach(s => {
        const d = new Date(s.startTime);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        uniqueDays.add(`${year}-${month}-${day}`);
    });

    const sortedDays = Array.from(uniqueDays).sort((a, b) => b.localeCompare(a));
    
    let streak = 0;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    let checkDateStr = '';
    if (sortedDays.length > 0 && sortedDays[0] === todayStr) {
        checkDateStr = todayStr;
    } else if (sortedDays.length > 0 && sortedDays[0] === yesterdayStr) {
        checkDateStr = yesterdayStr;
    }

    if (checkDateStr) {
        let currentDate = new Date(checkDateStr + 'T12:00:00');
        for (let i = 0; i < sortedDays.length; i++) {
            const expectedStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            if (sortedDays[i] === expectedStr) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
    }

    const streakEl = document.getElementById('streak-counter');
    const streakNumEl = document.getElementById('streak-number');
    const streakLegendEl = document.getElementById('streak-legend');
    
    if (streakEl && streakNumEl) {
        streakNumEl.textContent = streak;
        streakEl.classList.remove('hidden');
        if (streak === 0) {
            streakEl.classList.add('opacity-50', 'grayscale');
        } else {
            streakEl.classList.remove('opacity-50', 'grayscale');
        }

        if (streakLegendEl) {
            const legends0 = [
                "¡Hoy es un gran día para empezar tu racha!",
                "Ningún día como hoy para comenzar.",
                "Inicia tu racha de estudio ahora.",
                "El primer paso es el más importante. ¡A estudiar!"
            ];
            
            const d = streak === 1 ? "día" : "días";
            const s = streak === 1 ? "seguido" : "seguidos";
            const c = streak === 1 ? "consecutivo" : "consecutivos";
            const l = streak === 1 ? "logrado" : "logrados";
            
            const legends = [
                `¡Llevas ${streak} ${d} ${s}, sigue así!`,
                `Increíble, ${streak} ${d} de puro enfoque.`,
                `Tu racha de ${streak} ${d} es inspiradora.`,
                `Fuego puro: ${streak} ${d} ${c}. ¡No pares!`,
                `¡Imparable! ${streak} ${d} construyendo tu futuro.`,
                `Estás en racha. ${streak} ${d} ${l}.`,
                `${streak} ${d} ${s}. La constancia es la clave.`
            ];
            
            const listToUse = streak === 0 ? legends0 : legends;
            const randomLegend = listToUse[Math.floor(Math.random() * listToUse.length)];
            streakLegendEl.textContent = randomLegend;
        }
    }
};

const processDataChange = (docs) => {
    updateStreak(docs);
    docs.sort((a, b) => b.createdAt - a.createdAt);
    // Refresh UI
    applyHistoryFilters();
    updateCharts();
    import('../modules/dailyGoal.js').then(m => m.renderDailyPlan()); // Update Daily Plan
};

// --- DROPDOWNS ---
export const renderAllDropdowns = () => {
    // Helper to populate
    const pop = (id, list) => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.innerHTML = list.map(i => `<option value="${i}">${i}</option>`).join('');
        if (current && list.includes(current)) {
            el.value = current;
        }
    };

    // Tracker Setup
    pop('sel-subject', subjects);
    pop('sel-method', methods);

    // Manual Entry
    pop('man-subject', subjects);
    pop('man-method', methods);

    // Post Session Entry (Grid format)
    const popGrid = (gridId, inputId, list, type) => {
        const grid = document.getElementById(gridId);
        const hiddenInput = document.getElementById(inputId);
        if(!grid || !hiddenInput) return;
        
        let current = hiddenInput.value;
        if (!current && list.length > 0) current = list[0];
        hiddenInput.value = current;

        grid.innerHTML = list.map(item => {
            const isSelected = item === current;
            let color = getStyle('--border-color') || '#6B7280';
            if (type === 'Subjects') color = subjectColors[item] || color;
            
            const isMethod = type !== 'Subjects';
            const selBorder = getStyle('--acc-blue-dark') || '#74a8db';

            const baseClass = isSelected ? 'opacity-100 scale-95 shadow-inner bg-card' : 'opacity-80 hover:opacity-100 hover:scale-[1.02] shadow-sm bg-card';
            const borderCol = isSelected ? (isMethod ? selBorder : color) : 'var(--border-color)';
            
            return `
            <div data-val="${item}" class="grid-selectable cursor-pointer flex flex-col items-center justify-center p-2 rounded-2xl border-[2px] transition-all ${baseClass}" style="border-color: ${borderCol};">
                <div class="w-6 h-6 rounded-full mb-1 shadow-sm flex items-center justify-center border-[3px] bg-clip-padding flex-shrink-0" style="border-color: ${isSelected && isMethod ? selBorder : color}; background-color: var(--bg-card);">
                    ${isMethod && isSelected ? '<div class="h-2 w-2 rounded-full bg-theme"></div>' : `<div class="w-full h-full rounded-full" style="background-color: ${color}"></div>`}
                </div>
                <div class="text-[10px] font-bold text-center w-full truncate text-primary">${item}</div>
            </div>
            `;
        }).join('');

        grid.innerHTML += `
        <div class="grid-add cursor-pointer flex flex-col items-center justify-center p-2 rounded-2xl border-[2px] border-dashed border-theme opacity-60 hover:opacity-100 transition-all shadow-sm bg-card/50">
            <div class="w-6 h-6 rounded-full mb-1 flex items-center justify-center flex-shrink-0 bg-transparent text-secondary">
                <i class="fas fa-plus text-[12px]"></i>
            </div>
            <div class="text-[10px] font-bold text-center w-full truncate text-secondary">Nuevo</div>
        </div>
        `;

        const addBtn = grid.querySelector('.grid-add');
        if (addBtn) {
            addBtn.onclick = () => {
                openManager(type);
                addManagerItem(type);
            };
        }

        grid.querySelectorAll('.grid-selectable').forEach(el => {
            el.onclick = () => {
                const newVal = el.getAttribute('data-val');
                if(hiddenInput.value !== newVal) {
                    hiddenInput.value = newVal;
                    hiddenInput.dispatchEvent(new Event('change'));
                }
                popGrid(gridId, inputId, list, type);
            };
        });
    };

    popGrid('post-subject', 'post-subject-input', subjects, 'Subjects');
    popGrid('post-method', 'post-method-input', methods, 'Methods');

    // Detail Edit
    pop('detail-subject', subjects);
    pop('detail-method', methods);

    // Filters (needs "All")
    const popFilter = (id, list) => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value || 'all';
        el.innerHTML = `<option value="all">Todas</option>` + list.map(i => `<option value="${i}">${i}</option>`).join('');
        el.value = current;
    };
    popFilter('global-filter-subject', subjects);

    renderPauseButtons();
};

const renderPauseButtons = () => {
    const container = document.getElementById('pause-reasons-grid');
    if (!container) return;

    const customBtn = document.getElementById('btn-custom-pause');
    // Clear existing dynamic buttons (siblings of customBtn)
    // Or simpler: clear all, reconstruct customBtn? 
    // No, customBtn has binding. 
    // Select all .btn-pause-reason and remove
    container.querySelectorAll('.btn-pause-reason').forEach(el => el.remove());

    reasons.forEach(r => {
        const btn = document.createElement('button');
        btn.className = "btn-pause-reason p-4 rounded-xl bg-main hover:bg-acc-blue text-primary text-sm font-bold transition-colors";
        btn.setAttribute('data-reason', r);
        // Maybe map emojis later, for now just text
        btn.textContent = r;

        if (customBtn) container.insertBefore(btn, customBtn);
        else container.appendChild(btn);
    });
};

// --- MANAGER UI LOGIC ---
let currentManagerType = null; // 'Subjects', 'Methods', or 'Reasons'

const setupManagerUI = () => {
    // Open Buttons
    document.querySelectorAll('.btn-manage-subjects').forEach(b => {
        b.onclick = () => openManager('Subjects');
    });
    document.querySelectorAll('.btn-manage-methods').forEach(b => {
        b.onclick = () => openManager('Methods');
    });
    // Pause Reasons Manager
    document.querySelectorAll('.btn-manage-reasons').forEach(b => {
        b.onclick = () => openManager('Reasons');
    });

    // Close Button
    document.getElementById('btn-close-manager').onclick = closeManager;
    document.getElementById('btn-add-manager-item').onclick = addManagerItem;
};

const openManager = (type) => {
    currentManagerType = type;
    let title = '';
    if (type === 'Subjects') title = 'Gestionar Materias';
    else if (type === 'Methods') title = 'Gestionar Métodos';
    else if (type === 'Reasons') title = 'Gestionar Motivos';

    document.getElementById('manager-title').textContent = title;
    document.getElementById('modal-manager').classList.remove('hidden');
    renderManagerList();
};

const closeManager = () => {
    document.getElementById('modal-manager').classList.add('hidden');
    currentManagerType = null;
};

export const renderAllManagers = () => {
    // Only render if containers exist
    if (document.getElementById('inline-manager-subjects')) {
        renderManagerList('Subjects', 'inline-manager-subjects');
    }
    if (document.getElementById('inline-manager-reasons')) {
        renderManagerList('Reasons', 'inline-manager-reasons');
    }
    if (document.getElementById('inline-manager-methods')) {
        renderManagerList('Methods', 'inline-manager-methods');
    }
};

const renderManagerList = (overrideType, containerId) => {
    const type = overrideType || currentManagerType;
    const cid = containerId || 'manager-list';
    
    let listData = [];
    if (type === 'Subjects') listData = subjects;
    else if (type === 'Methods') listData = methods;
    else if (type === 'Reasons') listData = reasons;

    const container = document.getElementById(cid);
    if (!container) return;
    container.innerHTML = '';

    listData.forEach((item, index) => {
        const div = document.createElement('div');
        
        let color = getStyle('--border-color') || '#6B7280';
        let isSubject = type === 'Subjects';
        if (isSubject) {
            color = subjectColors[item] || '#6B7280';
        }

        div.className = 'manager-item flex flex-col items-center justify-center p-3 rounded-2xl border-[3px] transition-all group aspect-square shadow-sm relative hover:scale-[1.02] active:scale-95 cursor-default bg-card';
        // Add specific class for non-subjects to avoid grid blowout if parent container is not a grid
        if(!document.getElementById(cid).classList.contains('grid')) {
             document.getElementById(cid).classList.add('grid', 'grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-3');
             document.getElementById(cid).classList.remove('space-y-3');
        }

        div.style.borderColor = color;
        div.style.backgroundColor = isSubject ? `${color}15` : 'transparent';
        
        div.innerHTML = `
            <div class="absolute top-2 right-2 flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                ${isSubject ? `
                <label class="btn-color w-7 h-7 rounded-full text-card flex items-center justify-center transition-transform hover:scale-110 shadow-sm border border-transparent hover:border-black/20 cursor-pointer relative overflow-hidden" title="Elegir Color" style="background-color: ${color}">
                    <i class="fas fa-palette text-[10px]"></i>
                    <input type="color" value="${color}" class="absolute -top-4 -left-4 w-16 h-16 opacity-0 cursor-pointer">
                </label>
                ` : ''}
                <button class="btn-edit w-7 h-7 rounded-full bg-main/80 hover:bg-blue-50 text-acc-blue-dark flex items-center justify-center transition-all shadow-sm">
                    <i class="fas fa-pencil-alt text-[10px]"></i>
                </button>
                <button class="btn-del w-7 h-7 rounded-full bg-main/80 hover:bg-red-50 text-red-500 flex items-center justify-center transition-all shadow-sm">
                    <i class="fas fa-trash-alt text-[10px]"></i>
                </button>
            </div>
            <div class="w-10 h-10 rounded-full mb-2 shadow-[0_4px_10px_rgba(0,0,0,0.15)] ${isSubject ? 'cursor-pointer' : ''} flex items-center justify-center bg-card border-[4px] bg-clip-padding flex-shrink-0" style="border-color: ${color}">
                <div class="w-full h-full rounded-full" style="background-color: ${color}"></div>
            </div>
            <input type="text" value="${item}" readonly class="text-xs font-bold bg-transparent text-center w-full outline-none mt-auto px-1 truncate" id="man-input-${type}-${index}" style="color: ${isSubject ? color : 'var(--text-primary)'}; min-height: 20px;">
        `;

        if (isSubject) {
            // Tie color picker to huge center circle
            const centerCircle = div.querySelector('.w-10.h-10');
            centerCircle.onclick = () => div.querySelector('input[type="color"]').click();

            // Color picker binding
            const colorInput = div.querySelector('input[type="color"]');
            colorInput.onchange = (e) => {
                subjectColors[item] = e.target.value;
                savePreferences().then(() => {
                    renderAllManagers();
                    if (currentManagerType === 'Subjects') renderManagerList('Subjects', 'manager-list');
                });
            };
        }

        div.querySelector('.btn-edit').onclick = () => enableEdit(type, index, div.querySelector('.btn-edit i'));
        div.querySelector('.btn-del').onclick = () => deleteItem(type, index);
        const input = div.querySelector('input[type="text"]');
        input.onkeydown = (e) => { if (e.key === 'Enter') saveEdit(type, index, input.value); };
        input.onblur = () => { if (!input.readOnly) saveEdit(type, index, input.value); };

        container.appendChild(div);
    });
};

const enableEdit = (type, index, iconEl) => {
    const input = document.getElementById(`man-input-${type}-${index}`);
    if (input && input.readOnly) {
        input.readOnly = false;
        input.focus();
        input.select();
        iconEl.className = "fas fa-check text-green-500";
        iconEl.parentElement.onclick = () => saveEdit(type, index, input.value);
    }
};

const saveEdit = (type, index, newValue) => {
    let listData = null;
    let oldVal = null;
    if (type === 'Subjects') {
        listData = subjects;
        oldVal = subjects[index];
    }
    else if (type === 'Methods') listData = methods;
    else if (type === 'Reasons') listData = reasons;

    const trimmed = newValue.trim();
    if (trimmed) {
        if (type === 'Subjects' && oldVal !== trimmed) {
            subjectColors[trimmed] = subjectColors[oldVal] || '#6B7280';
            delete subjectColors[oldVal];
        }
        listData[index] = trimmed;
    } else {
        if (type === 'Subjects') {
             delete subjectColors[listData[index]];
        }
        listData.splice(index, 1);
    }
    
    savePreferences().then(() => {
        renderAllManagers();
        if (currentManagerType === type) renderManagerList(type, 'manager-list');
    });
};

const deleteItem = (type, index) => {
    let listData = null;
    if (type === 'Subjects') listData = subjects;
    else if (type === 'Methods') listData = methods;
    else if (type === 'Reasons') listData = reasons;

    showConfirm("Confirmar", "¿Eliminar este elemento?", () => {
        if (type === 'Subjects') {
            delete subjectColors[listData[index]];
        }
        listData.splice(index, 1);
        savePreferences().then(() => {
            renderAllManagers();
            if (currentManagerType === type) renderManagerList(type, 'manager-list');
        });
    });
};

export const addManagerItem = (overrideType) => {
    const type = overrideType || currentManagerType;
    let listData = null;
    if (type === 'Subjects') listData = subjects;
    else if (type === 'Methods') listData = methods;
    else if (type === 'Reasons') listData = reasons;

    let newItem = "Nuevo Elemento";
    if (listData.includes(newItem)) {
        newItem = "Nuevo Elemento " + Math.floor(Math.random() * 100);
    }

    if (type === 'Subjects') {
        const palette = ['#3b82f6', '#eab308', '#10b981', '#a855f7', '#ef4444', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#64748b', '#2dd4bf', '#fb7185'];
        subjectColors[newItem] = palette[Math.floor(Math.random() * palette.length)];
    }

    listData.push(newItem);
    savePreferences().then(() => {
        renderAllManagers();
        if (currentManagerType === type) renderManagerList(type, 'manager-list');
        
        // Auto-edit
        const idx = listData.length - 1;
        const input = document.getElementById(`man-input-${type}-${idx}`);
        if (input) {
            const btn = input.parentElement.querySelector('.btn-edit');
            if (btn) btn.click();
            input.value = "";
            input.placeholder = "Nuevo Elemento";
        }
    });
};

export const getSubjects = () => subjects;
export const getMethods = () => methods;
export const getReasons = () => reasons;
export const getSubjectColors = () => subjectColors;

