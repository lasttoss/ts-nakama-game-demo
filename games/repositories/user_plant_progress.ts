function findUserPlantProgress(nk: nkruntime.Nakama, userId: string): UserPlantProgressModel {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.USER_PLANT_PROGRESS_COLLECTION,
        key: tableConfigs.USER_PLANT_PROGRESS_KEY,
        userId: userId
    }
    const collection = nk.storageRead([request])
    let item: UserPlantProgressModel = collection == null || collection[0] === undefined ? null : collection[0].value["data"]
    if (item == null) {
        item = {} as UserPlantProgressModel
        item.plantId = 0
        item.itemId = ""
        item.currentExp = 0
        item.currentLevel = 1
        item.currentFruit = 0
        item.maxExp = 0
        item.status = 0
        item.protectCoin = false
        item.protectWater = false
        item.protectFruit = false
        item.shieldTimes = 0
        updateUserPlantProgress(nk,  userId, item)
    }
    return item
}

function updateUserPlantProgress(nk: nkruntime.Nakama, userId: string, item: UserPlantProgressModel) {
    const request: nkruntime.StorageWriteRequest = {
        collection: tableConfigs.USER_PLANT_PROGRESS_COLLECTION,
        key: tableConfigs.USER_PLANT_PROGRESS_KEY,
        userId: userId,
        value: {"data": item},
        permissionRead: 1,
        permissionWrite: 0,
    }
    try {
        nk.storageWrite([request])
    } catch (error) {
        throw ErrorMessage.notUpdateUserPlanProgress()
    }
}