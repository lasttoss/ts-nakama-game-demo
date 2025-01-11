let matchInit: nkruntime.MatchInitFunction<State> = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: { [key: string]: string }) {
    const userId: string = params["userId"]
    const label: string = "userId:" + userId

    const state: State = {
        label: label,
        userId: userId,
        emptyTicks: 0,
        presences: {},
        joinsInProgress: 0,
        nextTimeGetADropOfWater: 0,
        matchStatus: OpCode.INIT_RESOURCES,
    };

    return {
        state,
        tickRate,
        label: "userId:" + userId,
    }
}