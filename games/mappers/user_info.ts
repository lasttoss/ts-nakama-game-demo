function updateUserInfo(nk: nkruntime.Nakama, userInventories: { [id: string]: UserInventoryModel }, userPlantProgress: UserPlantProgressModel, userWateringCan: UserWateringCanModel, account: nkruntime.Account, dispatcher: nkruntime.MatchDispatcher): void {
    const response = {} as MatchUserInfo
    response.inventories = userInventories
    response.progress = mappingToUserPlantProgressDTO(userPlantProgress)
    response.wateringCan = userWateringCan
    response.wallet = account.wallet
    dispatcher.broadcastMessage(OpCode.USER_INFO, JSON.stringify(response), null, null, false)
}