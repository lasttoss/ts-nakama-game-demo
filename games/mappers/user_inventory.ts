function mappingToListUserInventory(nk: nkruntime.Nakama, map: { [itemId: string]: UserInventoryModel }) {
    const mapItems = findAllMapItemConfig(nk)
    let items = []
    for (const key in map) {
        const value = map[key]
        const dto = {} as UserInventoryDTO
        dto.itemId = key
        dto.quantity = value.quantity
        dto.item = mapItems[value.itemId] === undefined ? {} as ItemModel : mapItems[value.itemId]
        dto.data = value.data
        dto.currentTime = getCurrentTime()
        items.push(dto)
    }
    return items
}