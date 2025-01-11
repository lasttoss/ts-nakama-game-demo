function findUserWateringCan(nk: nkruntime.Nakama, userId: string): UserWateringCanModel {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.USER_WATERING_CAN_COLLECTION,
        key: tableConfigs.USER_WATERING_CAN_KEY,
        userId: userId
    }
    const collection = nk.storageRead([request])
    let item: UserWateringCanModel = collection == null || collection[0] === undefined ? null : collection[0].value["data"]
    if (item == null) {
        item = {} as UserWateringCanModel
        item.wateringCan = MAX_WATERING_CAN
        item.nextTimeGetADropOfWater = getCurrentTime() + EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER
        updateUserWateringCan(nk, userId, item)
    }
    return item
}

function updateUserWateringCan(nk: nkruntime.Nakama, userId: string, item: UserWateringCanModel) {
    const request: nkruntime.StorageWriteRequest = {
        collection: tableConfigs.USER_WATERING_CAN_COLLECTION,
        key: tableConfigs.USER_WATERING_CAN_KEY,
        userId: userId,
        value: {"data": item},
        permissionRead: 1,
        permissionWrite: 0,
    }
    try {
        nk.storageWrite([request])
    } catch (error) {
        throw ErrorMessage.notUpdateUserEnergy()
    }
}