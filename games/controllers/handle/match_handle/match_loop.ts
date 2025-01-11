let matchLoop: nkruntime.MatchLoopFunction<State> = function (
    ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher,
    tick: number, state: State, messages: nkruntime.MatchMessage[]) {
    if (connectedPlayers(state) + state.joinsInProgress === 0) {
        state.emptyTicks++;
        if (state.emptyTicks >= maxEmptySec * tickRate) {
            // Match has been empty for too long, close it.
            logger.info('closing idle match');
            return null;
        }
    }

    // check watering can
    checkWateringCanHandle(nk, logger, state, dispatcher)

    if (state.matchStatus == OpCode.START) {
        for (const message of messages) {
            switch (message.opCode) {
                case OpCode.USER_INFO: {
                    getUserInfoHandle(nk, logger, state, dispatcher, message)
                    break
                }
                case OpCode.SOW_SEED: {
                    sowSeedHandle(nk, logger, state, dispatcher, message)
                    break
                }
                case OpCode.GET_CURRENT_TIME_SERVER: {
                    getCurrentTimeServerHandle(nk, logger, state, dispatcher, message)
                    break;
                }
                case OpCode.PICKING_FRUITS: {
                    pickingFruitHandle(nk, logger, state, dispatcher, message)
                    break
                }
                case OpCode.SPRAY_WATER: {
                    sprayWaterHandle(nk, logger, state, dispatcher, message)
                    break
                }
                case OpCode.UPDATE_PROGRESS: {
                    updateProgressHandle(nk, logger, state, dispatcher, message)
                    break
                }
                case OpCode.PICKING_TO_PROTECT: {
                    pickingProtectHandle(nk, logger, state, dispatcher, message)
                    break
                }
                default:
                    break
            }
        }
    }

    return {
        state
    }
}