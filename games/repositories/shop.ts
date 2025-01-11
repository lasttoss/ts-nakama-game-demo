function findAllShopConfig(nk: nkruntime.Nakama): ShopModel[] {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.SYSTEM_COLLECTION,
        key: tableConfigs.SYSTEM_SHOP_COIN_CONFIG_KEY,
        userId: tableConfigs.SYSTEM_USERID
    }

    const collection = nk.storageRead([request])
    const items: ShopModel[] = collection == null || collection[0] === undefined ? [] : collection[0].value["data"]
    return items
}