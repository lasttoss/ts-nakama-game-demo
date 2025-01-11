const rpcIdFindPrivateRoom = 'find_private_room'
const rpcIdListItemsShop = 'list_items_shop'
const rpcIdListUserInventory = 'list_user_inventories'
const rpcIdUserEnergy = 'get_user_energy'

function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    initializer.registerAfterAuthenticateDevice(initializeAuthenticateDevice);
    initializer.registerRpc(rpcIdFindPrivateRoom, joinPrivateRoom)
    initializer.registerRpc(rpcIdListItemsShop, listItemsShop)
    initializer.registerRpc(rpcIdListUserInventory, listUserInventories)
    initializer.registerRpc(rpcIdUserEnergy, getUserEnergy)

    initializer.registerMatch(moduleName, {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal,
    });

    logger.info('JavaScript logic loaded.');
}