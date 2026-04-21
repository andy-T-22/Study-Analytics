import { auth, db } from "../services/firebaseConfig.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, deleteUser, updatePassword, updateProfile } from "firebase/auth";
import { doc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { initData, loadHistory } from "./data.js";
import { loadThemeFromFirestore, setTheme } from "./themes.js";

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
        if (btnAuthBack) btnAuthBack.classList.add('hidden');
    };

    if (btnToggleAuth) {
        btnToggleAuth.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            showMainForm();
            if (isLoginMode) {
                authTitle.textContent = "Study Meter";
                btnAuthMain.textContent = "Iniciar Sesión";
                authToggleText.textContent = "¿No tienes cuenta?";
                btnToggleAuth.textContent = "Registrar";
                passConfirmWrapper.classList.add('hidden');
                document.getElementById('auth-msg').classList.add('hidden');
            } else {
                authTitle.textContent = "Crear Cuenta";
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
            const emailInput = document.getElementById('auth-email');
            const email = emailInput.value.trim();
            if (!email) {
                // Highlight email input visually
                emailInput.classList.remove('border-theme', 'focus:border-[#a5ccf5]');
                emailInput.classList.add('border-acc-red-dark', 'focus:border-acc-red-dark', 'animate-shake');
                
                showAuthError("Este campo es obligatorio para recuperar tu contraseña.");
                
                // Remove highlight when typing
                const removeError = () => {
                    emailInput.classList.remove('border-acc-red-dark', 'focus:border-acc-red-dark', 'animate-shake');
                    emailInput.classList.add('border-theme', 'focus:border-[#a5ccf5]');
                    document.getElementById('auth-msg').classList.add('hidden');
                    emailInput.removeEventListener('input', removeError);
                };
                emailInput.addEventListener('input', removeError);
                
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) return showAuthError("El formato del correo no es válido.");

            try {
                await sendPasswordResetEmail(auth, email);
                
                document.getElementById('auth-msg').classList.add('hidden');
                
                // Show Custom Modal
                const resetModal = document.getElementById('reset-success-modal');
                if (resetModal) {
                    resetModal.classList.remove('hidden');
                    resetModal.classList.add('flex');
                    
                    const closeModal = () => {
                        resetModal.classList.add('hidden');
                        resetModal.classList.remove('flex');
                    };
                    
                    const btnClose = document.getElementById('btn-close-reset-modal');
                    const btnOk = document.getElementById('btn-ok-reset-modal');
                    
                    if (btnClose) btnClose.onclick = closeModal;
                    if (btnOk) btnOk.onclick = closeModal;
                }
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
                    await setAppUser(auth.currentUser);
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
    const btnLogoutProfile = document.getElementById('btn-logout-profile');
    if (btnLogoutProfile) {
        btnLogoutProfile.addEventListener('click', () => {
            signOut(auth);
            localStorage.removeItem('app_theme');
            location.reload();
        });
    }

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
                await setAppUser(user);
            }
        } else {
            // No user is logged in
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
            showMainForm();
        }
    });
};

const setAppUser = async (user) => {
    currentUser = user;

    // UI Switch
    document.getElementById('auth-overlay').style.display = 'none';
    const appContainer = document.getElementById('app-container');
    appContainer.style.display = 'flex'; // Ensure flex layout

    const displayName = user ? (user.displayName || user.email.split('@')[0]) : 'Invitado';
    const initial = displayName.charAt(0).toUpperCase();

    // Header Info
    document.getElementById('user-display').textContent = displayName;
    
    // Header Avatar
    const profileAvatar = document.getElementById('profile-avatar');
    if (profileAvatar) profileAvatar.textContent = initial;

    // Inside Profile Modal
    const overviewName = document.getElementById('overview-name');
    if (overviewName) overviewName.textContent = displayName;
    
    const overviewAvatar = document.getElementById('overview-avatar');
    if (overviewAvatar) overviewAvatar.textContent = initial;

    // Initialize Data (Lists, History, etc.)
    initData(currentUser);

    // Cargar tema del usuario desde Firestore
    if (user && user.uid) {
        try {
            const userTheme = await loadThemeFromFirestore(user.uid);
            setTheme(userTheme, user);
        } catch (err) {
            console.warn("No se pudo cargar el tema del usuario:", err);
        }
    }
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

export const updateUserName = async (newName) => {
    if (!currentUser) return;
    return updateProfile(currentUser, { displayName: newName })
        .then(() => {
            // Update UI elements silently without fully reloading
            const headerDisplay = document.getElementById('user-display');
            if (headerDisplay) headerDisplay.textContent = newName;
            const profileAvatar = document.getElementById('profile-avatar');
            const overviewAvatar = document.getElementById('overview-avatar');
            const initial = newName.charAt(0).toUpperCase();
            if (profileAvatar) profileAvatar.textContent = initial;
            if (overviewAvatar) overviewAvatar.textContent = initial;
        });
};

export const updateUserPassword = async (newPassword) => {
    if (!currentUser) throw new Error("No user logged in.");
    return updatePassword(currentUser, newPassword);
};
