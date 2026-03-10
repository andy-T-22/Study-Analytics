/**
 * Toast Notification System
 * Study Meter - Visual Polish Phase 1
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.queue = [];
        this.createContainer();
    }

    createContainer() {
        if (this.container) return;
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 4000) {
        const toast = document.createElement('div');
        
        // Base classes
        let bgClass = 'bg-card';
        let iconClass = 'fa-info-circle text-acc-blue-dark';
        
        if (type === 'success') {
            bgClass = 'bg-acc-green/20 border-acc-green-dark/30';
            iconClass = 'fa-check-circle text-acc-green-dark';
        } else if (type === 'error') {
            bgClass = 'bg-acc-red/20 border-acc-red-dark/30';
            iconClass = 'fa-exclamation-circle text-acc-red-dark';
        }

        toast.className = `
            pointer-events-auto min-w-[300px] max-w-md p-4 rounded-2xl shadow-xl 
            border border-theme backdrop-blur-md animate-slide-in-right
            flex items-center gap-4 ${bgClass}
        `;

        toast.innerHTML = `
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-white/50 flex items-center justify-center">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="flex-grow">
                <p class="text-sm font-bold text-primary">${message}</p>
            </div>
            <button class="text-secondary hover:text-primary transition-colors p-1">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Close button logic
        const closeBtn = toast.querySelector('button');
        const removeToast = () => {
            toast.classList.replace('animate-slide-in-right', 'animate-fade-out');
            setTimeout(() => toast.remove(), 300);
        };
        closeBtn.onclick = removeToast;

        // Auto-remove
        const timeout = setTimeout(removeToast, duration);
        toast.onmouseenter = () => clearTimeout(timeout);
        toast.onmouseleave = () => setTimeout(removeToast, duration);

        this.container.appendChild(toast);
    }
}

export const toast = new ToastManager();
