function sowSeedHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
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
        return;
    }
    if (userPlantProgress.status != PlanStatus.CAN_SOW) {
        const errorMessage = ErrorMessage.plantIsGrowing()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return;
    }
    let request = {} as SowSeedingRequest
    try {
        request = JSON.parse(nk.binaryToString(message.data))
    } catch (error) {
        // Client sent bad data.
        const errorMessage = ErrorMessage.clientSendBadData()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return;
    }
    const mapItems = findAllMapItemConfig(nk)
    let arr = request.itemId.split("-")
    arr = arr.slice(0, -1)
    let newItemId = arr.join("-")
    let item = mapItems[newItemId]
    if (mapItems[newItemId] === undefined) {
        const errorMessage = ErrorMessage.invalidItemId()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return;
    }
    if (mapItems[newItemId].resourceType != ResourceType.SEED_TYPE) {
        const errorMessage = ErrorMessage.invalidResource()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return;
    }
    if (userInventories[request.itemId] === undefined || userInventories[request.itemId].quantity <= 0) {
        const errorMessage = ErrorMessage.notEnoughToSow()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return;
    }

    const seedConfigs = findAllSeedConfig(nk)
    const seedData = seedConfigs[item.resourceId - 1]
    userPlantProgress.plantId = item.resourceId
    userPlantProgress.itemId = item.id
    userPlantProgress.status = PlanStatus.IS_GROWING
    userPlantProgress.nextTimeToPick = 0
    userPlantProgress.currentExp = 0
    userPlantProgress.currentFruit = 0
    userPlantProgress.currentLevel = 1
    userPlantProgress.maxExp = seedData.requiredExp[seedData.requiredExp.length - 1]
    userInventories[request.itemId].quantity--
    if (userInventories[request.itemId].quantity <= 0) {
        delete userInventories[request.itemId]
    }
    updateUserPlantProgress(nk, state.userId, userPlantProgress)
    updateUserInventory(nk, state.userId, userInventories)
    updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
}

function pickingFruitHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
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
    if (userPlantProgress.status != PlanStatus.COMPLETED) {
        const errorMessage = ErrorMessage.canNotPickingFruits()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), [message.sender], null, false)
        return
    }
    if (getCurrentTime() < userPlantProgress.nextTimeToPick) {
        const errorMessage = ErrorMessage.timeToPickingNotOpen()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), [message.sender], null, false)
        return
    }
    userPlantProgress.plantId = 0
    userPlantProgress.itemId = ""
    userPlantProgress.currentExp = 0
    userPlantProgress.maxExp = 0
    userPlantProgress.currentFruit = 0
    userPlantProgress.status = PlanStatus.CAN_SOW

    updateUserPlantProgress(nk, state.userId, userPlantProgress)
    updateUserInventory(nk, state.userId, userInventories)
    updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
}

function sprayWaterHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
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
    let request = {} as SprayWaterRequest
    try {
        request = JSON.parse(nk.binaryToString(message.data))
    } catch (error) {
        // Client sent bad data.
        const errorMessage = ErrorMessage.clientSendBadData()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    if (request.quantity <= 0) {
        const errorMessage = ErrorMessage.invalidParameterPayload()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    if (request.quantity > userWateringCan.wateringCan) {
        const errorMessage = ErrorMessage.notEnoughWatering()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    if (userPlantProgress.status != PlanStatus.IS_GROWING) {
        const errorMessage = ErrorMessage.notIsGrowingStatus()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    if (userWateringCan.wateringCan <= 0) {
        const errorMessage = ErrorMessage.notEnoughDropOfWater()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    if (userPlantProgress.currentExp == userPlantProgress.maxExp) {
        const errorMessage = ErrorMessage.expIsMax()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }

    const seedConfigs = findAllSeedConfig(nk)
    const maxLevel = seedConfigs[userPlantProgress.plantId - 1].requiredExp.length
    const finalExpPoint = seedConfigs[userPlantProgress.plantId - 1].requiredExp[maxLevel - 1]
    if (userPlantProgress.currentExp + request.quantity > finalExpPoint) {
        const errorMessage = ErrorMessage.maxToSpray()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    const oldWateringCan = userWateringCan.wateringCan
    userWateringCan.wateringCan -= request.quantity
    userPlantProgress.currentExp += request.quantity
    if (userPlantProgress.currentExp >= userPlantProgress.maxExp) {
        const pickingFruitConfig = findPickingFruitCountdown(nk)
        userPlantProgress.currentLevel = 5
        userPlantProgress.currentExp = userPlantProgress.maxExp
        userPlantProgress.status = PlanStatus.COMPLETED
        userPlantProgress.currentFruit = 3
        userPlantProgress.nextTimeToPick = getCurrentTime() + pickingFruitConfig.fruitTimeCountdown[userPlantProgress.plantId - 1]
    }

    if (userWateringCan.wateringCan < MAX_WATERING_CAN && oldWateringCan >= MAX_WATERING_CAN) {
        const nextTimeGetADropOfWater = getCurrentTime() + EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER
        userWateringCan.nextTimeGetADropOfWater = nextTimeGetADropOfWater
        state.nextTimeGetADropOfWater = nextTimeGetADropOfWater
    }

    updateUserPlantProgress(nk, state.userId, userPlantProgress)
    updateUserInventory(nk, state.userId, userInventories)
    updateUserWateringCan(nk, state.userId, userWateringCan)
    updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
}

function pickingProtectHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
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
    let request = {} as PickingToProtectRequest
    try {
        request = JSON.parse(nk.binaryToString(message.data))
    } catch (error) {
        // Client sent bad data.
        const errorMessage = ErrorMessage.clientSendBadData()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    if (request.type < 0 || request.type > 3) {
        const errorMessage = ErrorMessage.invalidParameterPayload()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    const items = findAllItemConfig(nk)
    const itemOptional = items.filter(i => i.resourceType == ResourceType.CONSUME_TYPE && i.resourceId == ConsumeResource.SHIELD)
    if (itemOptional == null || itemOptional.length == 0) {
        const errorMessage = ErrorMessage.itemNotFound()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    const shieldItemId = itemOptional[0].id
    if (userInventories[shieldItemId] === undefined || userInventories[shieldItemId].quantity <= 0) {
        const errorMessage = ErrorMessage.notEnoughShieldToProtect()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    if (userPlantProgress.protectCoin && request.type == ProtectType.COIN) {
        const errorMessage = ErrorMessage.hasBeenUseShieldToProtect()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    if (userPlantProgress.protectWater && request.type == ProtectType.WATER) {
        const errorMessage = ErrorMessage.hasBeenUseShieldToProtect()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    if (userPlantProgress.protectFruit && request.type == ProtectType.FRUIT) {
        const errorMessage = ErrorMessage.hasBeenUseShieldToProtect()
        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify(errorMessage), null, null, false)
        return
    }
    switch (request.type) {
        case ProtectType.COIN:
            userPlantProgress.protectCoin = true
            break
        case ProtectType.WATER:
            userPlantProgress.protectWater = true
            break
        case ProtectType.FRUIT:
            userPlantProgress.protectFruit = true
            break
        default:
            break
    }
    userInventories[shieldItemId].quantity--
    if (userInventories[shieldItemId].quantity <= 0) {
        delete userInventories[shieldItemId]
    }
    updateUserPlantProgress(nk, state.userId, userPlantProgress)
    updateUserInventory(nk, state.userId, userInventories)
    updateUserInfo(nk, userInventories, userPlantProgress, userWateringCan, account, dispatcher)
}