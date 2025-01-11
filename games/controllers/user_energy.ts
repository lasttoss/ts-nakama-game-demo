let getUserEnergy: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw ErrorMessage.notFoundAccountInfo()
    }

    let item: UserEnergyModel = findUserEnergy(nk, ctx.userId)
    if (item.currentEnergy < item.maxEnergy && getCurrentTime() > item.nextTimeToReset) {
        const times = Math.floor((getCurrentTime() - item.nextTimeToReset) / EXPIRE_TIME_TO_GET_NEXT_USER_ENERGY) + 1
        if (item.currentEnergy < MAX_USER_ENERGY) {
            if (item.currentEnergy + times < MAX_USER_ENERGY) {
                item.currentEnergy += times
                item.nextTimeToReset = getCurrentTime() + EXPIRE_TIME_TO_GET_NEXT_USER_ENERGY
            } else {
                item.currentEnergy = MAX_USER_ENERGY
                item.nextTimeToReset = getCurrentTime() + EXPIRE_TIME_TO_MAX_NEXT_USER_ENERGY
            }
        }
        updateUserEnergy(nk, ctx.userId, item)
    }
    let response = {} as UserEnergyDTO
    response.currentEnergy = item.currentEnergy
    response.maxEnergy = item.maxEnergy
    response.nextTimeToReset = item.nextTimeToReset
    response.currentTime = getCurrentTime()

    return JSON.stringify(response);
}