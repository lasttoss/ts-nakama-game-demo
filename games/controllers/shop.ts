let listItemsShop: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const list = findAllShopConfig(nk)
    const shops = mappingToListShop(nk, list)
    return JSON.stringify(shops)
}