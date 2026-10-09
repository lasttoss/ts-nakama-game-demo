let joinPrivateRoom: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw ErrorMessage.notFoundAccountInfo()
    }

    // matchList(limit, authoritative, label, minSize, maxSize, query) is served from an
    // indexed match registry: the label/query arguments are filters over that index, and a
    // match can be missing from it for a moment after it is created. Reusing the wrong
    // match would drop the player into somebody else's room, so this lists the registry and
    // only accepts a candidate whose label is an exact match for this player (see
    // findPrivateRoom, which is unit tested against exactly that). When nothing matches - the
    // first call, or an index that has not caught up yet - a room is created.
    const matches = nk.matchList(100, true, "", 0, 100, "");
    let matchId = findPrivateRoom(matches, ctx.userId);
    if (matchId === "") {
        matchId = nk.matchCreate(moduleName, {userId: ctx.userId});
    }
    return JSON.stringify({matchId});
}