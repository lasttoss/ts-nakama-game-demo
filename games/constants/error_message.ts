const ErrorMessage = {
    notUpdateUserInventory(): nkruntime.Error {
        return {
            code: 1002,
            message: "not update user_en inventory"
        }
    },
    notFoundAccountInfo(): nkruntime.Error {
        return {
            code: 1003,
            message: "not found account info"
        }
    },
    plantIsGrowing(): nkruntime.Error {
        return {
            code: 1004,
            message: "Plant is growing",
        }
    },
    clientSendBadData(): nkruntime.Error {
        return {
            code: 1005,
            message: "Client send bad data"
        }
    },
    canNotPickingFruits(): nkruntime.Error {
        return {
            code: 1006,
            message: "Cannot picking fruits now"
        }
    },
    notUpdateUserPlanProgress(): nkruntime.Error {
        return {
            code: 1007,
            message: "Not update user_en plan progress"
        }
    },
    notEnoughToSow(): nkruntime.Error {
        return {
            code: 1008,
            message: "Not enough to sow"
        }
    },
    notIsGrowingStatus(): nkruntime.Error {
        return {
            code: 1009,
            message: "Not is growing status"
        }
    },
    notEnoughDropOfWater(): nkruntime.Error {
        return {
            code: 1010,
            message: "Not enough drop of water"
        }
    },
    expIsMax(): nkruntime.Error {
        return {
            code: 1011,
            message: 'Exp is reached max',
        }
    },
    invalidParameterPayload(): nkruntime.Error {
        return {
            code: 1012,
            message: 'Invalid parameter payload'
        }
    },
    itemNotFound(): nkruntime.Error {
        return {
            code: 1014,
            message: "item not found"
        }
    },
    notUpdateUserEnergy(): nkruntime.Error {
        return {
            code: 1015,
            message: "Not update user energy"
        }
    },
    notUpdateWallet(): nkruntime.Error {
        return {
            code: 1017,
            message: "Not update wallet"
        }
    },
    invalidResource(): nkruntime.Error {
        return {
            code: 1018,
            message: "Invalid resource"
        }
    },
    invalidItemId(): nkruntime.Error {
        return {
            code: 1019,
            message: "Invalid item id"
        }
    },
    notUpdateAccount(): nkruntime.Error {
        return {
            code: 1020,
            message: "Not update account"
        }
    },
    hasBeenUseShieldToProtect(): nkruntime.Error {
        return {
            code: 1037,
            message: "Has been use shield to protect"
        }
    },
    notEnoughShieldToProtect(): nkruntime.Error {
        return {
            code: 1038,
            message: "Not enough shield to protect"
        }
    },
    timeToPickingNotOpen(): nkruntime.Error {
        return {
            code: 1041,
            message: "Time to picking not open"
        }
    },
    maxToSpray(): nkruntime.Error {
        return {
            code: 1052,
            message: "Max to spray water"
        }
    },
    notEnoughWatering(): nkruntime.Error {
        return {
            code: 1054,
            message: "Not enough water to spray"
        }
    },
    sessionNotFound(): nkruntime.Error {
        return {
            code: 1069,
            message: "session not found"
        }
    }
}
