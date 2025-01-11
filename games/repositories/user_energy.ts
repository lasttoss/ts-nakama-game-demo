function findUserEnergy(nk: nkruntime.Nakama, userId: string): UserEnergyModel {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.USER_ENERGY_COLLECTION,
        key: tableConfigs.USER_ENERGY_KEY,
        userId: userId
    }
    const collection = nk.storageRead([request])
    let item: UserEnergyModel = collection == null || collection[0] === undefined ? null : collection[0].value["data"]
    if (item == null) {
        item = {} as UserEnergyModel
        item.currentEnergy = MAX_USER_ENERGY
        item.maxEnergy = MAX_USER_ENERGY
        item.nextTimeToReset = getCurrentTime() + EXPIRE_TIME_TO_MAX_NEXT_USER_ENERGY
        updateUserEnergy(nk, userId, item)
    }
    return item
}

function updateUserEnergy(nk: nkruntime.Nakama, userId: string, item: UserEnergyModel) {
    const request: nkruntime.StorageWriteRequest = {
        collection: tableConfigs.USER_ENERGY_COLLECTION,
        key: tableConfigs.USER_ENERGY_KEY,
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