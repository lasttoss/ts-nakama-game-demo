function findMapUserInventory(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string): { [itemId: string]: UserInventoryModel } {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.USER_INVENTORY_COLLECTION,
        key: tableConfigs.USER_INVENTORY_KEY,
        userId: userId
    }
    const collection = nk.storageRead([request])
    const items: { [itemId: string]: UserInventoryModel } = collection == null || collection[0] === undefined ? {} : collection[0].value["data"]
    return items
}

function updateUserInventory(nk: nkruntime.Nakama, userId: string, items: { [itemId: string]: UserInventoryModel }) {
    const request: nkruntime.StorageWriteRequest = {
        collection: tableConfigs.USER_INVENTORY_COLLECTION,
        key: tableConfigs.USER_INVENTORY_KEY,
        userId: userId,
        value: {"data": items},
        permissionRead: 1,
        permissionWrite: 0,
    }
    try {
        nk.storageWrite([request])
    } catch (error) {
        throw ErrorMessage.notUpdateUserInventory()
    }
}
