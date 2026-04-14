export const startTutorial = () => {
    // Si Shepherd no ha cargado, salir sin error crítico
    if (typeof Shepherd === 'undefined') {
        console.error('Shepherd.js no está cargado.');
        return;
    }

    const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
            classes: 'shadow-xl bg-card border border-theme rounded-2xl p-4 text-sm font-medium text-primary',
            scrollTo: true,
            cancelIcon: {
                enabled: true
            }
        }
    });

    tour.addStep({
        id: 'step-1-tracker',
        text: 'Bienvenido al <b>Cronómetro</b>. Aquí es donde registrarás tus horas de estudio real y descansos. Dale a "Iniciar Estudio" cuando estés listo.',
        attachTo: {
            element: '#btn-start-session',
            on: 'bottom'
        },
        buttons: [
            {
                text: 'Siguiente',
                action: tour.next,
                classes: 'bg-acc-blue text-primary font-bold py-2 px-4 rounded-xl mt-4 w-full shadow-sm'
            }
        ]
    });

    tour.addStep({
        id: 'step-2-goals',
        text: 'En la pestaña <b>Metas</b> podrás trazar objetivos, como horas por día para un examen parcial o proyecto final.',
        attachTo: {
            element: '#tab-goals',
            on: 'bottom'
        },
        buttons: [
            { text: 'Siguiente', action: tour.next, classes: 'bg-acc-blue text-primary font-bold py-2 px-4 rounded-xl mt-4 w-full shadow-sm' }
        ]
    });

    tour.addStep({
        id: 'step-3-analytics',
        text: 'En <b>Analítica</b>, el sistema te mostrará reportes de en qué gastas tu tiempo, materias más estudiadas y tu eficiencia diaria.',
        attachTo: {
            element: '#tab-dashboard',
            on: 'bottom'
        },
        buttons: [
            { text: 'Siguiente', action: tour.next, classes: 'bg-acc-blue text-primary font-bold py-2 px-4 rounded-xl mt-4 w-full shadow-sm' }
        ]
    });

    tour.addStep({
        id: 'step-4-profile',
        text: 'Por último, en tu <b>Perfil</b> podrás gestionar tus colores favoritos, las materias que agregamos antes, métodos de estudio y cerrar sesión.',
        attachTo: {
            element: '#btn-open-profile',
            on: 'left'
        },
        buttons: [
            { text: '¡Todo listo!', action: tour.complete, classes: 'bg-acc-green text-primary font-bold py-2 px-4 rounded-xl mt-4 w-full shadow-sm' }
        ]
    });

    // Nos aseguramos de estar en la vista de inicio
    const navBtn = document.getElementById('tab-tracker');
    if (navBtn) navBtn.click();

    setTimeout(() => {
        tour.start();
    }, 300);
};
