function mappingToListShop(nk: nkruntime.Nakama, list: ShopModel[]) {
    const mapItems = findAllMapItemConfig(nk)
    let items = []
    for (const item of list) {
        if (item.status == 0) {
            let shopDTO = {} as ShopDTO
            shopDTO.id = item.id
            shopDTO.amount = item.amount
            shopDTO.price = item.price
            shopDTO.item = mapItems[item.itemId]
            items.push(shopDTO)
        }
    }
    return items
}