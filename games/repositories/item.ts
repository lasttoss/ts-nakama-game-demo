function findAllItemConfig(nk: nkruntime.Nakama): ItemModel[] {
    const request: nkruntime.StorageReadRequest = {
        collection: tableConfigs.SYSTEM_COLLECTION,
        key: tableConfigs.SYSTEM_ITEM_CONFIG_KEY,
        userId: tableConfigs.SYSTEM_USERID
    }

    const collection = nk.storageRead([request])
    const item: ItemModel[] = collection == null || collection[0] === undefined ? null : collection[0].value["data"]
    return item
}

function findAllMapItemConfig(nk: nkruntime.Nakama): { [id: string]: ItemModel } {
    const list = findAllItemConfig(nk)
    const map: { [id: string]: ItemModel } = {}
    for (let idx in list) {
        const value = list[idx]
        map[value.id] = value
    }
    return map
}