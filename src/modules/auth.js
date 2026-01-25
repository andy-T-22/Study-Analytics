import { auth } from "../services/firebaseConfig.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { initData, loadHistory } from "./data.js";

let currentUser = null;

export const initAuth = () => {
    // Login
    document.getElementById('btn-login').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            showAuthError(e.message);
        }
    });

    // Register
    document.getElementById('btn-register').addEventListener('click', async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            showAuthError(e.message);
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

const showAuthError = (msg) => {
    const el = document.getElementById('auth-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
};

export const getCurrentUser = () => currentUser;
