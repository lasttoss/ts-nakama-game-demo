let listUserInventories: nkruntime.RpcFunction = function (ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) {
        throw ErrorMessage.notFoundAccountInfo()
    }
    const map = findMapUserInventory(nk, logger, ctx.userId)
    const list = mappingToListUserInventory(nk, map)
    return JSON.stringify(list)
}