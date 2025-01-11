function getCurrentTime(): number {
    return Math.floor(Date.now() / 1000)
}

function getCurrentTimeWithMilliseconds(): number {
    return Date.now()
}

function getCurrentWeek(): number {
    let now = new Date();
    let oneJan = new Date(now.getFullYear(), 0, 1);
    let week = Math.ceil((((now.getTime() - oneJan.getTime()) / 86400000) + oneJan.getDay() + 1) / 7);
    return week
}

function getCurrentSeasonTime(): number {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours(), 0, 0).getTime() / 1000;
}

function getEndOfDay(): number {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0).getTime() / 1000;
}