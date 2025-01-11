let matchJoin: nkruntime.MatchJoinFunction<State> = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: State, presences: nkruntime.Presence[]) {
    for (const presence of presences) {
        state.emptyTicks = 0;
        state.presences[presence.userId] = presence;
        state.joinsInProgress--;
    }

    // Check if match was open to new players, but should now be closed.
    if (Object.keys(state.presences).length == limitRoom) {
        const labelJSON = state.label;
        dispatcher.matchLabelUpdate(labelJSON);
    }

    let account = nk.accountGetId(state.userId)
    let userInventories = findMapUserInventory(nk, logger, state.userId)
    let userPlantProgress = findUserPlantProgress(nk, state.userId)
    let userWateringCan = findUserWateringCan(nk, state.userId)

    if (state.nextTimeGetADropOfWater <= getCurrentTime()) {
        if (userWateringCan.wateringCan < MAX_WATERING_CAN) {
            const currentTime = getCurrentTime()
            if (currentTime >= state.nextTimeGetADropOfWater) {
                const times = Math.floor((currentTime - state.nextTimeGetADropOfWater) / EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER) + 1
                if (userWateringCan.wateringCan < MAX_WATERING_CAN) {
                    if (userWateringCan.wateringCan + times < MAX_WATERING_CAN) {
                        userWateringCan.wateringCan += times
                    } else {
                        userWateringCan.wateringCan = MAX_WATERING_CAN
                    }
                }
            }
        }
        if (userWateringCan.nextTimeGetADropOfWater <= getCurrentTime()) {
            const nextTimeGetADropOfWater = getCurrentTime() + EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER
            userWateringCan.nextTimeGetADropOfWater = nextTimeGetADropOfWater
            state.nextTimeGetADropOfWater = nextTimeGetADropOfWater
        }
        updateUserPlantProgress(nk, state.userId, userPlantProgress)
    }

    if (state.matchStatus == OpCode.INIT_RESOURCES) {
        if (userPlantProgress.plantId > 0) {
            const seedConfigs = findAllSeedConfig(nk)
            let currentLevel = 0
            while (currentLevel < seedConfigs[userPlantProgress.plantId - 1].requiredExp.length) {
                if (userPlantProgress.currentExp < seedConfigs[userPlantProgress.plantId - 1].requiredExp[currentLevel]) {
                    break
                }
                currentLevel++
            }

            if (userPlantProgress.currentLevel != currentLevel + 1) {
                userPlantProgress.currentLevel = currentLevel + 1 >= seedConfigs[userPlantProgress.plantId - 1].requiredExp.length ? seedConfigs[userPlantProgress.plantId - 1].requiredExp.length : currentLevel + 1
                updateUserPlantProgress(nk, state.userId, userPlantProgress)
            }

            if (userPlantProgress.status == PlanStatus.COMPLETED && userPlantProgress.currentLevel != 5)
                if (userPlantProgress.currentExp >= userPlantProgress.maxExp) {
                    userPlantProgress.currentLevel = 5
                    updateUserPlantProgress(nk, state.userId, userPlantProgress)
                }
        }
        updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
        state.matchStatus = OpCode.START
    }

    return {state};
}