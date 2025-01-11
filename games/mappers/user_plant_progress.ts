function mappingToUserPlantProgressDTO(model: UserPlantProgressModel) {
    let item = {} as UserPlantProgressDTO
    item.itemId = model.itemId
    item.plantId = model.plantId
    item.currentFruit = model.currentFruit
    item.currentExp = model.currentExp
    item.currentLevel = model.currentLevel
    item.maxExp = model.maxExp
    item.status = model.status
    item.currentTime = getCurrentTime()
    item.protectCoin = model.protectCoin
    item.protectWater = model.protectWater
    item.protectFruit = model.protectFruit
    item.shieldTimes = model.shieldTimes
    item.nextTimeToPick = model.nextTimeToPick
    return item
}