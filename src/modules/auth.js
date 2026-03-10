import { auth } from "../services/firebaseConfig.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { initData, loadHistory } from "./data.js";

let currentUser = null;

export const initAuth = () => {
    // Login
    const loginAction = async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return showAuthError("Por favor, completa todos los campos.");
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            handleAuthError(e.code);
        }
    };

    document.getElementById('btn-login').addEventListener('click', loginAction);

    // Enter Key Support
    ['auth-email', 'auth-pass'].forEach(id => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loginAction();
        });
    });

    // Register
    document.getElementById('btn-register').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        if (!email || !pass) return showAuthError("Por favor, completa todos los campos.");
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            handleAuthError(e.code);
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

    // Listener
    onAuthStateChanged(auth, (user) => {
        if (user) setAppUser(user);
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
    let msg = "Ocurrió un error inesperado.";
    
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
