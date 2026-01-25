import Chart from 'chart.js/auto';
import { getStyle } from "./utils.js";
import { openSessionDetails } from "../main.js"; // Depends on main for modal opening

let chartInstances = {
    eff: null,
    sub: null,
    int: null
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

    renderEfficiencyChart(efficiency);
    renderSubjectsChart(subjectMap);
    renderInterruptionsChart(interruptionMap);
    renderHeatmap(filteredData);
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
        options: { cutout: '80%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
};

const renderSubjectsChart = (map) => {
    const ctx = document.getElementById('chart-subjects')?.getContext('2d');
    if (!ctx) return;
    if (chartInstances.sub) chartInstances.sub.destroy();

    const labels = Object.keys(map);
    const mins = Object.values(map).map(m => Math.floor(m / 60000));

    chartInstances.sub = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'Minutos', data: mins, backgroundColor: getStyle('--acc-blue'), borderRadius: 6 }]
        },
        options: {
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
            responsive: true, maintainAspectRatio: false, indexAxis: 'y',
            scales: {
                x: { beginAtZero: true, grid: { color: getStyle('--border-color') }, ticks: { stepSize: 1, color: getStyle('--text-secondary') } },
                y: { grid: { display: false }, ticks: { color: getStyle('--text-primary'), font: { weight: 'bold' } } }
            },
            plugins: { legend: { display: false } }
        }
    });
};

// --- HEATMAP ---
const renderHeatmap = (data) => {
    const grid = document.getElementById('heatmap-grid');
    const labelsContainer = document.getElementById('heatmap-labels-x');
    if (!grid || !labelsContainer) return;

    grid.innerHTML = '';
    labelsContainer.innerHTML = '';

    // Logic from original code directly adapted
    let minH = 24, maxH = 0;
    if (data.length === 0) { minH = 8; maxH = 20; }
    else {
        data.forEach(s => {
            const h1 = new Date(s.startTime).getHours();
            let h2 = new Date(s.endTime).getHours();
            if (h2 < h1) h2 = 23;
            if (h1 < minH) minH = h1;
            if (h2 > maxH) maxH = h2;
        });
        minH = Math.max(0, minH - 1);
        maxH = Math.min(23, maxH + 1);
    }
    if (minH >= maxH) { minH = 0; maxH = 23; }

    const totalCols = maxH - minH + 1;
    grid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;

    // X Labels
    for (let h = minH; h <= maxH; h++) {
        if (h === minH || h === maxH || h % 2 === 0) {
            const span = document.createElement('span');
            span.className = 'text-[10px] text-secondary font-mono absolute font-bold whitespace-nowrap';
            const colIndex = h - minH;
            const pct = ((colIndex + 0.5) / totalCols) * 100;
            span.style.left = `${pct}%`;
            span.style.transform = 'translateX(-50%)';
            span.textContent = `${h}h`;
            labelsContainer.appendChild(span);
        }
    }

    // Buckets
    const buckets = Array(7).fill().map(() => Array(totalCols).fill().map(() => ({ net: 0, gross: 0, count: 0, ids: [] })));

    data.forEach(s => {
        const date = new Date(s.startTime);
        let dayIndex = date.getDay() - 1;
        if (dayIndex < 0) dayIndex = 6;

        // Simple bucket filling for hourly blocks
        const startH = date.getHours();
        const endH = new Date(s.endTime).getHours();

        for (let h = startH; h <= endH; h++) {
            if (h >= minH && h <= maxH) { // only if inside visible range
                const c = h - minH;
                const b = buckets[dayIndex][c];
                b.net += (s.netDuration || 0);
                b.gross += (s.grossDuration || 0);
                b.count++;
                if (!b.ids.includes(s.id)) b.ids.push(s.id);
            }
        }
    });

    // Render Grid
    for (let d = 0; d < 7; d++) {
        for (let c = 0; c < totalCols; c++) {
            const el = document.createElement('div');
            const b = buckets[d][c];

            if (b.count > 0) {
                let eff = b.gross > 0 ? Math.round((b.net / b.gross) * 100) : 0;
                let hue = eff <= 50 ? (eff / 50) * 60 : 60 + ((eff - 50) / 50) * 110;
                const alpha = Math.min(1, 0.65 + (b.count * 0.1));

                el.style.backgroundColor = `hsla(${hue}, ${eff > 80 ? '100%' : '90%'}, ${eff > 90 ? '50%' : '55%'}, ${alpha})`;
                el.style.borderRadius = '30%';
                el.classList.add('cursor-pointer', 'transition-all', 'hover:scale-110', 'hover:brightness-110', 'hover:z-50');
                el.onclick = () => handleHeatmapClick(b.ids);
                el.title = `Eficiencia: ${eff}% (${b.count} sesiones)`;
            } else {
                el.style.backgroundColor = 'transparent';
            }
            grid.appendChild(el);
        }
    }
};

const handleHeatmapClick = (ids) => {
    // Simply open the first one for now, or show selector (simplified)
    if (ids.length > 0) openSessionDetails(ids[0]);
};


// --- HISTORY TABLE & FILTERS ---
// Logic moved here as it is "View" logic heavily tied to data

const getFilterFunction = (prefix = 'dash') => {
    const periodVal = document.getElementById(`${prefix}-filter-period`)?.value || 'week';
    const subVal = document.getElementById(`${prefix}-filter-subject`)?.value;
    const startVal = document.getElementById(`${prefix}-start`)?.value; // Dash uses dash-start, Hist uses hist-filter-start? 
    // Normalized in new HTML? No, kept IDs. 
    // Dash: dash-filter-period / dash-custom-date (dash-start, dash-end)
    // Hist: hist-filter-period / hist-custom-date (hist-filter-start, hist-filter-end)

    const sEl = document.getElementById(prefix === 'dash' ? 'dash-start' : 'hist-filter-start');
    const eEl = document.getElementById(prefix === 'dash' ? 'dash-end' : 'hist-filter-end');

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

    const filter = getFilterFunction('hist');
    const filtered = data.filter(filter);

    // Sort Desc
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    renderHistoryList(filtered);
};

export const renderHistoryList = (listData) => {
    const list = document.getElementById('history-list');
    list.innerHTML = '';

    if (listData.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="p-8 text-center italic text-secondary">No se encontraron sesiones.</td></tr>';
        return;
    }

    listData.forEach(d => {
        const dateStr = new Date(d.startTime).toLocaleDateString();
        const mins = Math.floor(d.netDuration / 60000);

        const tr = document.createElement('tr');
        tr.className = "cursor-pointer hover:brightness-95 transition-all border-b border-theme last:border-0 group bg-card";
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
};
