function checkWateringCanHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher) {
    const currentTime = getCurrentTime()
    if (state.nextTimeGetADropOfWater <= currentTime) {
        let userWateringCan = findUserWateringCan(nk, state.userId)
        if (userWateringCan.wateringCan < MAX_WATERING_CAN) {
            const times = Math.floor((currentTime - userWateringCan.nextTimeGetADropOfWater) / EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER) + 1
            if (userWateringCan.wateringCan < MAX_WATERING_CAN) {
                if (userWateringCan.wateringCan + times < MAX_WATERING_CAN) {
                    userWateringCan.wateringCan += times
                } else {
                    userWateringCan.wateringCan = MAX_WATERING_CAN
                }
            }
        }
        if (userWateringCan.nextTimeGetADropOfWater <= getCurrentTime()) {
            const nextTimeGetADropOfWater = getCurrentTime() + EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER
            userWateringCan.nextTimeGetADropOfWater = nextTimeGetADropOfWater
            state.nextTimeGetADropOfWater = nextTimeGetADropOfWater
        }
        updateUserWateringCan(nk, state.userId, userWateringCan)
        const userInventories = findMapUserInventory(nk, logger, state.userId)
        const userPlantProgress = findUserPlantProgress(nk, state.userId)
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
}