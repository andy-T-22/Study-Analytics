import { auth, db } from "../services/firebaseConfig.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, deleteUser } from "firebase/auth";
import { doc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initData, loadHistory } from "./data.js";

let currentUser = null;

export const initAuth = () => {
    // Password toggles
    const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (btn && input) {
            btn.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        }
    };
    setupToggle('btn-toggle-pass', 'auth-pass');
    setupToggle('btn-toggle-pass-confirm', 'auth-pass-confirm');

    // Setup UI Toggle State
    let isLoginMode = true;
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const btnAuthMain = document.getElementById('btn-auth-main');
    const authToggleText = document.getElementById('auth-toggle-text');
    const btnToggleAuth = document.getElementById('btn-toggle-auth');
    const passConfirmWrapper = document.getElementById('auth-pass-confirm-wrapper');
    const authMainForm = document.getElementById('auth-main-form');
    const authVerificationPanel = document.getElementById('auth-verification-panel');
    const btnAuthBack = document.getElementById('btn-auth-back');
    const btnForgotPass = document.getElementById('btn-forgot-pass');
    
    // Auth mode state indicator overrides
    const updateVisibility = () => {
        if (btnForgotPass) {
            // Hide forgot password button if we are registering
            btnForgotPass.parentElement.classList.toggle('hidden', !isLoginMode);
        }
    };

    const showMainForm = () => {
        authMainForm.classList.remove('hidden');
        authVerificationPanel.classList.add('hidden');
        authVerificationPanel.classList.remove('flex');
        if (btnAuthBack) {
            btnAuthBack.classList.toggle('hidden', isLoginMode);
        }
    };

    const showVerificationPanelDOM = () => {
        authMainForm.classList.add('hidden');
        authVerificationPanel.classList.remove('hidden');
        authVerificationPanel.classList.add('flex');
        authTitle.textContent = "Verificación Pendiente";
        authSubtitle.textContent = "Casi listo para empezar.";
        if (btnAuthBack) btnAuthBack.classList.add('hidden');
    };

    if (btnToggleAuth) {
        btnToggleAuth.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            showMainForm();
            if (isLoginMode) {
                authTitle.textContent = "Study Meter";
                authSubtitle.textContent = "Estudio consciente y sereno.";
                btnAuthMain.textContent = "Entrar";
                authToggleText.textContent = "¿No tienes cuenta?";
                btnToggleAuth.textContent = "Registrar";
                passConfirmWrapper.classList.add('hidden');
                document.getElementById('auth-msg').classList.add('hidden');
            } else {
                authTitle.textContent = "Crear Cuenta";
                authSubtitle.textContent = "Únete para organizar tus metas.";
                btnAuthMain.textContent = "Registrarse";
                authToggleText.textContent = "¿Ya tienes cuenta?";
                btnToggleAuth.textContent = "Ingresar";
                passConfirmWrapper.classList.remove('hidden');
                document.getElementById('auth-msg').classList.add('hidden');
            }
            updateVisibility();
        });
    }

    if (btnAuthBack) {
        btnAuthBack.addEventListener('click', () => {
            if (!isLoginMode && btnToggleAuth) {
                btnToggleAuth.click(); // Re-use toggle logic
            }
        });
    }

    // Google Auth Logic
    const btnGoogleAuth = document.getElementById('btn-google-auth');
    if (btnGoogleAuth) {
        btnGoogleAuth.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                // signInWithPopup usually auto-verifies email because it traces back to Google
                await signInWithPopup(auth, provider);
            } catch (e) {
                if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                    handleAuthError(e.code);
                }
            }
        });
    }

    // Forgot Password Logic
    if (btnForgotPass) {
        btnForgotPass.addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            if (!email) {
                import('./utils.js').then(({showAlert}) => {
                    showAlert("Por favor, ingresa tu correo electrónico para recuperar tu contraseña.", "error");
                });
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) return showAuthError("El formato del correo no es válido.");

            try {
                await sendPasswordResetEmail(auth, email);
                import('./utils.js').then(({showAlert}) => {
                    showAlert(`Correo de recuperación enviado a ${email}. Revisa tu bandeja de entrada o SPAM.`, "success");
                });
                document.getElementById('auth-msg').classList.add('hidden');
            } catch (e) {
                handleAuthError(e.code);
            }
        });
    }

    // Login logic extracted
    const loginAction = async (email, pass) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            handleAuthError(e.code);
        }
    };

    // Register logic extracted
    const registerAction = async (email, pass, passConfirm) => {
        if (pass !== passConfirm) {
            return showAuthError("Las contraseñas no coinciden.");
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return showAuthError("El formato del correo no es válido.");

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            try {
                await sendEmailVerification(userCredential.user);
            } catch (verifErr) {
                console.error("Error crítico al enviar correo:", verifErr);
            }
            // Eliminamos el signOut inmediato. El observador onAuthStateChanged capturará que no está verificado.
        } catch (e) {
            handleAuthError(e.code);
        }
    };

    // Verification Panel Interactions
    const btnVerifyCheck = document.getElementById('btn-verify-check');
    if (btnVerifyCheck) {
        btnVerifyCheck.addEventListener('click', async () => {
            if (auth.currentUser) {
                await auth.currentUser.reload();
                if (auth.currentUser.emailVerified) {
                    setAppUser(auth.currentUser);
                } else {
                    import('./utils.js').then(({showAlert}) => {
                        showAlert("Aún no se ha verificado. Por favor haz clic en el enlace de tu correo.", 'error');
                    });
                }
            }
        });
    }

    const btnResendVerif = document.getElementById('btn-resend-verification');
    if (btnResendVerif) {
        btnResendVerif.addEventListener('click', async () => {
            if (auth.currentUser) {
                try {
                    await sendEmailVerification(auth.currentUser);
                    import('./utils.js').then(({showAlert}) => {
                        showAlert("¡Correo reenviado exitosamente! Revisa tu bandeja.", 'success');
                    });
                } catch (err) {
                    console.error(err);
                    if (err.code === 'auth/too-many-requests') {
                         import('./utils.js').then(({showAlert}) => showAlert("Espera un momento antes de solicitar otro correo.", 'error'));
                    } else {
                         import('./utils.js').then(({showAlert}) => showAlert("Hubo un error al reenviar. Inténtalo más tarde.", 'error'));
                    }
                }
            }
        });
    }

    const btnVerifyLogout = document.getElementById('btn-verify-logout');
    if (btnVerifyLogout) {
        btnVerifyLogout.addEventListener('click', async () => {
            await signOut(auth);
            showMainForm();
        });
    }

    // Main Auth Button
    if (btnAuthMain) {
        btnAuthMain.addEventListener('click', () => {
            const email = document.getElementById('auth-email').value;
            const pass = document.getElementById('auth-pass').value;
            if (!email || !pass) return showAuthError("Por favor, completa todos los campos.");

            if (isLoginMode) {
                loginAction(email, pass);
            } else {
                const passConfirm = document.getElementById('auth-pass-confirm').value;
                if (!passConfirm) return showAuthError("Por favor, confirma tu contraseña.");
                registerAction(email, pass, passConfirm);
            }
        });
    }

    // Enter Key Support
    ['auth-email', 'auth-pass', 'auth-pass-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    btnAuthMain.click();
                }
            });
        }
    });

    // Guest
    document.getElementById('btn-guest').addEventListener('click', () => {
        setAppUser(null);
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
        signOut(auth);
        location.reload();
    });

    // Delete Account
    const btnDelete = document.getElementById('btn-delete-account');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (!currentUser) return;
            import('./utils.js').then(({ showConfirm, showAlert }) => {
                showConfirm(
                    "Eliminar Cuenta",
                    "¿Estás seguro de que quieres eliminar permanentemente tu cuenta y todos tus datos registrados? Esta acción es irreversible y empezarás desde cero.",
                    async () => {
                        try {
                            const uid = currentUser.uid;
                            
                            // Delete Preferences
                            await deleteDoc(doc(db, 'user_preferences', uid));

                            // Delete Sessions
                            const qSessions = query(collection(db, 'study_sessions'), where('uid', '==', uid));
                            const sessionDocs = await getDocs(qSessions);
                            for (const d of sessionDocs.docs) {
                                await deleteDoc(doc(db, 'study_sessions', d.id));
                            }

                            // Delete Goals
                            const qObj = query(collection(db, 'objectives'), where('uid', '==', uid));
                            const objDocs = await getDocs(qObj);
                            for (const d of objDocs.docs) {
                                await deleteDoc(doc(db, 'objectives', d.id));
                            }

                            // Wipe LocalData
                            localStorage.clear();

                            // Destroy Auth Entity
                            await deleteUser(currentUser);
                            
                            // Let the system reload to flush everything
                            location.reload();
                        } catch (err) {
                            console.error("Delete user error", err);
                            if (err.code === 'auth/requires-recent-login') {
                                showAlert("Por razones de seguridad, debes cerrar sesión y volver a entrar antes de eliminar tu cuenta definitivamente.", "error");
                            } else {
                                showAlert("No se pudo eliminar la cuenta. Verifica tu conexión.", "error");
                            }
                        }
                    }
                );
            });
        });
    }

    // Listener (Global Auth State Management)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const creationDate = new Date(user.metadata.creationTime);
            // Umbral de retrocompatibilidad: Cuentas nuevas creadas a partir del 7 de Abril de 2026.
            const enforcementDate = new Date("2026-04-06T00:00:00");

            if (!user.emailVerified && creationDate > enforcementDate) {
                // Cuenta estricta (no verificada)
                document.getElementById('auth-overlay').style.display = 'flex';
                document.getElementById('app-container').style.display = 'none';
                showVerificationPanelDOM();
            } else {
                // Cuenta legacy o cuenta verificada
                setAppUser(user);
            }
        } else {
            // No user is logged in
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
            showMainForm();
        }
    });
};

const setAppUser = (user) => {
    currentUser = user;

    // UI Switch
    document.getElementById('auth-overlay').style.display = 'none';
    const appContainer = document.getElementById('app-container');
    appContainer.style.display = 'flex'; // Ensure flex layout

    // Header Info
    document.getElementById('user-display').textContent = user ? user.email : 'Modo Invitado';

    // Initialize Data (Lists, History, etc.)
    initData(currentUser);
};

const handleAuthError = (code) => {
    console.error("Auth Error Code:", code);
    let msg = "Ocurrió un error inesperado. (" + code + ")";
    
    switch (code) {
        case 'auth/invalid-email':
            msg = "El formato del correo no es válido.";
            break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            msg = "Correo o contraseña incorrectos.";
            break;
        case 'auth/email-already-in-use':
            msg = "Este correo ya está registrado.";
            break;
        case 'auth/weak-password':
            msg = "La contraseña es muy débil (mínimo 6 caracteres).";
            break;
        case 'auth/too-many-requests':
            msg = "Demasiados intentos fallidos. Inténtalo más tarde.";
            break;
        case 'auth/account-exists-with-different-credential':
            msg = "Ya existe una cuenta. Entra usando tu correo y contraseña original.";
            break;
    }
    
    showAuthError(msg);
};

const showAuthError = (msg) => {
    const el = document.getElementById('auth-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    // Simple shake animation trigger
    el.classList.remove('animate-shake');
    void el.offsetWidth; // trigger reflow
    el.classList.add('animate-shake');
};

export const getCurrentUser = () => currentUser;
