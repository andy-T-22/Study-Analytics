import { getCurrentGoals, calculatePace } from "./goals.js";
import { formatHours } from "./utils.js";

// --- LOGIC ---

/**
 * Calculates the daily target and progress for a specific goal.
 * Strategy:
 * 1. Total Target = Goal.targetHours
 * 2. Total Done (Lifetime) = Goal.accumulatedHours
 * 3. Total Remaining = Total Target - Total Done
 * 4. Days Remaining = (ExamDate - Now) in days (ceil).
 * 
 * However, "Daily Target" is tricky. If I did 0 yesterday, do I have to do double today?
 * Yes, usually "Remaining / Days" spreads the load.
 * 
 * BUT, we need to know what we have done *TODAY* to show the progress bar for *TODAY*.
 * Goal.accumulatedHours includes today's work if it was just saved.
 * 
 * So:
 * - Work Done Before Today = Total Done - Work Done Today
 * - Remaining Work Total = Total Target - Work Done Before Today
 * - Daily Target = Remaining Work Total / Days Remaining (including today)
 * 
 * Example:
 * Target 10h. Exam in 5 days (including today).
 * Done Before: 0.
 * Daily Target = 10 / 5 = 2h.
 * Done Today: 0.5h.
 * Progress: 0.5 / 2.0 (25%).
 * 
 * @param {Object} goal - The goal object
 * @param {Array} sessions - List of all sessions (to filter for today)
 */
export const calculateDailyGoalStats = (goal, sessions) => {
    const now = new Date();
    const todayStr = now.toDateString(); // "Wed Feb 11 2026"

    // 1. Get Sessions for this Goal TODAY
    const goalSessionsToday = sessions.filter(s =>
        s.goalId === goal.id &&
        new Date(s.startTime).toDateString() === todayStr
    );

    const doneTodayMs = goalSessionsToday.reduce((acc, s) => acc + (s.netDuration || 0), 0);
    const doneTodayHours = doneTodayMs / 3600000;

    // 2. Initial State (Total Done in DB includes today if it updated lively, 
    // but usually accumulatedHours is the GROUND TRUTH for "Total Done").
    // Let's assume accumulatedHours IS up to date.

    const totalDone = goal.accumulatedHours || 0;
    const totalTarget = goal.targetHours;

    // Work Done Before Today (Approximate logic, assuming accumulatedHours is accurate)
    // If accumulatedHours is updated via sessions, it includes today.
    // So "Remaining to do TOTAL" = Target - TotalDone.
    const remainingTotal = Math.max(0, totalTarget - totalDone);

    // The "Daily Target" should be based on the situation at START of day?
    // Or dynamic "catch up"? 
    // Dynamic: "I have X hours left total, and Y days left. I should do X/Y today."
    // Wait, if I do work today, X decreases. Y stays same (until tomorrow).
    // So (X / Y) would decrease as I work? That's weird for a "Target".
    // 
    // Correct Formula for specific "Today's Target":
    // TargetToday = (RemainingTotal + DoneToday) / DaysRemaining
    // This value is constant for the day (unless TotalTarget changes).

    const examDate = new Date(goal.examDate);
    examDate.setHours(0, 0, 0, 0);
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);

    const diffTime = examDate - todayZero;
    const isExpired = diffTime < 0;

    let targetToday = goal.dailyPace;
    if (targetToday === undefined || targetToday === null) {
        const stats = calculatePace(goal);
        targetToday = stats.pace;
    }

    // Edge case: If I already finished the TOTAL goal, target is 0.
    if (totalDone >= totalTarget) targetToday = 0;

    return {
        id: goal.id,
        name: goal.nombre,
        subject: goal.subject,
        doneToday: doneTodayHours,
        targetToday: targetToday,
        isCompleted: doneTodayHours >= targetToday && targetToday > 0,
        isTotalCompleted: totalDone >= totalTarget,
        isExpired: isExpired
    };
};

// --- RENDER ---

export const renderDailyPlan = () => {
    const container = document.getElementById('daily-plan-list');
    if (!container) return; // Guard if UI not present

    const goals = getCurrentGoals();
    const sessions = window.globalSessionCache || [];

    // Filter active goals only?
    // Logic: Active goals
    const activeStats = goals
        .filter(g => g.status !== 'archived') // Assuming 'active' logic
        .map(g => calculateDailyGoalStats(g, sessions))
        // Filter out goals that are totally done or EXPIRED
        .filter(s => !s.isTotalCompleted && !s.isExpired);

    if (activeStats.length === 0) {
        document.getElementById('daily-plan-panel').classList.add('hidden');
        return;
    }

    // Color Palette for Subjects (Using Theme Variables for consistency)
    const colors = [
        "text-acc-blue-dark",
        "text-acc-green-dark",
        "text-acc-red-dark",
        "text-secondary" // Safe fallback
    ];

    const getSubjectColorClass = (str) => {
        if (!str) return "text-secondary";
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    document.getElementById('daily-plan-panel').classList.remove('hidden');
    container.innerHTML = activeStats.map(stat => {
        const pct = stat.targetToday > 0
            ? Math.min(100, (stat.doneToday / stat.targetToday) * 100)
            : 100;

        let subText = "";
        let barColor = "bg-acc-blue";

        if (stat.isCompleted) {
            subText = `<span class="text-acc-green font-bold">¡Objetivo cumplido! <i class="fas fa-check"></i></span>`;
            barColor = "bg-acc-green";
        } else {
            const remainingToday = Math.max(0, stat.targetToday - stat.doneToday);
            subText = `Faltan ${formatHours(remainingToday)} / ${formatHours(stat.targetToday)}`;
        }

        return `
            <div class="mb-5 last:mb-0">
                <div class="flex justify-between items-start mb-1">
                    <div class="flex flex-col">
                        <span class="font-bold text-primary truncate max-w-[150px]" title="${stat.name}">${stat.name}</span>
                        <span class="text-[10px] text-secondary font-bold tracking-wide">${stat.subject || 'General'}</span>
                    </div>
                    <span class="text-xs font-bold text-secondary mt-1">${Math.round(pct)}%</span>
                </div>
                
                <div class="h-2 w-full bg-theme/20 rounded-full overflow-hidden mb-1 mt-1 border border-theme">
                    <div class="${barColor} h-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                
                <div class="text-right text-xs text-secondary font-mono">
                    ${subText}
                </div>
            </div>
        `;
    }).join('');
};



export const initDailyGoalPanel = () => {
    renderDailyPlan();
    // Subscribe to events? 
    // main.js handles calling renderDailyPlan on updates.

    // Listen for custom event if we implemented it
    document.addEventListener('goals-updated', renderDailyPlan);
};
