function mappingToUserEnergyDTO(item: UserEnergyModel) {
    let dto = {} as UserEnergyDTO
    dto.currentEnergy = item.currentEnergy
    dto.maxEnergy = item.maxEnergy
    dto.nextTimeToReset = item.nextTimeToReset
    dto.currentTime = getCurrentTime()
    return dto
}