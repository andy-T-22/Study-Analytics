import { createGoal, deleteGoal, getPaceString, getCurrentGoals } from "./goals.js";
import { getSubjects } from "./data.js"; // To populate subject dropdown in modal
import { showAlert, showConfirm } from "./utils.js";
import { getCurrentUser } from "./auth.js";

export const renderGoals = (goals) => {
    const list = document.getElementById('goals-grid');
    if (!list) return;

    if (goals.length === 0) {
        list.innerHTML = `
            <div class="col-span-full py-12 text-center text-secondary border-2 border-dashed border-theme rounded-3xl">
                <div class="text-4xl mb-4">🎯</div>
                <p class="font-bold">No tienes metas activas</p>
                <button id="btn-create-first-goal" class="mt-4 text-acc-blue-dark hover:underline">Crear mi primera meta</button>
            </div>
        `;
        const btn = document.getElementById('btn-create-first-goal');
        if (btn) btn.onclick = openCreateGoalModal;
        updateGoalSelects(goals); // Update dropdowns even if empty
        return;
    }

    list.innerHTML = goals.map(g => {
        const percent = Math.min(100, Math.round(((g.accumulatedHours || 0) / g.targetHours) * 100));

        // Use Persisted/Stable Pace
        const intensity = getPaceString(g);

        // Color based on urgency/progress
        let barColor = "bg-acc-blue";
        if (percent >= 100) barColor = "bg-acc-green";
        else if (percent > 80) barColor = "bg-acc-peach";

        return `
            <div class="glass p-6 rounded-3xl relative group transition-transform hover:-translate-y-1 flex flex-col justify-between">
                <div>
                    <span class="text-[10px] uppercase font-bold tracking-widest text-secondary mb-1 block">${g.subject}</span>
                    <h3 class="text-xl font-bold text-primary mb-1 truncate" title="${g.nombre}">${g.nombre}</h3>
                    <div class="text-xs text-secondary mb-4 flex gap-2 items-center">
                        <i class="far fa-calendar-alt"></i> ${new Date(g.examDate).toLocaleDateString()}
                    </div>

                    <div class="mb-2 flex justify-between items-end text-xs font-mono font-bold text-primary">
                        <span>${(g.accumulatedHours || 0).toFixed(1)}h / ${g.targetHours}h</span>
                        <span>${percent}%</span>
                    </div>
                    
                    <div class="h-3 w-full bg-main rounded-full overflow-hidden border border-theme mb-4">
                        <div class="${barColor} h-full transition-all duration-1000" style="width: ${percent}%"></div>
                    </div>

                    <div class="p-3 bg-card/50 rounded-xl border border-theme text-xs text-center mb-4">
                        <span class="block text-secondary font-bold uppercase text-[10px] mb-1">Ritmo Sugerido</span>
                        <span class="text-primary font-mono font-bold">${intensity}</span>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button class="flex-1 btn-view-sessions bg-main hover:bg-theme border border-theme text-secondary hover:text-primary py-2 rounded-xl text-xs font-bold transition-colors" data-id="${g.id}">
                        <i class="fas fa-list-ul mr-1"></i> Sesiones
                    </button>
                    <button class="btn-delete-goal bg-main hover:bg-red-500/10 border border-theme text-secondary hover:text-red-500 px-3 py-2 rounded-xl transition-colors" data-id="${g.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Bindings
    list.querySelectorAll('.btn-delete-goal').forEach(b => {
        b.onclick = () => {
            showConfirm("Eliminar Meta", "¿Estás seguro? Las sesiones no se borrarán.", () => {
                deleteGoal(b.dataset.id);
            });
        };
    });

    list.querySelectorAll('.btn-view-sessions').forEach(b => {
        b.onclick = () => {
            const goal = goals.find(g => g.id === b.dataset.id);
            if (goal) openGoalSessions(goal);
        };
    });

    updateGoalSelects(goals);
};

const openGoalSessions = (goal) => {
    const modal = document.getElementById('modal-goal-sessions');
    const list = document.getElementById('goal-sessions-list');
    document.getElementById('goal-sessions-title').textContent = goal.nombre;

    // Get Sessions
    const sessions = window.globalSessionCache || [];
    const linked = sessions.filter(s => s.goalId === goal.id).sort((a, b) => b.startTime - a.startTime);

    list.innerHTML = '';
    if (linked.length === 0) {
        list.innerHTML = '<tr><td colspan="3" class="p-8 text-center italic text-secondary">No hay sesiones vinculadas.</td></tr>';
    } else {
        linked.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-white/5 cursor-pointer transition-colors group border-b border-theme/50 last:border-0";
            tr.onclick = () => {
                if (window.openSessionDetails) {
                    window.openSessionDetails(s.id);
                }
            };

            const dateStr = new Date(s.startTime).toLocaleDateString();
            const durMin = Math.round(s.netDuration / 60000);

            tr.innerHTML = `
                <td class="p-4 text-sm text-primary font-bold">${dateStr}</td>
                <td class="p-4 text-sm text-secondary font-mono">${durMin} min</td>
                <td class="p-4 text-sm text-right font-bold ${s.efficiency >= 80 ? 'text-acc-green' : 'text-acc-peach'}">${s.efficiency}%</td>
            `;
            list.appendChild(tr);
        });
    }

    modal.classList.remove('hidden');
    // Ensure close button exists and is bound (idempotent)
    const closeBtn = document.getElementById('btn-close-goal-sessions');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

    // Also bind backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };
};

export const openCreateGoalModal = () => {
    // Populate Subjects
    const subSel = document.getElementById('goal-form-subject');
    const subjects = getSubjects();
    subSel.innerHTML = subjects.map(s => `<option value="${s}">${s}</option>`).join('');

    // Reset Form
    document.getElementById('goal-form-name').value = "";
    document.getElementById('goal-form-hours').value = "";
    document.getElementById('goal-form-date').value = "";

    document.getElementById('modal-goal-create').classList.remove('hidden');
};

export const saveNewGoal = async () => {
    const name = document.getElementById('goal-form-name').value;
    const sub = document.getElementById('goal-form-subject').value;
    const hours = parseFloat(document.getElementById('goal-form-hours').value);
    const dateVal = document.getElementById('goal-form-date').value;

    if (!name || !sub || !hours || !dateVal) return showAlert("Completa todos los campos");

    try {
        await createGoal(getCurrentUser(), {
            nombre: name,
            subject: sub,
            targetHours: hours,
            examDate: new Date(dateVal)
        });
        document.getElementById('modal-goal-create').classList.add('hidden');
        showAlert("¡Meta creada!");
    } catch (e) {
        console.error(e);
        showAlert("Error al crear meta");
    }
};

// Update the Tracker Dropdown
const updateGoalSelects = (goals) => {
    // This is called whenever goals change.
    // We update the 'sel-goal' options, but filtered by the currently selected subject 
    // is handled by the timer module change event.
    // However, we need to expose the raw list or trigger an update event.
    // Simpler: Trigger a custom event on document
    document.dispatchEvent(new CustomEvent('goals-updated'));
};
