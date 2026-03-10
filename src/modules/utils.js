import { toast } from "./toasts.js";

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
