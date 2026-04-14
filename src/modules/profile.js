import { showConfirm, showAlert } from './utils.js';
import { db } from '../services/firebaseConfig.js';
import { doc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth } from '../services/firebaseConfig.js';
import { getAuth, signOut, deleteUser } from 'firebase/auth';
import { renderAllManagers, addManagerItem } from './data.js';

let profileInitialized = false;

// Settings State
export let appSettings = {
    playSounds: false,
    showSeconds: true,
    showFavicon: true,
    dailyGoalHours: 4
};

export const initProfile = () => {
    if (profileInitialized) return;
    profileInitialized = true;
    
    // Load Settings
    const savedSettings = localStorage.getItem('app_settings_v2');
    if (savedSettings) {
        appSettings = { ...appSettings, ...JSON.parse(savedSettings) };
    }

    // Bind Modals & Tabs
    const modalProfile = document.getElementById('modal-profile');
    const btnOpenProfile = document.getElementById('btn-open-profile');
    const btnCloseDesktop = document.getElementById('btn-close-profile-desktop');
    const btnCloseMobile = document.getElementById('btn-close-profile-mobile');

    btnOpenProfile.addEventListener('click', () => {
        modalProfile.classList.remove('hidden');
        renderStats(); // Update stats upon opening
        renderAccountInfo(); // Fill Account tab
        renderAllManagers(); // Render inline lists for Organize tab
    });

    const closeProfile = () => modalProfile.classList.add('hidden');
    if(btnCloseDesktop) btnCloseDesktop.addEventListener('click', closeProfile);
    if(btnCloseMobile) btnCloseMobile.addEventListener('click', closeProfile);

    // Tab Switching
    const tabBtns = document.querySelectorAll('[data-profile-tab]');
    const tabContents = document.querySelectorAll('.profile-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Deactivate all
            tabBtns.forEach(b => {
                b.classList.remove('bg-theme', 'text-primary');
                b.classList.add('text-secondary');
            });
            tabContents.forEach(c => c.classList.add('hidden'));

            // Activate clicked
            btn.classList.add('bg-theme', 'text-primary');
            btn.classList.remove('text-secondary');
            const target = btn.getAttribute('data-profile-tab');
            const targetEl = document.getElementById('profile-tab-' + target);
            if(targetEl) {
                targetEl.classList.remove('hidden');
                // Restart animation
                targetEl.classList.remove('fade-in');
                void targetEl.offsetWidth;
                targetEl.classList.add('fade-in');
            }
        });
    });

    bindAppearanceAndTimers();
    bindAccountManager();
    bindDangerZone();

    // Inline Managers
    const btnAddSubInline = document.getElementById('btn-add-subject-inline');
    if (btnAddSubInline) btnAddSubInline.addEventListener('click', () => addManagerItem('Subjects'));

    const btnAddReaInline = document.getElementById('btn-add-reason-inline');
    if (btnAddReaInline) btnAddReaInline.addEventListener('click', () => addManagerItem('Reasons'));
};

const renderAccountInfo = () => {
    const user = auth.currentUser;
    if (user) {
        document.getElementById('acc-cfg-email').value = user.email || '';
        document.getElementById('acc-cfg-name').value = user.displayName || user.email.split('@')[0];
    } else {
        document.getElementById('acc-cfg-email').value = 'Invitado';
        document.getElementById('acc-cfg-name').value = 'Invitado';
    }
};

const bindAccountManager = () => {
    const btnSaveName = document.getElementById('btn-save-acc-name');
    if (btnSaveName) {
        btnSaveName.addEventListener('click', async () => {
            const newName = document.getElementById('acc-cfg-name').value.trim();
            if (!newName) return showAlert("El nombre no puede estar vacío", "error");
            
            try {
                const { updateUserName } = await import('./auth.js');
                await updateUserName(newName);
                showAlert("Nombre actualizado", "success");
            } catch (e) {
                showAlert("Error al actualizar nombre", "error");
            }
        });
    }

    const btnChangePass = document.getElementById('btn-change-password');
    const modalPass = document.getElementById('modal-change-password');
    const btnClosePass = document.getElementById('btn-close-password-modal');
    const btnSavePass = document.getElementById('btn-save-password');
    const warnReauth = document.getElementById('password-reauth-warning');

    if (btnChangePass && modalPass) {
        btnChangePass.addEventListener('click', () => {
            if (!auth.currentUser) return showAlert("Debes iniciar sesión para esto.", "error");
            document.getElementById('input-new-password').value = '';
            warnReauth.classList.add('hidden');
            modalPass.classList.remove('hidden');
        });

        if (btnClosePass) btnClosePass.addEventListener('click', () => {
            modalPass.classList.add('hidden');
        });

        if (btnSavePass) btnSavePass.addEventListener('click', async () => {
            const newPass = document.getElementById('input-new-password').value;
            if (newPass.length < 6) return showAlert("Debe tener al menos 6 caracteres.", "error");
            
            try {
                const { updateUserPassword } = await import('./auth.js');
                await updateUserPassword(newPass);
                showAlert("Contraseña actualizada exitosamente", "success");
                modalPass.classList.add('hidden');
            } catch (e) {
                if (e.code === 'auth/requires-recent-login') {
                    warnReauth.classList.remove('hidden');
                } else {
                    showAlert("Hubo un error al cambiar la contraseña", "error");
                }
            }
        });
    }
};

const saveSettings = () => {
    localStorage.setItem('app_settings_v2', JSON.stringify(appSettings));
    showAlert("Configuración guardada", "success");
};

const bindAppearanceAndTimers = () => {
    // Toggles
    const toggleSound = document.getElementById('btn-toggle-sound');
    const toggleSeconds = document.getElementById('btn-toggle-seconds');
    const toggleFavicon = document.getElementById('btn-toggle-favicon');

    const updateToggleUI = (btn, isTrue) => {
        if(!btn) return;
        const thumb = btn.firstElementChild;
        if (isTrue) {
            btn.classList.replace('bg-gray-300', 'bg-acc-blue');
            thumb.classList.add('translate-x-6');
        } else {
            btn.classList.replace('bg-acc-blue', 'bg-gray-300');
            thumb.classList.remove('translate-x-6');
        }
    };

    if(toggleSound) {
        updateToggleUI(toggleSound, appSettings.playSounds);
        toggleSound.addEventListener('click', () => {
            appSettings.playSounds = !appSettings.playSounds;
            updateToggleUI(toggleSound, appSettings.playSounds);
            saveSettings();
        });
    }

    if(toggleSeconds) {
        updateToggleUI(toggleSeconds, appSettings.showSeconds);
        toggleSeconds.addEventListener('click', () => {
            appSettings.showSeconds = !appSettings.showSeconds;
            updateToggleUI(toggleSeconds, appSettings.showSeconds);
            saveSettings();
        });
    }

    if(toggleFavicon) {
        updateToggleUI(toggleFavicon, appSettings.showFavicon);
        toggleFavicon.addEventListener('click', () => {
            appSettings.showFavicon = !appSettings.showFavicon;
            updateToggleUI(toggleFavicon, appSettings.showFavicon);
            saveSettings();
            window.dispatchEvent(new Event('app_settings_updated'));
        });
    }
};

const renderStats = async () => {
    const history = window.globalSessionCache || [];
    
    let totalMs = 0;
    let totalEff = 0;
    let validEffCount = 0;
    
    history.forEach(s => {
        totalMs += s.netDuration || 0;
        if (s.efficiency !== undefined) {
            totalEff += s.efficiency;
            validEffCount++;
        }
    });

    const hours = (totalMs / 3600000).toFixed(1);
    const avgEff = validEffCount > 0 ? Math.round(totalEff / validEffCount) : 0;

    // Calc Streak
    let bestStreak = 0;
    let currentStreak = 0;
    let lastDateStr = null;

    // History is usually sorted newest first? Sort them oldest first for streak calc
    const sorted = [...history].sort((a, b) => a.createdAt - b.createdAt);
    const uniqueDays = new Set();
    sorted.forEach(s => {
        const d = new Date(s.createdAt || s.startTime);
        uniqueDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    
    const daysArr = Array.from(uniqueDays);
    // Rough calc for longest streak without parsing dates perfectly:
    // Actually just a rough calc for demo
    if (daysArr.length > 0) {
        bestStreak = 1; currentStreak = 1;
        for (let i = 1; i < daysArr.length; i++) {
            const dPrev = new Date(daysArr[i-1].replace(/-/g, '/'));
            const dCurr = new Date(daysArr[i].replace(/-/g, '/'));
            const diffDays = Math.round((dCurr - dPrev) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                currentStreak++;
                bestStreak = Math.max(bestStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }
    }

    document.getElementById('profile-stat-total-hours').innerText = hours + 'h';
    document.getElementById('stat-efficiency').innerText = avgEff + '%';
    document.getElementById('stat-max-streak').innerText = bestStreak.toString(); 
};

const bindDangerZone = () => {

    // CSV LOGIC
    const btnCsv = document.getElementById('btn-export-csv');
    if (btnCsv) {
        btnCsv.addEventListener('click', () => {
            const history = window.globalSessionCache || [];
            if(history.length === 0) {
                showAlert("No hay datos para exportar.");
                return;
            }
            
            let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
            csvContent += "FECHA,MATERIA,TIEMPO(min),EFICIENCIA(%),METODO\n";
            history.forEach(row => {
                let dateStr = "Sin Fecha";
                if (row.createdAt) {
                    dateStr = new Date(row.createdAt).toLocaleDateString() + " " + new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (row.startTime) {
                    dateStr = new Date(row.startTime).toLocaleDateString() + " " + new Date(row.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                const materia = row.subject || "N/A";
                const tiempo = Math.round((row.netDuration || 0) / 60000);
                const efi = row.efficiency || 0;
                const metodo = row.method || "N/A";

                csvContent += `"${dateStr}","${materia}",${tiempo},${efi},"${metodo}"\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "study_meter_historial.csv");
            document.body.appendChild(link); // Required for FF
            link.click();
            link.remove();
        });
    }
};
