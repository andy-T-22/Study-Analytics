import './style.css';
import Chart from 'chart.js/auto';
import './modules/favicon.js';
import { auth } from './services/firebaseConfig.js';
import { onAuthStateChanged } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', () => {
    // Redirección silenciosa si ya hay sesión iniciada
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.replace('/app.html');
        } else {
            // Mostrar la landing page
            document.body.classList.remove('opacity-0');
        }
    });

    // Render mock chart for landing page
    const ctx = document.getElementById('landing-mock-chart')?.getContext('2d');
    if (ctx) {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mat', 'Alg', 'Fís', 'Quím', 'Bio'],
                datasets: [{
                    label: 'Horas Totales',
                    data: [12, 8, 15, 6, 4],
                    backgroundColor: ['#a5ccf5', '#dcd3ff', '#a5f5c3', '#ffdfba', '#f5a5c0'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 2000, easing: 'easeOutQuart' },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#e6e2d8', drawBorder: false }, ticks: { color: '#8a8175', stepSize: 5 } },
                    x: { grid: { display: false }, ticks: { color: '#8a8175', font: { weight: 'bold' } } }
                },
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        });
    }
});
