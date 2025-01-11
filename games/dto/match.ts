import Wallet = nkruntime.Wallet;

const moduleName = "dy";
const tickRate = 5;
const maxEmptySec = 30;
const limitRoom = 1;

interface State {
    label: string,
    userId: string,
    emptyTicks: number
    presences: { [userId: string]: nkruntime.Presence | null }
    joinsInProgress: number,
    matchStatus: number,
    nextTimeGetADropOfWater: number
}

interface MatchUserInfo {
    progress: UserPlantProgressDTO,
    inventories: { [itemId: string]: UserInventoryModel },
    wateringCan: UserWateringCanModel,
    wallet: Wallet
}

interface SprayWaterRequest {
    quantity: number
}

interface SowSeedingRequest {
    itemId: string
}

interface PickingToProtectRequest {
    type: number
}

interface MatchCurrentTimeServer {
    currentTime: number
}