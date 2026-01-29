import { db } from "../services/firebaseConfig.js";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, increment, deleteDoc } from "firebase/firestore";

let currentGoals = [];
let unsubscribe = null;

export const initGoals = (user, callback) => {
    if (!user) {
        // Guest mode support? Maybe later. For now, empty or local.
        // Let's support local storage for guests for consistent UX.
        const local = JSON.parse(localStorage.getItem('guest_goals') || '[]');
        currentGoals = local;
        if (callback) callback(local);
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
            goals.push(data);
        });
        currentGoals = goals;
        if (callback) callback(goals);
    });
};

export const createGoal = async (user, goalData) => {
    // goalData: { title, subject, targetHours, examDate }
    const payload = {
        ...goalData,
        uid: user ? user.uid : 'guest',
        accumulatedHours: 0,
        createdAt: new Date(),
        status: 'active'
    };

    if (user) {
        await addDoc(collection(db, "objectives"), payload);
    } else {
        payload.id = Date.now().toString(); // Local ID
        // Convert date string to obj if needed, but input is typically date obj or string
        if (typeof payload.examDate === 'string') payload.examDate = new Date(payload.examDate);

        currentGoals.push(payload);
        saveLocal();
        // Trigger UI update manually via callback if needed, but usually we rely on currentGoals ref or reloading
        // We might need to expose a way to trigger listener for local.
        // Simpler: reloadGoalsUI() is usually called by the consumer.
    }
};

export const incrementGoalProgress = async (goalId, durationMs) => {
    const hours = durationMs / 3600000;

    // Find if cloud or local
    const isLocal = !unsubscribe;

    if (!isLocal) {
        const ref = doc(db, "objectives", goalId);
        await updateDoc(ref, {
            accumulatedHours: increment(hours)
        });
    } else {
        const g = currentGoals.find(g => g.id === goalId);
        if (g) {
            g.accumulatedHours = (g.accumulatedHours || 0) + hours;
            saveLocal();
        }
    }
};

export const moveSessionGoal = async (oldGoalId, newGoalId, durationMs) => {
    // If goals are same, do nothing
    if (oldGoalId === newGoalId) return;

    // Decrement Old
    if (oldGoalId) await incrementGoalProgress(oldGoalId, -durationMs);

    // Increment New
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

export const calculateIntensity = (goal) => {
    const now = new Date();
    const exam = new Date(goal.examDate);

    if (exam <= now) return "El examen ya pasó";

    // Remaining Hours
    const remainingHours = goal.targetHours - (goal.accumulatedHours || 0);
    if (remainingHours <= 0) return "¡Meta alcanzada!";

    // Remaining Days
    const diffTime = Math.abs(exam - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "¡Es hoy!";

    const hoursPerDay = remainingHours / diffDays;

    if (hoursPerDay > 24) return "¡Imposible!";
    if (hoursPerDay < 0.1) return "Vas sobrado";

    return `${hoursPerDay.toFixed(1)}h / día`;
};

const saveLocal = () => {
    localStorage.setItem('guest_goals', JSON.stringify(currentGoals));
};

export const getCurrentGoals = () => currentGoals;
