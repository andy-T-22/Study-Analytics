import { db } from "../services/firebaseConfig.js";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, increment, deleteDoc, writeBatch } from "firebase/firestore";

let currentGoals = [];
let unsubscribe = null;

export const initGoals = (user, callback) => {
    if (!user) {
        // Guest mode support - LocalStorage
        const local = JSON.parse(localStorage.getItem('guest_goals') || '[]');
        currentGoals = local;
        maintenanceGuest(local, callback);
        return;
    }

    const q = query(collection(db, "objectives"), where("uid", "==", user.uid));
    unsubscribe = onSnapshot(q, (snap) => {
        const goals = [];
        snap.forEach(d => {
            const data = d.data();
            data.id = d.id;
            // Convert timestamp to Date
            if (data.examDate && data.examDate.toDate) data.examDate = data.examDate.toDate();
            // Handle legacy data (missing fields)
            if (data.dailyPace === undefined) data.dailyPace = null;
            goals.push(data);
        });
        currentGoals = goals;

        // Run Maintenance Check (Debounced or immediate? Immediate is fine for small list)
        checkAndMaintainPace(goals, user);

        if (callback) callback(goals);
    });
};

// --- MAINTENANCE LOGIC ---

const getTodayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

const checkAndMaintainPace = async (goals, user) => {
    const today = getTodayStr();
    const batch = writeBatch(db);
    let updatesCount = 0;

    goals.forEach(g => {
        // Condition: No pace stored OR Date is old
        if (g.status === 'active' && (!g.lastPaceUpdate || g.lastPaceUpdate !== today)) {
            const stats = calculatePace(g);

            // Only update if cloud goal
            const ref = doc(db, "objectives", g.id);
            batch.update(ref, {
                dailyPace: stats.pace,
                lastPaceUpdate: today,
                paceStatus: stats.status
            });
            updatesCount++;
        }
    });

    if (updatesCount > 0 && user) {
        // console.log(`Updating pace for ${updatesCount} goals.`);
        try {
            await batch.commit();
        } catch (e) { console.error("Pace update error", e); }
    }
};

const maintenanceGuest = (goals, callback) => {
    const today = getTodayStr();
    let changed = false;

    goals.forEach(g => {
        if (g.status === 'active' && (!g.lastPaceUpdate || g.lastPaceUpdate !== today)) {
            const stats = calculatePace(g);
            g.dailyPace = stats.pace;
            g.lastPaceUpdate = today;
            g.paceStatus = stats.status;
            changed = true;
        }
    });

    if (changed) {
        saveLocal();
        if (callback) callback(goals); // Re-emit updated
    } else {
        if (callback) callback(goals);
    }
};

// --- CORE CALCULATION ---

export const calculatePace = (goal) => {
    const total = goal.targetHours;
    const done = goal.accumulatedHours || 0;
    const remaining = total - done;

    const now = new Date();
    const exam = new Date(goal.examDate);

    const diffTime = exam - now;
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (days < 1 && diffTime > 0) days = 1; // At least 1 day if in future

    let pace = 0;
    let status = 'active';

    if (remaining <= 0) {
        pace = 0;
        status = 'completada';
    } else if (days <= 0 && remaining > 0) {
        pace = remaining; // Show remaining as pace?
        status = 'vencida';
    } else {
        pace = remaining / days;
        status = 'active';
    }

    // Round to 1 decimal
    pace = Math.round(pace * 10) / 10;

    return { pace, status };
};

export const createGoal = async (user, goalData) => {
    const today = getTodayStr();

    // Initial Calc
    const mock = { ...goalData, accumulatedHours: 0 };
    if (typeof mock.examDate === 'string') mock.examDate = new Date(mock.examDate);
    const stats = calculatePace(mock);

    const payload = {
        ...goalData,
        uid: user ? user.uid : 'guest',
        accumulatedHours: 0,
        createdAt: new Date(),
        status: 'active',
        // Persistence
        dailyPace: stats.pace,
        lastPaceUpdate: today,
        paceStatus: stats.status
    };

    if (user) {
        await addDoc(collection(db, "objectives"), payload);
    } else {
        payload.id = Date.now().toString();
        currentGoals.push(payload);
        saveLocal();
    }
};

export const incrementGoalProgress = async (goalId, durationMs) => {
    const hours = durationMs / 3600000;
    const isLocal = !unsubscribe;

    if (!isLocal) {
        const ref = doc(db, "objectives", goalId);
        await updateDoc(ref, {
            accumulatedHours: increment(hours)
        });
        // Note: We DO NOT update dailyPace here. It remains stable.
    } else {
        const g = currentGoals.find(g => g.id === goalId);
        if (g) {
            g.accumulatedHours = (g.accumulatedHours || 0) + hours;
            saveLocal();
        }
    }
};

export const moveSessionGoal = async (oldGoalId, newGoalId, durationMs) => {
    if (oldGoalId === newGoalId) return;
    if (oldGoalId) await incrementGoalProgress(oldGoalId, -durationMs);
    if (newGoalId) await incrementGoalProgress(newGoalId, durationMs);
};

export const deleteGoal = async (goalId) => {
    const isLocal = !unsubscribe;
    if (!isLocal) {
        await deleteDoc(doc(db, "objectives", goalId));
    } else {
        currentGoals = currentGoals.filter(g => g.id !== goalId);
        saveLocal();
    }
};

export const getGoalsBySubject = (subject) => {
    return currentGoals.filter(g => g.subject === subject && g.status === 'active');
};

// Helper to format string UI can use
export const getPaceString = (goal) => {
    // Fallback if field missing (legacy)
    let p = goal.dailyPace;
    if (p === undefined || p === null) {
        const stats = calculatePace(goal);
        p = stats.pace;
    }

    // Dynamic Overrides for Status (Realtime feedback)
    const rem = goal.targetHours - (goal.accumulatedHours || 0);
    if (rem <= 0) return "¡Meta alcanzada!";

    // Check Date directly
    const now = new Date();
    const exam = new Date(goal.examDate);
    if (exam < now && rem > 0) return "Examen pasado";

    if (goal.paceStatus === 'vencida') return "¡Imposible!";

    if (p > 24) return "¡Imposible!";
    if (p < 0.1) return "Vas sobrado";

    return `${p.toFixed(1)}h / día`;
};

const saveLocal = () => {
    localStorage.setItem('guest_goals', JSON.stringify(currentGoals));
};

export const getCurrentGoals = () => currentGoals;
