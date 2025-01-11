function connectedPlayers(s: State): number {
    let count = 0;
    for (const p of Object.keys(s.presences)) {
        if (p !== null) {
            count++;
        }
    }
    return count;
}

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max) + 1;
}

function numberWithCommas(amount: number): string {
    let parts = amount.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

const shuffle = ([...arr]) => {
    let m = arr.length;
    while (m) {
        const i = Math.floor(Math.random() * m--);
        [arr[m], arr[i]] = [arr[i], arr[m]];
    }
    return arr;
}
