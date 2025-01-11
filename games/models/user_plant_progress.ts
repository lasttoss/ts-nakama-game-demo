interface UserPlantProgressModel{
    plantId: number | 0,
    itemId: string | "",
    currentFruit: number,
    currentExp: number | 0,
    currentLevel: number | 0,
    maxExp: number | 0,
    status: number | 0,
    protectCoin: boolean | false,
    protectWater: boolean | false,
    protectFruit: boolean | false,
    shieldTimes: number | 0,
    nextTimeToPick: number | 0,
}