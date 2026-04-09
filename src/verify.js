import './style.css';
import { auth } from './services/firebaseConfig.js';
import { applyActionCode } from 'firebase/auth';
import { faviconAnimator } from './modules/favicon.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Ensure the exact same favicon logic runs, but we keep it stopped (static)
    faviconAnimator.stop();
    
    // UI Elements
    const stateLoading = document.getElementById('state-loading');
    const stateSuccess = document.getElementById('state-success');
    const stateError = document.getElementById('state-error');
    const errorMsg = document.getElementById('error-msg');

    // Get parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const oobCode = urlParams.get('oobCode');

    // Helper functions
    const showState = (stateId) => {
        [stateLoading, stateSuccess, stateError].forEach(el => el.classList.add('hidden'));
        document.getElementById(stateId).classList.remove('hidden');
        document.getElementById(stateId).classList.add('flex');
    };

    if (!mode || !oobCode) {
        // Missing parameters, probably someone just navigated here directly
        errorMsg.textContent = "No se encontraron los códigos de verificación en el enlace.";
        showState('state-error');
        return;
    }

    if (mode === 'verifyEmail') {
        try {
            await applyActionCode(auth, oobCode);
            // Verification successful
            showState('state-success');
        } catch (error) {
            console.error("Verification failed", error);
            // Verification failed
            let humanError = "El enlace de verificación es inválido o ya expiró.";
            
            switch (error.code) {
                case 'auth/expired-action-code':
                    humanError = "El enlace ha expirado. Por favor solicita uno nuevo desde la aplicación.";
                    break;
                case 'auth/invalid-action-code':
                    humanError = "Este enlace ya ha sido utilizado o no es válido.";
                    break;
            }
            
            errorMsg.textContent = humanError;
            showState('state-error');
        }
    } else {
        // Unhandled mode (e.g. resetPassword - which we aren't planning for right now)
        errorMsg.textContent = "Acción no soportada en esta página.";
        showState('state-error');
    }
});
