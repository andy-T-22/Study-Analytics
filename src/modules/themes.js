import { updateCharts } from "./charts.js";
import { db } from "../services/firebaseConfig.js";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const themes = [
    'pastel', 'white', 'dark', 'forest', 'ocean', 'sunset',
    'mint', 'rose', 'amber', 'midnight', 'emerald', 'lavender', 'coffee'
];

const DEFAULT_THEME = 'pastel';
const LOGIN_THEME = 'pastel'; // Tema fijo para el login

// Controla si se debe aplicar el tema o no
const isAuthOverlayVisible = () => {
    const authOverlay = document.getElementById('auth-overlay');
    return authOverlay && authOverlay.style.display !== 'none';
};

export const initThemes = async () => {
    // Solo aplicar tema guardado si NO estamos en la pantalla de login
    if (!isAuthOverlayVisible()) {
        const savedTheme = localStorage.getItem('app_theme') || DEFAULT_THEME;
        applyTheme(savedTheme);
    } else {
        // En login, usar tema por defecto
        applyTheme(LOGIN_THEME);
    }

    // Siempre ligar los botones de tema, aunque estemos en login
    // Los clicks solo funcionarán cuando no estemos en login
    const container = document.getElementById('theme-grid');
    if (!container) return;

    // Importar dinámicamente para evitar dependencia circular
    const { getCurrentUser } = await import('./auth.js');

    // Add click listeners to buttons
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.onclick = () => {
            const themeName = btn.getAttribute('data-theme-btn');
            const user = getCurrentUser();
            setTheme(themeName, user);
        };
    });
};

export const setTheme = (themeName, user = null) => {
    // No aplicar temas mientras se está en el login
    if (isAuthOverlayVisible()) {
        return;
    }

    applyTheme(themeName);
    localStorage.setItem('app_theme', themeName);

    // Guardar en Firestore si el usuario está autenticado
    if (user && user.uid) {
        saveThemeToFirestore(themeName, user.uid).catch(err => {
            console.warn("No se pudo guardar el tema en Firestore:", err);
        });
    }
};

// Función interna para aplicar el tema visualmente
const applyTheme = (themeName) => {
    document.body.setAttribute('data-theme', themeName);

    // Update active state
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        const btnTheme = btn.getAttribute('data-theme-btn');
        if (btnTheme === themeName) {
            btn.classList.add('ring-2', 'ring-acc-blue-dark', 'ring-offset-2');
        } else {
            btn.classList.remove('ring-2', 'ring-acc-blue-dark', 'ring-offset-2');
        }
    });

    // Notify charts to update colors with a slight delay for CSS var propagation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Update Android/Browser status bar color
            const bgMain = getComputedStyle(document.body).getPropertyValue('--bg-main').trim();
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor && bgMain) {
                metaThemeColor.setAttribute('content', bgMain);
            }

            updateCharts();
        });
    });
};

// Guardar tema en Firestore
export const saveThemeToFirestore = async (themeName, uid) => {
    try {
        const docRef = doc(db, 'user_preferences', uid);
        await updateDoc(docRef, { 
            theme: themeName 
        });
    } catch (err) {
        console.error("Error guardando tema:", err);
        throw err;
    }
};

// Cargar tema desde Firestore
export const loadThemeFromFirestore = async (uid) => {
    try {
        const docRef = doc(db, 'user_preferences', uid);
        const snap = await getDoc(docRef);
        
        if (snap.exists() && snap.data().theme) {
            return snap.data().theme;
        }
        return DEFAULT_THEME;
    } catch (err) {
        console.error("Error cargando tema:", err);
        return DEFAULT_THEME;
    }
};
