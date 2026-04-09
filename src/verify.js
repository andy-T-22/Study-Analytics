import './style.css';
import { auth } from './services/firebaseConfig.js';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
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
        [stateLoading, stateSuccess, stateError, document.getElementById('state-reset')].forEach(el => {
            if(el) el.classList.add('hidden');
        });
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
    } else if (mode === 'resetPassword') {
        try {
            // Verify the link is valid before letting them type
            const email = await verifyPasswordResetCode(auth, oobCode);
            showState('state-reset');
            
            const formReset = document.getElementById('form-reset');
            const newPassInput = document.getElementById('reset-pass');
            const confirmPassInput = document.getElementById('reset-pass-confirm');
            const errorDisplay = document.getElementById('reset-error');
            const btnSubmit = document.getElementById('btn-reset-submit');

            // Set up password visibility toggles
            document.querySelectorAll('.toggle-pwd').forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetId = btn.getAttribute('data-target');
                    const targetInput = document.getElementById(targetId);
                    const icon = btn.querySelector('i');
                    
                    if (targetInput.type === 'password') {
                        targetInput.type = 'text';
                        icon.classList.remove('fa-eye');
                        icon.classList.add('fa-eye-slash');
                    } else {
                        targetInput.type = 'password';
                        icon.classList.remove('fa-eye-slash');
                        icon.classList.add('fa-eye');
                    }
                });
            });

            formReset.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorDisplay.classList.add('hidden');
                
                const pwd = newPassInput.value;
                const pwdConf = confirmPassInput.value;
                
                if (pwd.length < 6) {
                    errorDisplay.textContent = "La contraseña debe tener al menos 6 caracteres.";
                    errorDisplay.classList.remove('hidden');
                    return;
                }
                
                if (pwd !== pwdConf) {
                    errorDisplay.textContent = "Las contraseñas no coinciden.";
                    errorDisplay.classList.remove('hidden');
                    return;
                }
                
                btnSubmit.disabled = true;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
                
                try {
                    await confirmPasswordReset(auth, oobCode, pwd);
                    // On success, show success state but change text
                    document.getElementById('state-success').querySelector('h2').textContent = "¡Contraseña Actualizada!";
                    document.getElementById('state-success').querySelector('p').textContent = `Tu contraseña para ${email} se actualizó correctamente. Ya puedes iniciar sesión con tu nueva contraseña.`;
                    showState('state-success');
                } catch(error) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = 'Actualizar Contraseña';
                    errorDisplay.textContent = "Ocurrió un error al actualizar la contraseña.";
                    if (error.code === 'auth/expired-action-code') errorDisplay.textContent = "El enlace expiró.";
                    errorDisplay.classList.remove('hidden');
                }
            });

        } catch (error) {
            console.error("Invalid reset code", error);
            errorMsg.textContent = "El enlace para restablecer la contraseña es inválido o ya expiró.";
            showState('state-error');
        }
    } else {
        // Unhandled mode
        errorMsg.textContent = "Acción no soportada en esta página.";
        showState('state-error');
    }
});
