function initializeAuthenticateDevice(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, out: nkruntime.Session, data: nkruntime.AuthenticateCustomRequest): nkruntime.Session {
    if (!ctx.userId) {
        throw ErrorMessage.notFoundAccountInfo()
    }
    initWallet(nk, ctx, logger, ctx.userId)
    return out
}

function initWallet(nk: nkruntime.Nakama, ctx: nkruntime.Context, logger: nkruntime.Logger, userId: string) {
    let account = null
    try {
        account = nk.accountGetId(userId)
    } catch (error) {
        throw ErrorMessage.notFoundAccountInfo();
    }
    if (account.user.metadata["hasInit"] === undefined || !account.user.metadata["hasInit"]) {
        const changeSet = {
            "coin": 0,
        };
        const walletMetadata = {}
        const userMetadata = {
            hasInit: true,
            vip: 0,
            isSound: true,
            isMusic: true,
        }
        try {
            nk.walletUpdate(userId, changeSet, walletMetadata, true);
        } catch (error) {
            throw ErrorMessage.notUpdateWallet();
        }

        const displayName = "DEFAULT DEFAULT"
        const avatarUrl = "https://assets.dy.io/avatars/default.png"

        try {
            nk.accountUpdateId(account.user.userId, null, displayName, null, null, null, avatarUrl, userMetadata)
        } catch (error) {
            throw ErrorMessage.notUpdateAccount();
        }
    }
}