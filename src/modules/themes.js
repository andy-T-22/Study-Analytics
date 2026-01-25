import { updateCharts } from "./charts.js";

const themes = [
    'pastel', 'white', 'dark', 'forest', 'ocean', 'sunset',
    'mint', 'rose', 'amber', 'midnight', 'emerald', 'lavender', 'coffee'
];

export const initThemes = () => {
    const savedTheme = localStorage.getItem('app_theme') || 'pastel';
    setTheme(savedTheme);

    // Bind DOM buttons
    const container = document.getElementById('theme-grid');
    if (!container) return; // Maybe not waiting for DOM?

    // Add click listeners to buttons (Assuming HTML structure is there)
    document.querySelectorAll('[data-theme-btn]').forEach(btn => {
        btn.onclick = () => setTheme(btn.getAttribute('data-theme-btn'));
    });
};

export const setTheme = (themeName) => {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('app_theme', themeName);

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
            updateCharts();
        });
    });
};
