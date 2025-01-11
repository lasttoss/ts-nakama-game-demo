function getCurrentTimeServerHandle(nk: nkruntime.Nakama, logger: nkruntime.Logger, state: State, dispatcher: nkruntime.MatchDispatcher, message: nkruntime.MatchMessage) {
    let response = {} as MatchCurrentTimeServer
    response.currentTime = getCurrentTime()
    dispatcher.broadcastMessage(OpCode.GET_CURRENT_TIME_SERVER, JSON.stringify(response), null, null, false)
}