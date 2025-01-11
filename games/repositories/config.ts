function findAllSeedConfig(nk: nkruntime.Nakama): SeedModel[] {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.SYSTEM_COLLECTION,
        key: tableConfigs.SYSTEM_SEED_CONFIG_KEY,
        userId: tableConfigs.SYSTEM_USERID
    }

    const collection = nk.storageRead([request])
    const item: SeedModel[] = collection == null || collection[0] === undefined ? null : collection[0].value["data"]
    return item
}

function findPickingFruitCountdown(nk: nkruntime.Nakama): PickingFruitCountdownConfigModel {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.SYSTEM_COLLECTION,
        key: tableConfigs.SYSTEM_PICKING_FRUIT_COUNTDOWN_CONFIG,
        userId: tableConfigs.SYSTEM_USERID
    }

    const collection = nk.storageRead([request])
    const item: PickingFruitCountdownConfigModel = collection == null || collection[0] === undefined ? [] : collection[0].value["data"]
    return item
}