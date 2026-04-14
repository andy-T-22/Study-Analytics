const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// The new Profile Section HTML to inject
const newProfileHtml = `
    <!-- MODAL: PROFILE -->
    <div id="modal-profile" class="fixed inset-0 z-50 bg-main flex flex-col md:flex-row hidden animate-in slide-in-from-bottom-5">
        <!-- Sidebar Navigation -->
        <div class="w-full md:w-64 border-b md:border-b-0 md:border-r border-theme bg-card/30 flex flex-col pt-4 md:pt-8 md:px-0">
            <!-- Mobile Close Button (Header on mobile) -->
            <div class="md:hidden flex justify-between items-center px-4 mb-4">
                <h2 class="text-xl font-bold text-primary">Mi Perfil</h2>
                <button id="btn-close-profile-mobile" class="text-secondary hover:text-primary">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="flex md:flex-col overflow-x-auto hide-scrollbar px-2 md:px-4 md:space-y-1 gap-2 md:gap-0 pb-2 md:pb-0">
                <button data-profile-tab="overview" class="flex-shrink-0 md:w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm bg-theme text-primary transition-colors flex items-center gap-2">
                    <i class="fas fa-user text-acc-blue w-5"></i> Resumen
                </button>
                <button data-profile-tab="appearance" class="flex-shrink-0 md:w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-secondary hover:bg-theme/50 hover:text-primary transition-colors flex items-center gap-2">
                    <i class="fas fa-paint-brush text-acc-peach w-5"></i> Apariencia
                </button>
                <button data-profile-tab="study" class="flex-shrink-0 md:w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-secondary hover:bg-theme/50 hover:text-primary transition-colors flex items-center gap-2">
                    <i class="fas fa-clock text-green-500 w-5"></i> Estudio
                </button>
                <button data-profile-tab="organize" class="flex-shrink-0 md:w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-secondary hover:bg-theme/50 hover:text-primary transition-colors flex items-center gap-2">
                    <i class="fas fa-book text-orange-400 w-5"></i> Organización
                </button>
                <button data-profile-tab="account" class="flex-shrink-0 md:w-full text-left px-4 py-2.5 rounded-lg font-bold text-sm text-secondary hover:bg-theme/50 hover:text-primary transition-colors flex items-center gap-2">
                    <i class="fas fa-shield-alt text-acc-red w-5"></i> Cuenta
                </button>
            </div>
            
            <div class="hidden md:block mt-auto p-4 border-t border-theme">
                <button id="btn-close-profile-desktop" class="w-full py-2.5 bg-btn-secondary hover:bg-btn-secondary-hover text-primary font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-arrow-left"></i> Volver a Estudiar
                </button>
            </div>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto p-4 md:p-10 relative bg-main hide-scrollbar">
            <!-- TAB: OVERVIEW -->
            <div id="profile-tab-overview" class="profile-content max-w-3xl mx-auto space-y-8 fade-in">
                <div class="flex items-center gap-6 p-6 md:p-8 bg-card border border-theme rounded-3xl shadow-sm">
                    <div id="overview-avatar" class="h-20 w-20 md:h-24 md:w-24 rounded-full bg-acc-blue text-primary flex items-center justify-center text-4xl font-bold font-mono shadow-inner border border-theme uppercase">U</div>
                    <div>
                        <h2 id="overview-name" class="text-2xl font-black text-primary mb-1">Cargando...</h2>
                        <span id="overview-level" class="text-acc-blue font-bold text-sm flex items-center gap-1.5"><i class="fas fa-star"></i> Estudiante Activo</span>
                    </div>
                </div>

                <h3 class="text-lg font-bold text-primary px-2">Tus Estadísticas</h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-card p-5 rounded-2xl border border-theme shadow-sm flex flex-col items-center justify-center text-center">
                        <i class="fas fa-hourglass-half text-acc-peach text-2xl mb-2"></i>
                        <span class="text-3xl font-black text-primary font-mono" id="stat-total-hours">0h</span>
                        <span class="text-xs text-secondary font-bold uppercase mt-1">Tiempo Total</span>
                    </div>
                    <div class="bg-card p-5 rounded-2xl border border-theme shadow-sm flex flex-col items-center justify-center text-center">
                        <i class="fas fa-bolt text-acc-blue text-2xl mb-2"></i>
                        <span class="text-3xl font-black text-primary font-mono" id="stat-efficiency">0%</span>
                        <span class="text-xs text-secondary font-bold uppercase mt-1">Eficiencia Global</span>
                    </div>
                    <div class="bg-card p-5 rounded-2xl border border-theme shadow-sm flex flex-col items-center justify-center text-center">
                        <i class="fas fa-fire text-orange-500 text-2xl mb-2"></i>
                        <span class="text-3xl font-black text-primary font-mono" id="stat-max-streak">0</span>
                        <span class="text-xs text-secondary font-bold uppercase mt-1">Mejor Racha</span>
                    </div>
                </div>
            </div>

            <!-- TAB: APPEARANCE -->
            <div id="profile-tab-appearance" class="profile-content max-w-3xl mx-auto space-y-8 hidden fade-in">
                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-primary mb-6">Tema de Colores</h3>
                    <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3" id="theme-grid">
                        <button data-theme-btn="pastel" class="w-12 h-12 rounded-lg bg-[#fcfbf7] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Pastel"></button>
                        <button data-theme-btn="white" class="w-12 h-12 rounded-lg bg-[#ffffff] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Blanco"></button>
                        <button data-theme-btn="dark" class="w-12 h-12 rounded-lg bg-[#2d2d2d] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Oscuro"></button>
                        <button data-theme-btn="forest" class="w-12 h-12 rounded-lg bg-[#1c2321] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Bosque"></button>
                        <button data-theme-btn="ocean" class="w-12 h-12 rounded-lg bg-[#0f172a] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Océano"></button>
                        <button data-theme-btn="sunset" class="w-12 h-12 rounded-lg bg-[#2a1b2e] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Atardecer"></button>
                        <button data-theme-btn="mint" class="w-12 h-12 rounded-lg bg-[#f0fdf4] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Menta"></button>
                        <button data-theme-btn="rose" class="w-12 h-12 rounded-lg bg-[#fff1f2] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Rosa"></button>
                        <button data-theme-btn="amber" class="w-12 h-12 rounded-lg bg-[#fffbeb] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Ámbar"></button>
                        <button data-theme-btn="midnight" class="w-12 h-12 rounded-lg bg-[#0c0a09] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Medianoche"></button>
                        <button data-theme-btn="emerald" class="w-12 h-12 rounded-lg bg-[#064e3b] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Esmeralda"></button>
                        <button data-theme-btn="lavender" class="w-12 h-12 rounded-lg bg-[#faf5ff] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Lavanda"></button>
                        <button data-theme-btn="coffee" class="w-12 h-12 rounded-lg bg-[#292524] border-2 border-theme transform hover:scale-110 transition-transform shadow-sm" title="Café"></button>
                    </div>
                </div>

                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm mt-6">
                    <h3 class="text-lg font-bold text-primary mb-6">Opciones Visuales y Auditivas</h3>
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-primary font-bold block">Sonido al Completar</span>
                                <span class="text-xs text-secondary mt-1 block">Reproducir una suave campana al terminar.</span>
                            </div>
                            <button id="btn-toggle-sound" class="w-12 h-6 bg-gray-300 rounded-full relative transition-colors duration-300">
                                <div class="w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300"></div>
                            </button>
                        </div>
                        <hr class="border-theme">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-primary font-bold block">Mostrar Segundos</span>
                                <span class="text-xs text-secondary mt-1 block">Ver los segundos en el reloj principal.</span>
                            </div>
                            <button id="btn-toggle-seconds" class="w-12 h-6 bg-gray-300 rounded-full relative transition-colors duration-300">
                                <div class="w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300"></div>
                            </button>
                        </div>
                        <hr class="border-theme">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-primary font-bold block">Animar Título de Pestaña</span>
                                <span class="text-xs text-secondary mt-1 block">El reloj se actualiza en el icono de la web.</span>
                            </div>
                            <button id="btn-toggle-favicon" class="w-12 h-6 bg-gray-300 rounded-full relative transition-colors duration-300">
                                <div class="w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TAB: STUDY / TIMER -->
            <div id="profile-tab-study" class="profile-content max-w-3xl mx-auto space-y-8 hidden fade-in">
                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-primary mb-6">Duraciones del Reloj (Minutos)</h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div>
                            <label class="text-xs font-bold text-secondary uppercase block mb-2">Estudio</label>
                            <input type="number" id="cfg-time-study" class="w-full bg-main border border-theme rounded-xl p-3 text-primary text-center font-bold outline-none focus:border-acc-blue" value="25" min="1" max="120">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-secondary uppercase block mb-2">Pausa Corta</label>
                            <input type="number" id="cfg-time-short" class="w-full bg-main border border-theme rounded-xl p-3 text-primary text-center font-bold outline-none focus:border-green-500" value="5" min="1" max="60">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-secondary uppercase block mb-2">Pausa Larga</label>
                            <input type="number" id="cfg-time-long" class="w-full bg-main border border-theme rounded-xl p-3 text-primary text-center font-bold outline-none focus:border-purple-500" value="15" min="1" max="60">
                        </div>
                        <div>
                            <label class="text-xs font-bold text-secondary uppercase block mb-2">Ciclos p/ Larga</label>
                            <input type="number" id="cfg-cycles" class="w-full bg-main border border-theme rounded-xl p-3 text-primary text-center font-bold outline-none focus:border-acc-red" value="4" min="1" max="10">
                        </div>
                    </div>
                    <button id="btn-save-durations" class="w-full bg-acc-blue hover:brightness-95 text-primary font-bold py-3 rounded-xl transition-colors shadow-sm">Guardar Tiempos</button>
                </div>

                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-primary mb-6">Automatización</h3>
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-primary font-bold block">Auto-iniciar Descansos</span>
                                <span class="text-xs text-secondary mt-1 block">El descanso inicia automáticamente al culminar el bloque de estudio.</span>
                            </div>
                            <button id="btn-toggle-auto-break" class="w-12 h-6 bg-gray-300 rounded-full relative transition-colors duration-300">
                                <div class="w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300"></div>
                            </button>
                        </div>
                        <hr class="border-theme">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="text-primary font-bold block">Auto-iniciar Estudio</span>
                                <span class="text-xs text-secondary mt-1 block">El estudio inicia automáticamente al concluir el descanso.</span>
                            </div>
                            <button id="btn-toggle-auto-study" class="w-12 h-6 bg-gray-300 rounded-full relative transition-colors duration-300">
                                <div class="w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform duration-300"></div>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-primary mb-6">Objetivo Diario Base</h3>
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <span class="text-primary font-bold block">Horas de Estudio Diarias</span>
                            <span class="text-xs text-secondary mt-1 block">Configura el tiempo objetivo general para tus días.</span>
                        </div>
                        <input type="number" id="cfg-daily-goal-hours" class="w-24 bg-main border border-theme rounded-xl p-3 text-primary text-center font-bold outline-none focus:border-acc-blue" value="4" min="1" max="24" step="0.5">
                    </div>
                </div>
            </div>

            <!-- TAB: ORGANIZE -->
            <div id="profile-tab-organize" class="profile-content max-w-3xl mx-auto space-y-6 hidden fade-in">
                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-primary">Gestionar Materias</h3>
                        <p class="text-xs text-secondary mt-1 max-w-[200px] md:max-w-full">Anade o elimina etiquetas para tus sesiones.</p>
                    </div>
                    <button class="btn-manage-subjects bg-acc-blue/10 border border-acc-blue hover:bg-acc-blue text-acc-blue hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap">Abrir Gestor</button>
                </div>
                
                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-primary">Gestionar Distracciones</h3>
                        <p class="text-xs text-secondary mt-1 max-w-[200px] md:max-w-full">Administra los motivos usuales de pausa.</p>
                    </div>
                    <button class="btn-manage-reasons bg-orange-500/10 border border-orange-500 hover:bg-orange-500 text-orange-500 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap">Abrir Gestor</button>
                </div>
            </div>

            <!-- TAB: ACCOUNT -->
            <div id="profile-tab-account" class="profile-content max-w-3xl mx-auto space-y-6 hidden fade-in">
                
                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-primary mb-6">Tus Datos</h3>
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-theme rounded-xl bg-main">
                        <div>
                            <span class="text-primary font-bold block">Historial Completo CSV</span>
                            <span class="text-xs text-secondary block mt-1">Exporta un archivo analizable con todas tus métricas registradas.</span>
                        </div>
                        <button id="btn-export-csv" class="w-full sm:w-auto bg-card border border-theme hover:bg-theme text-primary px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2">
                            <i class="fas fa-file-csv"></i> Descargar CSV
                        </button>
                    </div>
                </div>

                <div class="bg-card p-6 rounded-3xl border border-theme shadow-sm">
                    <h3 class="text-lg font-bold text-acc-red mb-6">Zona de Peligro</h3>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-4 border border-acc-red/30 rounded-xl bg-acc-red/5">
                            <div>
                                <span class="text-primary font-bold block">Borrar todo el Historial</span>
                                <span class="text-xs text-secondary block mt-1 max-w-[200px] md:max-w-full">Eliminará todas tus sesiones estadísticas.</span>
                            </div>
                            <button id="btn-clear-history-only" class="bg-acc-red/10 border border-acc-red hover:bg-acc-red text-acc-red hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap">
                                Borrar Datos
                            </button>
                        </div>
                        
                        <div class="flex items-center justify-between p-4 border border-acc-red/30 rounded-xl bg-acc-red/5">
                            <div>
                                <span class="text-primary font-bold block">Eliminar Cuenta de Usuario</span>
                                <span class="text-xs text-secondary block mt-1 max-w-[200px] md:max-w-full">Borrar cuenta e historial permanentemente.</span>
                            </div>
                            <button id="btn-delete-account" class="bg-acc-red/10 border border-acc-red hover:bg-acc-red text-acc-red hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm whitespace-nowrap">
                                Borrar Cuenta
                            </button>
                        </div>
                    </div>
                </div>

                <div class="pt-4 flex justify-center">
                     <button id="btn-logout-profile" class="text-secondary hover:text-acc-red font-bold text-sm px-6 py-3 rounded-xl transition-colors border border-transparent hover:bg-acc-red/10 flex items-center gap-2">
                         <i class="fas fa-sign-out-alt"></i> Cerrar Sesión Segura
                     </button>
                </div>
            </div>
        </div>
    </div>
`;

const startStr = '<!-- MODAL: SETTINGS -->';
const endStr = '<!-- MODAL: MANAGER (Subjects / Methods) -->';

const startIndex = html.indexOf(startStr);
const endIndex = html.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const newHtml = html.substring(0, startIndex) + newProfileHtml + '\n\n    ' + html.substring(endIndex);
    fs.writeFileSync('index.html', newHtml);
    console.log('Replaced successfully');
} else {
    console.log('Could not find boundaries');
}
