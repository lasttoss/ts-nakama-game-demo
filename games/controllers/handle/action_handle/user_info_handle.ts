function getUserInfoHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
    let userInventories = findMapUserInventory(nk, logger, state.userId)
    let userPlantProgress = findUserPlantProgress(nk, state.userId)
    let userWateringCan = findUserWateringCan(nk, state.userId)
    let account = null
    try {
        account = nk.accountGetId(state.userId)
        updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
    } catch (error) {
        logger.error('account user_en error: %s', error);
        const errorMessage = ErrorMessage.notFoundAccountInfo()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
    }
}

function updateProgressHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
    let userInventories = findMapUserInventory(nk, logger, state.userId)
    let userPlantProgress = findUserPlantProgress(nk, state.userId)
    let userWateringCan = findUserWateringCan(nk, state.userId)
    let account = null
    try {
        account = nk.accountGetId(state.userId)
    } catch (error) {
        logger.error('account user_en error: %s', error);
        const errorMessage = ErrorMessage.notFoundAccountInfo()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    state.nextTimeGetADropOfWater = userWateringCan.nextTimeGetADropOfWater
    updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
}