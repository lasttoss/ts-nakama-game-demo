// The label a private room carries. Match labels are the only thing matchList can filter on, so
// this string is the room's identity: two players must never produce the same one.
function privateRoomLabel(userId: string): string {
    return "userId:" + userId
}

// Picks the room this player already owns, or "" when there is none.
//
// It compares labels exactly rather than trusting matchList's filter: the registry is indexed and
// a freshly created match can be missing from it for a moment, and the label argument is a filter
// over that index, not a promise. A substring match here would hand a player somebody else's room
// (userId:ada would match userId:ada2), which is the bug this function used to have.
function findPrivateRoom(matches: nkruntime.Match[], userId: string): string {
    const label = privateRoomLabel(userId)
    for (let i = 0; i < matches.length; i++) {
        if (matches[i].label === label) {
            return matches[i].matchId
        }
    }
    return ""
}

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
