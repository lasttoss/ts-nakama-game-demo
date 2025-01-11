let joinPrivateRoom: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw ErrorMessage.notFoundAccountInfo()
    }

    const query = "+userId:" + ctx.userId;
    const matches = nk.matchList(1, true, "", 0, 1, query);
    let matchId = ""
    if (matches.length > 0) {
        matchId = matches[0].matchId
    } else {
        matchId = nk.matchCreate(moduleName, {userId: ctx.userId})
    }
    return JSON.stringify({matchId});
}