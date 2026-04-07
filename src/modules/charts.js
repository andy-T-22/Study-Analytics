import Chart from 'chart.js/auto';
import { getStyle } from "./utils.js";
import { openSessionDetails } from "../main.js"; // Depends on main for modal opening

let chartInstances = {
    eff: null,
    sub: null,
    int: null,
    timeline: null,
    weekly: null
};

export const updateCharts = () => {
    const data = window.globalSessionCache;
    if (!data) return;

    // Filters
    const filterFunc = getFilterFunction();
    const filteredData = data.filter(filterFunc);

    // Aggregations
    let totalNet = 0;
    let totalGross = 0;
    let subjectMap = {};
    let interruptionMap = {};

    filteredData.forEach(s => {
        totalNet += (s.netDuration || 0);
        totalGross += (s.grossDuration || 0);

        if (!subjectMap[s.subject]) subjectMap[s.subject] = 0;
        subjectMap[s.subject] += (s.netDuration || 0);

        if (s.interruptions) {
            s.interruptions.forEach(i => {
                const r = i.reason || "Otros";
                if (!interruptionMap[r]) interruptionMap[r] = 0;
                interruptionMap[r]++;
            });
        }
    });

    const efficiency = totalGross > 0 ? Math.round((totalNet / totalGross) * 100) : 0;

    // Update Top Analytics
    const hours = Math.floor(totalNet / 3600000);
    const minutes = Math.floor((totalNet % 3600000) / 60000);
    const totalHoursEl = document.getElementById('stat-total-hours');
    if (totalHoursEl) {
        totalHoursEl.textContent = `${hours}h ${minutes}m`;
    }

    let maxSubject = '--';
    let maxSubjectTime = 0;
    for (const sub in subjectMap) {
        if (subjectMap[sub] > maxSubjectTime) {
            maxSubjectTime = subjectMap[sub];
            maxSubject = sub;
        }
    }
    
    const topSubjectEl = document.getElementById('stat-top-subject');
    const topSubjectTimeEl = document.getElementById('stat-top-subject-time');
    
    if (topSubjectEl) {
        topSubjectEl.textContent = maxSubject;
    }
    if (topSubjectTimeEl) {
        if (maxSubjectTime > 0) {
            const sh = Math.floor(maxSubjectTime / 3600000);
            const sm = Math.floor((maxSubjectTime % 3600000) / 60000);
            topSubjectTimeEl.textContent = `${sh}h ${sm}m`;
        } else {
            topSubjectTimeEl.textContent = `0h 0m`;
        }
    }

    renderEfficiencyChart(efficiency);
    renderSubjectsChart(subjectMap);
    renderInterruptionsChart(interruptionMap);
    renderWeeklyChart(filteredData);

    // Toggle Empty State Visibility
    const dashboardSection = document.getElementById('view-dashboard');
    if (filteredData.length === 0) {
        showEmptyState(dashboardSection);
    } else {
        hideEmptyState(dashboardSection);
    }
};

const showEmptyState = (container) => {
    let emptyEl = container.querySelector('.empty-state-overlay');
    if (emptyEl) return;

    emptyEl = document.createElement('div');
    emptyEl.className = 'empty-state-overlay p-12 text-center flex flex-col items-center justify-center space-y-4';
    emptyEl.innerHTML = `
        <div class="w-20 h-20 bg-acc-blue/10 rounded-full flex items-center justify-center text-3xl">🏜️</div>
        <h3 class="text-lg font-bold text-primary">Aún no hay datos para mostrar</h3>
        <p class="text-sm text-secondary max-w-xs mx-auto">No se encontraron sesiones en este periodo. ¡Es un excelente momento para iniciar tu primer bloque de estudio!</p>
        <button onclick="document.getElementById('tab-tracker').click()" class="bg-acc-blue hover:brightness-95 text-primary font-bold px-6 py-2 rounded-xl transition-all shadow-sm">
            Ir al Cronómetro
        </button>
    `;

    // Insert after filters but before charts grid
    const filters = container.querySelector('.flex.flex-col.gap-4');
    filters.after(emptyEl);

    // Hide the grid
    const grid = container.querySelector('.grid');
    if (grid) grid.classList.add('hidden');
};

const hideEmptyState = (container) => {
    const emptyEl = container.querySelector('.empty-state-overlay');
    if (emptyEl) emptyEl.remove();

    const grid = container.querySelector('.grid');
    if (grid) grid.classList.remove('hidden');
};

// --- CHART RENDERS ---

const renderEfficiencyChart = (eff) => {
    const ctx = document.getElementById('chart-efficiency')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.eff) chartInstances.eff.destroy();
    document.getElementById('efficiency-number').textContent = eff + '%';

    chartInstances.eff = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Productivo', 'Interrupciones'],
            datasets: [{
                data: [eff, 100 - eff],
                backgroundColor: [getStyle('--acc-green'), getStyle('--acc-red')],
                borderWidth: 0
            }]
        },
        options: { animation: false, cutout: '80%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};

const renderSubjectsChart = (map) => {
    const ctx = document.getElementById('chart-subjects')?.getContext('2d');
    if (!ctx) return;
    if (chartInstances.sub) chartInstances.sub.destroy();

    const labels = Object.keys(map);
    const hours = Object.values(map).map(m => parseFloat((m / 3600000).toFixed(1))); // ms -> hours

    chartInstances.sub = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Horas', data: hours, backgroundColor: getStyle('--acc-blue'), borderRadius: 6 }]
        },
        options: {
            animation: false,
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: getStyle('--border-color') }, ticks: { color: getStyle('--text-secondary') } },
                x: { grid: { display: false }, ticks: { color: getStyle('--text-secondary') } }
            },
            plugins: { legend: { display: false } }
        }
    });
};

const renderInterruptionsChart = (map) => {
    const ctx = document.getElementById('chart-interruptions')?.getContext('2d');
    if (!ctx) return;
    if (chartInstances.int) chartInstances.int.destroy();

    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);

    chartInstances.int = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: entries.map(e => e[0]),
            datasets: [{ label: 'Cantidad', data: entries.map(e => e[1]), backgroundColor: getStyle('--acc-peach'), borderRadius: 6 }]
        },
        options: {
            animation: false,
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: {
                x: { beginAtZero: true, grid: { color: getStyle('--border-color') }, ticks: { stepSize: 1, color: getStyle('--text-secondary') } },
                y: { grid: { display: false }, ticks: { color: getStyle('--text-primary'), font: { weight: 'bold' } } }
            },
            plugins: { legend: { display: false } }
        }
    });
};

// --- WEEKLY TIMELINE (Previously Heatmap) ---
// --- WEEKLY TIMELINE ---
export const renderWeeklyChart = (data) => {
    const ctx = document.getElementById('chart-weekly')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.weekly) chartInstances.weekly.destroy();

    // Map sesssions to Bars
    const bars = [];
    const colors = [];

    // 1. Calculate Range (Min/Max Hours)
    let minH = 24, maxH = 0;

    if (data.length === 0) {
        minH = 8; maxH = 20;
    } else {
        data.forEach(s => {
            const dStart = new Date(s.startTime);
            const dEnd = new Date(s.endTime);

            // Use simple hours + decimals
            const startH = dStart.getHours() + dStart.getMinutes() / 60;
            let endH = dEnd.getHours() + dEnd.getMinutes() / 60;
            if (endH < startH) endH = 24;

            if (startH < minH) minH = startH;
            if (endH > maxH) maxH = endH;
        });
        minH = Math.max(0, Math.floor(minH) - 1);
        maxH = Math.min(24, Math.ceil(maxH) + 1);
    }

    // Unique Labels to prevent merging
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    data.forEach(s => {
        const d = new Date(s.startTime);

        // Correct Day Index (Mon=0 ... Sun=6)
        let dayIndex = d.getDay() - 1;
        if (dayIndex < 0) dayIndex = 6;

        const yVal = dayLabels[dayIndex];

        const startH = d.getHours() + d.getMinutes() / 60;
        let endD = new Date(s.endTime);
        let endH = endD.getHours() + endD.getMinutes() / 60;

        // Handle overflow (session ending next day) - Visual cap at 24h
        // (A more robust pivot would split the bar, but capping is fine for MVP)
        if (endH < startH) endH = 24.0;

        // Gradient Logic
        const eff = s.efficiency || 0;
        let hue = 0;
        if (eff <= 50) hue = 0; // Red
        else if (eff >= 100) hue = 120; // Green
        else hue = ((eff - 50) / 50) * 120;

        const color = `hsl(${Math.round(hue)}, 85%, 55%)`;

        bars.push({
            x: [startH, endH],
            y: yVal,
            session: s
        });
        colors.push(color);
    });

    chartInstances.weekly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Sesiones',
                data: bars,
                backgroundColor: colors,
                borderRadius: 4,
                barPercentage: 0.6,
                borderSkipped: false
            }]
        },
        options: {
            animation: false,
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    min: minH,
                    max: maxH,
                    grid: { color: getStyle('--border-color') },
                    ticks: {
                        stepSize: 2,
                        callback: (val) => `${val}h`,
                        color: getStyle('--text-secondary')
                    }
                },
                y: {
                    grid: { display: true, color: getStyle('--border-color'), tickLength: 0 },
                    ticks: { color: getStyle('--text-primary'), font: { weight: 'bold' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const s = c.raw.session;
                            const dur = Math.round(s.netDuration / 60000);
                            return `${s.subject}: ${dur} min (${s.efficiency}%)`;
                        }
                    }
                }
            },
            onClick: (e, els) => {
                if (els.length > 0) {
                    const idx = els[0].index;
                    const s = bars[idx].session;
                    if (s) openSessionDetails(s.id);
                }
            }
        }
    });
};


// --- TIMELINE ---
export const renderTimeline = (session) => {
    const ctx = document.getElementById('chart-timeline')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.timeline) chartInstances.timeline.destroy();

    const startTime = session.startTime;
    const endTime = session.endTime;
    const interruptions = session.interruptions || [];

    // Sort interruptions just in case
    interruptions.sort((a, b) => a.start - b.start);

    const studySegments = [];
    const pauseSegments = [];

    let cursor = startTime;

    interruptions.forEach(int => {
        // Study segment before this pause
        if (int.start > cursor) {
            studySegments.push([cursor, int.start]);
        }
        // Pause segment
        // Ensure pause has duration
        let pEnd = int.end;
        if (!pEnd && int.duration) pEnd = int.start + int.duration;
        if (!pEnd) pEnd = cursor; // Fallback

        // Store data with reason for tooltip
        pauseSegments.push({
            x: [int.start, pEnd],
            y: 'Línea de Tiempo',
            reason: int.reason || 'Pausa'
        });

        cursor = pEnd;
    });

    // Final study segment
    if (endTime > cursor) {
        studySegments.push([cursor, endTime]);
    }

    // Prepare Datasets
    // We use floating bars: data format for x is [start, end]

    const dsStudy = {
        label: 'Estudio',
        data: studySegments.map(s => ({ x: s, y: 'Línea de Tiempo' })),
        backgroundColor: getStyle('--acc-green'),
        borderRadius: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0
    };

    const dsPause = {
        label: 'Pausa',
        data: pauseSegments, // Objects {x:[], y, reason}
        backgroundColor: getStyle('--acc-red'),
        borderRadius: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0
    };

    chartInstances.timeline = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Línea de Tiempo'],
            datasets: [dsStudy, dsPause]
        },
        options: {
            animation: false,
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: false, // Don't stack time values
                    type: 'linear',
                    min: startTime,
                    max: endTime,
                    grid: { color: getStyle('--border-color') },
                    ticks: {
                        color: getStyle('--text-secondary'),
                        callback: (val) => {
                            const d = new Date(val);
                            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 6
                    }
                },
                y: {
                    stacked: true, // Stack on the category axis to share the row
                    display: false
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { color: getStyle('--text-primary'), font: { size: 10 } }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const showReason = ctx.raw.reason ? ` (${ctx.raw.reason})` : '';
                            const d = ctx.raw.x || ctx.raw; // handle object or array
                            const start = d[0];
                            const end = d[1];
                            const durMin = Math.round((end - start) / 60000);
                            return `${ctx.dataset.label}${showReason}: ${durMin} min`;
                        }
                    }
                }
            }
        }
    });
};


// --- HISTORY TABLE & FILTERS ---
// Logic moved here as it is "View" logic heavily tied to data

const getFilterFunction = () => {
    const periodVal = document.getElementById(`global-filter-period`)?.value || 'week';
    const subVal = document.getElementById(`global-filter-subject`)?.value;

    const sEl = document.getElementById('global-start');
    const eEl = document.getElementById('global-end');

    const now = Date.now();
    const oneDay = 86400000;

    return (session) => {
        // Period
        let pMatch = true;
        if (periodVal === 'custom') {
            if (sEl && sEl.value) {
                if (session.startTime < new Date(sEl.value).getTime()) pMatch = false;
            }
            if (eEl && eEl.value) {
                if (session.startTime > new Date(eEl.value).setHours(23, 59, 59, 999)) pMatch = false;
            }
        } else if (periodVal === 'today') {
            pMatch = (now - session.startTime) < oneDay;
        } else if (periodVal === 'week') {
            pMatch = (now - session.startTime) < (7 * oneDay); // 7 days
        } else if (periodVal === 'month') {
            pMatch = (now - session.startTime) < (30 * oneDay);
        }

        // Subject
        let sMatch = true;
        if (subVal && subVal !== 'all') sMatch = session.subject === subVal;

        return pMatch && sMatch;
    };
};

export const applyHistoryFilters = () => {
    const data = window.globalSessionCache;
    if (!data) return;

    const filter = getFilterFunction();
    const filtered = data.filter(filter);

    // Sort Desc
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    renderHistoryList(filtered);
};

// --- HISTORY PAGINATION ---
let historyLimit = 10;
const HISTORY_PAGE_SIZE = 10;

export const resetHistoryLimit = () => {
    historyLimit = HISTORY_PAGE_SIZE;
};

export const loadMoreHistory = () => {
    historyLimit += HISTORY_PAGE_SIZE;
    applyHistoryFilters(); // Re-render with new limit
};

export const renderHistoryList = (listData) => {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    // Remove existing 'Load More' button if any (it's usually outside tbody, but let's be safe)
    const existingBtn = document.getElementById('btn-load-more-history');
    if (existingBtn) existingBtn.remove();

    if (listData.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="p-8 text-center italic text-secondary">No se encontraron sesiones.</td></tr>';
        return;
    }

    // Slice Data
    const visibleData = listData.slice(0, historyLimit);

    visibleData.forEach((d, index) => {
        const dateStr = new Date(d.startTime).toLocaleDateString();
        const mins = Math.floor(d.netDuration / 60000);

        const tr = document.createElement('tr');
        tr.className = "cursor-pointer hover:brightness-95 transition-all border-b border-theme last:border-0 group bg-card animate-row-fade";
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.onclick = () => openSessionDetails(d.id);

        tr.innerHTML = `
            <td class="p-5 text-primary group-hover:pl-6 transition-all duration-300">
                    <div class="font-bold">${dateStr}</div>
                    <div class="text-[10px] text-secondary">${new Date(d.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td class="p-5"><span class="bg-acc-lavender text-primary px-2 py-1 rounded text-xs font-bold uppercase">${d.subject}</span></td>
            <td class="p-5 font-mono text-secondary">${mins} min</td>
            <td class="p-5 text-right ${d.efficiency < 50 ? 'text-acc-red-dark' : 'text-acc-green-dark'} font-bold text-lg">${d.efficiency}%</td>
        `;
        list.appendChild(tr);
    });

    // Render 'Show More' if needed
    if (listData.length > historyLimit) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="5" class="p-4 text-center">
                <button id="btn-show-more-hist" 
                    class="text-xs font-bold text-secondary hover:text-primary transition-colors uppercase tracking-widest">
                    Mostrar Más <i class="fas fa-chevron-down ml-1"></i>
                </button>
            </td>
        `;
        list.appendChild(row);

        setTimeout(() => {
            const btn = document.getElementById('btn-show-more-hist');
            if (btn) btn.onclick = (e) => {
                e.stopPropagation();
                loadMoreHistory();
            };
        }, 0);
    }
};
