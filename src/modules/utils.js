import { toast } from "./toasts.js";

export const formatHours = (decimalHours) => {
    if (decimalHours == null || isNaN(decimalHours)) return "0h 00m";
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (m === 60) {
        return `${h + 1}h 00m`;
    }
    return `${h}h ${m.toString().padStart(2, '0')}m`;
};

export const formatTime = (ms, showSeconds = true) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;

    let timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    if (showSeconds) {
        timeStr += `:${s.toString().padStart(2, '0')}`;
    }
    return timeStr;
};

export const getStyle = (varName) => {
    return getComputedStyle(document.body).getPropertyValue(varName).trim();
};

export const showAlert = (msg, type = 'info') => {
    toast.show(msg, type);
};

export const showConfirm = (title, msg, onConfirm) => {
    const overlay = document.getElementById('modal-generic');
    const tEl = document.getElementById('modal-title');
    const mEl = document.getElementById('modal-msg');
    const actEl = document.getElementById('modal-actions');

    tEl.textContent = title;
    mEl.textContent = msg;
    actEl.innerHTML = '';

    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancelar';
    btnCancel.className = 'px-4 py-2 rounded-lg text-sm font-bold text-[#8a8175] hover:bg-gray-100 transition-colors';
    btnCancel.onclick = () => overlay.classList.remove('open');
    actEl.appendChild(btnCancel);

    const btnConfirm = document.createElement('button');
    btnConfirm.textContent = 'Aceptar';
    btnConfirm.className = 'px-6 py-2 rounded-lg text-sm font-bold bg-[#a5ccf5] text-[#5c554b] hover:bg-[#74a8db] transition-colors';
    btnConfirm.onclick = () => {
        overlay.classList.remove('open');
        if (onConfirm) onConfirm();
    };
    actEl.appendChild(btnConfirm);

    overlay.classList.add('open');
};

export const evaluateStreak = (current_time, user_timezone, current_state) => {
    const now = new Date(current_time);
    const { streak, last_date, freezes } = current_state;

    let timeZoneToUse = user_timezone;
    if (!timeZoneToUse) {
        timeZoneToUse = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    let todayStr;
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: timeZoneToUse,
            year: 'numeric', month: '2-digit', day: '2-digit' 
        });
        todayStr = formatter.format(now);
    } catch (e) {
        // Fallback if timezone is invalid
        todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    
    let new_streak = streak || 0;
    let new_freeze_count = freezes || 0;
    let status = "maintained";
    let message = "";

    if (!last_date) {
        new_streak = 1;
        status = "continued";
        message = "¡Primer día de actividad! Comienza tu racha.";
    } else {
        const todayDate = new Date(todayStr + "T00:00:00");
        const lastDateObj = new Date(last_date + "T00:00:00");
        const diffTime = todayDate - lastDateObj;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            new_streak += 1;
            status = "continued";
            message = "¡Un día más! Sigue así.";
        } else if (diffDays === 0) {
            status = "maintained";
            message = "Esfuerzo extra hoy, ¡bien hecho!";
        } else if (diffDays > 1 && new_freeze_count > 0) {
            new_freeze_count -= 1;
            status = "frozen";
            message = "Día salvado por tu protector de racha.";
        } else if (diffDays > 1 && new_freeze_count === 0) {
            new_streak = 1;
            status = "lost";
            message = "Racha perdida. ¡A empezar de nuevo con fuerza!";
        } else if (diffDays < 0) {
             // In case of time travel / testing
             status = "maintained";
             message = "Actividad registrada correctamente.";
        }
    }

    const mod = new_streak % 5;
    const days_to_next = mod === 0 ? 5 : 5 - mod;

    return {
        new_streak,
        new_freeze_count,
        status,
        message,
        next_milestone: `${days_to_next} días`
    };
};
