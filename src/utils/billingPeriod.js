// Uses server timezone. For strict Addis Ababa timezone, set process.env.TZ="Africa/Addis_Ababa" in your server start.
export function getPeriodKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

export function getMonthStart(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function getMonthEnd(date = new Date()) {
    // last moment of month
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function getPreviousMonthDate(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function dueDateForCurrentMonth(date = new Date()) {
    // Due is 16th of current month
    return new Date(date.getFullYear(), date.getMonth(), 16, 23, 59, 59, 999);
}

export function isReadOnlyWindow(now = new Date()) {
    // day 17+ => read-only when unpaid exists
    return now.getDate() >= 17;
}


export function previousMonthKey(date = new Date()) {
    const prev = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}