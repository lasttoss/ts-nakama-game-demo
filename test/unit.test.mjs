// Unit tests for the plugin that Nakama loads.
//
// The project is written the template way: every file is a global script that TypeScript
// concatenates into one bundle (outFile), so the functions are not importable. Instead these
// tests run the shipped artefact - build/index.js - inside a fresh VM context and call what the
// server would call. That way the tests exercise the bundle that actually loads, not a private
// copy of the sources.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const bundle = readFileSync(fileURLToPath(new URL('../build/index.js', import.meta.url)), 'utf8')

// load runs the bundle in a context of its own. Pass `now` (seconds) to freeze the clock for the
// functions that read it, which is the only way to assert on anything time shaped.
function load({ now, storageItems } = {}) {
  const sandbox = {}

  if (now !== undefined) {
    const RealDate = Date
    const fixed = now * 1000
    function FixedDate(...args) {
      return args.length === 0 ? new RealDate(fixed) : new RealDate(...args)
    }
    FixedDate.now = () => fixed
    FixedDate.parse = RealDate.parse
    FixedDate.UTC = RealDate.UTC
    FixedDate.prototype = RealDate.prototype
    sandbox.Date = FixedDate
  }

  if (storageItems !== undefined) {
    sandbox.__items = storageItems
  }

  vm.createContext(sandbox)
  vm.runInContext(bundle, sandbox)
  return sandbox
}

// nk is a stand-in for the Nakama runtime object: the config repositories only read storage, so
// that is all this has to answer.
function fakeNk(items) {
  return {
    storageRead: (requests) => requests.map(() => ({ value: { data: items } })),
  }
}

const utc = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min) / 1000
const isUtc = process.env.TZ === 'UTC'

test('the bundle loads and exposes the match module the server registers', () => {
  const ctx = load()
  assert.equal(typeof ctx.InitModule, 'function')
  assert.equal(typeof ctx.joinPrivateRoom, 'function')
  assert.equal(typeof ctx.matchInit, 'function')
})

test('findPrivateRoom reuses the room this player owns', () => {
  const ctx = load()
  const matches = [
    { matchId: 'aaa', label: 'userId:someone-else' },
    { matchId: 'bbb', label: 'userId:ada' },
  ]
  assert.equal(ctx.findPrivateRoom(matches, 'ada'), 'bbb')
  assert.equal(ctx.privateRoomLabel('ada'), 'userId:ada')
})

test('findPrivateRoom never reuses another player room whose label merely starts the same', () => {
  const ctx = load()
  // the bug this guards: a substring or prefix match would put ada into ada2's room
  const matches = [
    { matchId: 'ada2-room', label: 'userId:ada2' },
    { matchId: 'adaline', label: 'userId:adaline' },
  ]
  assert.equal(ctx.findPrivateRoom(matches, 'ada'), '')
  // and the reverse direction too
  assert.equal(ctx.findPrivateRoom([{ matchId: 'x', label: 'userId:ada' }], 'ada2'), '')
})

test('findPrivateRoom reports no room when the registry has not caught up', () => {
  const ctx = load()
  assert.equal(ctx.findPrivateRoom([], 'ada'), '')
  assert.equal(ctx.findPrivateRoom([{ matchId: 'a', label: '' }], 'ada'), '')
})

test('connectedPlayers counts the presences in a room state', () => {
  const ctx = load()
  assert.equal(ctx.connectedPlayers({ presences: {} }), 0)
  assert.equal(ctx.connectedPlayers({ presences: { a: {}, b: {}, c: {} } }), 3)
})

test('getRandomInt stays inside its range and is inclusive of the maximum', () => {
  const ctx = load()
  const seen = new Set()
  for (let i = 0; i < 2000; i++) {
    const v = ctx.getRandomInt(6)
    assert.ok(v >= 1 && v <= 6, `getRandomInt(6) = ${v}`)
    seen.add(v)
  }
  // a caller that expects 1..max gets every value, not just the low ones
  assert.equal(seen.size, 6)
})

test('numberWithCommas formats amounts the way the client shows them', () => {
  const ctx = load()
  assert.equal(ctx.numberWithCommas(0), '0')
  assert.equal(ctx.numberWithCommas(999), '999')
  assert.equal(ctx.numberWithCommas(1000), '1,000')
  assert.equal(ctx.numberWithCommas(1234567), '1,234,567')
  assert.equal(ctx.numberWithCommas(1234.5), '1,234.5')
})

test('the clock helpers read the process clock', () => {
  const now = utc(2024, 6, 15, 12, 30)
  const ctx = load({ now })

  assert.equal(ctx.getCurrentTime(), now)
  assert.equal(ctx.getCurrentTimeWithMilliseconds(), now * 1000)
})

test('the end of the day is the next midnight, not the end of the hour', () => {
  const now = utc(2024, 6, 15, 12, 30)
  const ctx = load({ now })
  const eod = ctx.getEndOfDay()

  const at = new Date(eod * 1000)
  assert.equal(at.getHours(), 0)
  assert.equal(at.getMinutes(), 0)
  assert.equal(at.getSeconds(), 0)
  assert.ok(eod > now && eod <= now + 86400, `end of day ${eod} is not within a day of ${now}`)
  if (isUtc) assert.equal(eod, utc(2024, 6, 16))
})

test('the season clock is trimmed to the hour it belongs to', () => {
  const now = utc(2024, 6, 15, 12, 30)
  const ctx = load({ now })
  const season = ctx.getCurrentSeasonTime()

  const at = new Date(season * 1000)
  assert.equal(at.getMinutes(), 0)
  assert.equal(at.getSeconds(), 0)
  assert.ok(season <= now && now - season < 3600, `season ${season} is not within the hour of ${now}`)
  if (isUtc) assert.equal(season, utc(2024, 6, 15, 12))
})

test('the week number is in range and grows with the calendar', () => {
  const week = (now) => load({ now }).getCurrentWeek()

  assert.ok(week(utc(2024, 1, 15)) >= 1 && week(utc(2024, 1, 15)) <= 53)
  assert.ok(week(utc(2024, 12, 20)) >= week(utc(2024, 6, 15)))
  if (isUtc) assert.equal(week(utc(2024, 1, 1)), 1)
})

test('mappingToUserEnergyDTO copies the model and stamps the current time', () => {
  const now = utc(2024, 6, 15, 12, 30)
  const ctx = load({ now })
  const model = { currentEnergy: 7, maxEnergy: 20, nextTimeToReset: now + 60 }

  const dto = ctx.mappingToUserEnergyDTO(model)
  assert.equal(dto.currentEnergy, 7)
  assert.equal(dto.maxEnergy, 20)
  assert.equal(dto.nextTimeToReset, now + 60)
  assert.equal(dto.currentTime, now)
  // the mapper reads, it does not write
  assert.deepEqual(model, { currentEnergy: 7, maxEnergy: 20, nextTimeToReset: now + 60 })
})

test('mappingToUserPlantProgressDTO keeps every field the client needs to draw the plot', () => {
  const now = utc(2024, 6, 15, 12, 30)
  const ctx = load({ now })
  const model = {
    itemId: 'seed-carrot', plantId: 3, currentFruit: 2, currentExp: 10, currentLevel: 4,
    maxExp: 100, status: 1, protectCoin: true, protectWater: false, protectFruit: true,
    shieldTimes: 2, nextTimeToPick: now + 900,
  }

  const dto = ctx.mappingToUserPlantProgressDTO(model)
  for (const key of Object.keys(model)) {
    assert.deepEqual(dto[key], model[key], `field ${key} was lost in the mapping`)
  }
  assert.equal(dto.currentTime, now)
})

test('mappingToListShop hides the rows that are not on sale and joins the item config', () => {
  const items = [
    { id: 'seed-carrot', resourceType: 1, resourceId: 10, name: 'Carrot seed', describe: '', imageUrl: '' },
    { id: 'water-can', resourceType: 2, resourceId: 11, name: 'Watering can', describe: '', imageUrl: '' },
  ]
  const ctx = load({ storageItems: items })
  const nk = fakeNk(items)

  const shop = [
    { id: 'row-1', amount: 5, status: 0, itemId: 'seed-carrot', price: 100 },
    { id: 'row-2', amount: 1, status: 1, itemId: 'water-can', price: 500 },   // withdrawn
    { id: 'row-3', amount: 2, status: 0, itemId: 'water-can', price: 300 },
  ]

  const dto = ctx.mappingToListShop(nk, shop)
  assert.equal(dto.length, 2, 'a withdrawn row must not reach the shop')
  // the values come from a VM context, so they are arrays of another realm: compare the contents
  assert.equal(dto[0].id + "," + dto[1].id, "row-1,row-3")
  assert.equal(dto[0].item.name, 'Carrot seed')
  assert.equal(dto[0].price, 100)
  assert.equal(dto[1].item.id, 'water-can')
})

test('mappingToListShop survives an empty item config instead of throwing', () => {
  const ctx = load({ storageItems: [] })
  const nk = {
    storageRead: () => null, // the collection has no rows yet
  }
  const dto = ctx.mappingToListShop(nk, [{ id: 'row-1', amount: 1, status: 0, itemId: 'nope', price: 1 }])
  assert.equal(dto.length, 1)
  assert.equal(dto[0].item, undefined)
})

// ---------------------------------------------------------------------------------------------
// The handlers: the rules the server runs against storage.
//
// These are called the way the match loop calls them - nk, logger, state, dispatcher, message -
// with storage, the clock and the dispatcher in the test's hands. The fake nk the earlier tests
// use answers every read with the same object, which is fine for the config repositories on their
// own; a handler reads four collections at once, so this one answers by collection and key.
// ---------------------------------------------------------------------------------------------

// gameNk answers storage reads from a nested map - storage[collection][key] - and remembers what is
// written back, which is how the tests see state the player would see on the next tick.
function gameNk(ctx, storage, { writes = [], account = { wallet: { coins: 0 } } } = {}) {
  return {
    storageRead: (requests) =>
      requests.flatMap((req) => {
        const collection = storage[req.collection]
        if (collection === undefined || collection[req.key] === undefined) return []
        // A copy, because that is what a storage read is: the runtime hands over something the handler
        // can mutate without changing what is stored. Returning the stored object itself made a
        // mutation indistinguishable from a write, which is exactly the difference these tests are for.
        return [{ value: { data: JSON.parse(JSON.stringify(collection[req.key])) } }]
      }),
    storageWrite: (requests) => {
      for (const req of requests) {
        writes.push(req)
        if (storage[req.collection] === undefined) storage[req.collection] = {}
        storage[req.collection][req.key] = req.value.data
      }
    },
    accountGetId: () => account,
    binaryToString: (data) => data,
  }
}

const quietLogger = { error: () => {}, info: () => {}, warn: () => {}, debug: () => {} }

// The fake dispatcher answers what the handlers actually call. matchJoin also updates the match label
// when the room fills up, so this records that too - the first run of these tests died on
// "dispatcher.matchLabelUpdate is not a function", which is the fake being thinner than the runtime.
function recordingDispatcher() {
  const sent = []
  const labels = []
  return {
    sent,
    labels,
    broadcastMessage: (opCode, data) => sent.push({ opCode, data: JSON.parse(data) }),
    matchLabelUpdate: (label) => labels.push(label),
  }
}

// game assembles a player with a plant in the ground and a can, plus the system config a handler
// needs, and returns everything a test wants to poke at afterwards.
function game({ now = 1_700_000_000, plant = {}, can = {}, inventory = {}, seeds = null, countdown = null, items = null } = {}) {
  const ctx = load({ now })
  const storage = {}
  const writes = []
  // the shape matchInit builds, because the match functions read all of it: presences and emptyTicks
  // are what the loop and the join touch before they touch anything else
  const state = { label: 'userId:ada', userId: 'ada', emptyTicks: 0, presences: {}, joinsInProgress: 0,
                  nextTimeGetADropOfWater: now, matchStatus: ctx.OpCode.INIT_RESOURCES }
  const dispatcher = recordingDispatcher()
  const nk = gameNk(ctx, storage, { writes })

  storage[ctx.tableConfigs.USER_PLANT_PROGRESS_COLLECTION] = {
    [ctx.tableConfigs.USER_PLANT_PROGRESS_KEY]: {
      plantId: 1, itemId: 'seed-1', currentExp: 0, currentLevel: 1, currentFruit: 0,
      maxExp: 10, status: ctx.PlanStatus.IS_GROWING, protectCoin: false, protectWater: false,
      protectFruit: false, shieldTimes: 0, nextTimeToPick: 0, ...plant,
    },
  }
  storage[ctx.tableConfigs.USER_WATERING_CAN_COLLECTION] = {
    [ctx.tableConfigs.USER_WATERING_CAN_KEY]: { wateringCan: 20, nextTimeGetADropOfWater: now, ...can },
  }
  storage[ctx.tableConfigs.USER_INVENTORY_COLLECTION] = { [ctx.tableConfigs.USER_INVENTORY_KEY]: inventory }
  storage[ctx.tableConfigs.SYSTEM_COLLECTION] = {}
  if (seeds !== null) storage[ctx.tableConfigs.SYSTEM_COLLECTION][ctx.tableConfigs.SYSTEM_SEED_CONFIG_KEY] = seeds
  if (countdown !== null) storage[ctx.tableConfigs.SYSTEM_COLLECTION][ctx.tableConfigs.SYSTEM_PICKING_FRUIT_COUNTDOWN_CONFIG] = countdown
  if (items !== null) storage[ctx.tableConfigs.SYSTEM_COLLECTION][ctx.tableConfigs.SYSTEM_ITEM_CONFIG_KEY] = items

  return {
    ctx, nk, state, dispatcher, storage, writes,
    plant: () => storage[ctx.tableConfigs.USER_PLANT_PROGRESS_COLLECTION][ctx.tableConfigs.USER_PLANT_PROGRESS_KEY],
    can: () => storage[ctx.tableConfigs.USER_WATERING_CAN_COLLECTION][ctx.tableConfigs.USER_WATERING_CAN_KEY],
    errors: () => dispatcher.sent.filter((m) => m.opCode === ctx.OpCode.ERROR).map((m) => m.data),
    userInfo: () => dispatcher.sent.filter((m) => m.opCode === ctx.OpCode.USER_INFO).map((m) => m.data),
    sprayWater: (quantity) => ctx.sprayWaterHandle(nk, quietLogger, state, dispatcher, { data: JSON.stringify({ quantity }) }),
    pickFruit: () => ctx.pickingFruitHandle(nk, quietLogger, state, dispatcher, { data: '{}' }),
    checkWateringCan: () => ctx.checkWateringCanHandle(nk, quietLogger, state, dispatcher),
    sowSeed: (itemId) => ctx.sowSeedHandle(nk, quietLogger, state, dispatcher, { data: JSON.stringify({ itemId }) }),
    protect: (type) => ctx.pickingProtectHandle(nk, quietLogger, state, dispatcher, { data: JSON.stringify({ type }) }),
    join: (presences = [{ userId: state.userId }]) => ctx.matchJoin({ userId: state.userId, matchId: 'm1' }, quietLogger, nk, dispatcher, 1, state, presences),
    loopTick: (messages = []) => ctx.matchLoop({ userId: state.userId, matchId: 'm1' }, quietLogger, nk, dispatcher, 1, state, messages),
    message: (opCode, body = {}) => ({ opCode, sender: { userId: state.userId }, data: JSON.stringify(body) }),
  }
}

// Errors travel to the client as JSON, and the objects either side of these assertions were made in
// different VM contexts - the bundle's ErrorMessage makes its own - so they are compared as JSON rather
// than by prototype, which is what strict deep equality is checking when it says the values have the
// same structure but are not reference-equal.
function sameJson(actual, expected) {
  assert.equal(JSON.stringify(actual), JSON.stringify(expected))
}

// The two constants the Java side of this project now mirrors. Pinned here because they are the
// whole rule: five minutes a drop, twenty is full.
test('the watering can constants are the five minutes and the twenty that the API mirrors', () => {
  const ctx = load()
  assert.equal(ctx.EXPIRE_TIME_GET_NEXT_A_DROP_OF_WATER, 5 * 60)
  assert.equal(ctx.MAX_WATERING_CAN, 20)
})

// --- the can filling over time -----------------------------------------------------------------

test('a can that has waited gets the drops it waited for', () => {
  // five, and ten minutes have gone by: three drops, not two - the drop for the interval the anchor
  // is sitting in is counted as well
  const g = game({ can: { wateringCan: 5, nextTimeGetADropOfWater: 1_700_000_000 - 600 } })

  g.checkWateringCan()

  assert.equal(g.can().wateringCan, 8)
  assert.equal(g.can().nextTimeGetADropOfWater, 1_700_000_000 + 300, 'the anchor moves one interval ahead of now')
  assert.equal(g.state.nextTimeGetADropOfWater, 1_700_000_000 + 300, 'and the match state is told')
  assert.equal(g.userInfo().length, 1, 'the player is told what they have now')
})

test('the drops stop at the ceiling however long the wait was', () => {
  const g = game({ can: { wateringCan: 19, nextTimeGetADropOfWater: 1_700_000_000 - 3_600 } })

  g.checkWateringCan()

  assert.equal(g.can().wateringCan, 20, 'an hour is twelve drops and only one fits')
  assert.equal(g.can().nextTimeGetADropOfWater, 1_700_000_000 + 300)
})

test('a full can gets nothing and starts its clock again', () => {
  const g = game({ can: { wateringCan: 20, nextTimeGetADropOfWater: 1_700_000_000 - 3_600 } })

  g.checkWateringCan()

  assert.equal(g.can().wateringCan, 20)
  assert.equal(g.can().nextTimeGetADropOfWater, 1_700_000_000 + 300,
    'an hour spent full is not paid out later: the anchor moves on to now + one interval')
})

test('a can that is not due yet is not touched at all', () => {
  const g = game({ can: { wateringCan: 5, nextTimeGetADropOfWater: 1_700_000_000 + 60 } })
  g.state.nextTimeGetADropOfWater = 1_700_000_000 + 60

  g.checkWateringCan()

  assert.equal(g.can().wateringCan, 5)
  assert.equal(g.writes.length, 0, 'nothing was written')
  assert.equal(g.dispatcher.sent.length, 0, 'and nothing was sent')
})

// Recorded, not fixed: the guard reads the match state and the arithmetic reads the stored row, so
// a state that is due while storage is not subtracts drops the player never spent. The paths that
// write the state keep the two within one interval of each other, which is why this cannot happen
// today and why the test says so rather than the code being changed on a suspicion.
test('a state that disagrees with storage can take water away', () => {
  const g = game({ can: { wateringCan: 5, nextTimeGetADropOfWater: 1_700_000_000 + 900 } })
  g.state.nextTimeGetADropOfWater = 1_700_000_000 // due, according to the match state

  g.checkWateringCan()

  assert.equal(g.can().wateringCan, 3, 'floor(-900/300) + 1 is -2: the can went backwards')
})

// --- watering a plant --------------------------------------------------------------------------

test('watering takes water out of the can and puts experience in the plant', () => {
  const g = game({ seeds: [{ plantId: 1, requiredExp: [10, 20] }] })

  g.sprayWater(2)

  assert.equal(g.can().wateringCan, 18)
  assert.equal(g.plant().currentExp, 2)
  assert.equal(g.plant().status, g.ctx.PlanStatus.IS_GROWING, 'two experience is not the ten this plant needs')
  assert.equal(g.errors().length, 0)
  assert.equal(g.userInfo().length, 1)
})

test('watering is refused when the can holds less than the request', () => {
  const g = game({ can: { wateringCan: 2 } })

  g.sprayWater(5)

  sameJson(g.errors(), [g.ctx.ErrorMessage.notEnoughWatering()])
  assert.equal(g.can().wateringCan, 2, 'and nothing is spent on a refusal')
  assert.equal(g.plant().currentExp, 0)
})

test('watering is refused when the plant is not growing', () => {
  const g = game({ plant: { status: 0 } }) // CAN_SOW

  g.sprayWater(2)

  sameJson(g.errors(), [g.ctx.ErrorMessage.notIsGrowingStatus()])
})

test('watering is refused for a quantity that is not a quantity', () => {
  const g = game()

  g.sprayWater(0)

  sameJson(g.errors(), [g.ctx.ErrorMessage.invalidParameterPayload()])
  assert.equal(g.can().wateringCan, 20)
})

test('watering is refused when it would overshoot the plant', () => {
  // five in, sixteen asked for, and the last required exp of this plant is twenty
  const g = game({ plant: { currentExp: 5 }, seeds: [{ plantId: 1, requiredExp: [10, 20] }] })

  g.sprayWater(16)

  sameJson(g.errors(), [g.ctx.ErrorMessage.maxToSpray()])
})

test('the last water finishes the plant and starts its countdown', () => {
  const g = game({ seeds: [{ plantId: 1, requiredExp: [10, 20] }], countdown: { fruitTimeCountdown: [60, 120] } })

  g.sprayWater(10)

  assert.equal(g.plant().currentExp, 10)
  assert.equal(g.plant().status, g.ctx.PlanStatus.COMPLETED)
  assert.equal(g.plant().nextTimeToPick, 1_700_000_000 + 60, 'the countdown of this plant, not the first one in the list')
  // recorded rather than explained: the level and the fruit count are literals
  assert.equal(g.plant().currentLevel, 5)
  assert.equal(g.plant().currentFruit, 3)
})

// --- the countdown, which is the rule the API had the other way round ---------------------------

test('the plant cannot be picked before its countdown is up', () => {
  const g = game({ plant: { status: 2, nextTimeToPick: 1_700_000_000 + 60 } }) // COMPLETED, a minute to go

  g.pickFruit()

  sameJson(g.errors(), [g.ctx.ErrorMessage.timeToPickingNotOpen()])
})

// The pair that matters: the same plant one second later is not refused for waiting. It may still
// fail for something else - the fruit item is not in this fixture - but the countdown is behind it.
test('the plant is not refused for waiting once the countdown is up', () => {
  const g = game({ plant: { status: 2, nextTimeToPick: 1_700_000_000 - 1 } }) // COMPLETED, a second ago

  g.pickFruit()

  const codes = g.errors()
  assert.equal(codes.some((e) => JSON.stringify(e) === JSON.stringify(g.ctx.ErrorMessage.timeToPickingNotOpen())), false,
    'the countdown has passed and it is still being told to wait')
  assert.equal(codes.some((e) => JSON.stringify(e) === JSON.stringify(g.ctx.ErrorMessage.canNotPickingFruits())), false,
    'the plant is completed')
})

// --- sowing ------------------------------------------------------------------------------------

// The config is keyed by item, the inventory by variant: "seed-1" in the bag is "seed" in the config,
// and the handler trims the last dash-separated part to get from one to the other.
const seedItems = [{ id: 'seed', resourceType: 2 /* SEED_TYPE */, resourceId: 1 }]
const oneSeedPlant = [{ plantId: 1, requiredExp: [10, 20] }]

test('sowing puts the seed in the ground and takes it out of the bag', () => {
  const g = game({ plant: { status: 0 }, inventory: { 'seed-1': { itemId: 'seed-1', quantity: 3 } }, items: seedItems, seeds: oneSeedPlant })

  g.sowSeed('seed-1')

  assert.equal(g.plant().status, g.ctx.PlanStatus.IS_GROWING)
  assert.equal(g.plant().plantId, 1)
  assert.equal(g.plant().currentExp, 0)
  assert.equal(g.plant().maxExp, 20, 'maxExp is the last required exp in the config, not the first')
  assert.equal(g.plant().itemId, 'seed', 'the plant remembers the config item, not the variant in the bag')
  const bag = g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]
  assert.equal(bag['seed-1'].quantity, 2)
})

test('the last seed leaves the bag empty rather than at zero', () => {
  const g = game({ plant: { status: 0 }, inventory: { 'seed-1': { itemId: 'seed-1', quantity: 1 } }, items: seedItems, seeds: oneSeedPlant })

  g.sowSeed('seed-1')

  const bag = g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]
  assert.equal(bag['seed-1'], undefined, 'a row of zero is gone, not kept')
})

test('sowing is refused while a plant is already in the ground', () => {
  const g = game({ inventory: { 'seed-1': { itemId: 'seed-1', quantity: 3 } }, items: seedItems })

  g.sowSeed('seed-1')

  sameJson(g.errors(), [g.ctx.ErrorMessage.plantIsGrowing()])
  assert.equal(g.plant().plantId, 1, 'the plant that was already there is untouched')
  assert.equal(g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]['seed-1'].quantity, 3)
})

// The handler trims the variant off: "seed-3" in the bag is the "seed" of the config, so a variant the
// config has never heard of still sows. What lands in the bag and what the config is keyed by are
// different words for the same thing, and this is the pair of tests that says which one is which.
test('a seed variant the config does not list is still the seed the config lists', () => {
  const g = game({ plant: { status: 0 }, inventory: { 'seed-3': { itemId: 'seed-3', quantity: 1 } }, items: seedItems, seeds: oneSeedPlant })

  g.sowSeed('seed-3')

  assert.equal(g.errors().length, 0)
  assert.equal(g.plant().status, g.ctx.PlanStatus.IS_GROWING)
  assert.equal(g.plant().plantId, 1)
})

test('sowing is refused for an item the config does not know', () => {
  const g = game({ plant: { status: 0 }, inventory: { 'rock-1': { itemId: 'rock-1', quantity: 1 } }, items: seedItems, seeds: oneSeedPlant })

  g.sowSeed('rock-1')

  sameJson(g.errors(), [g.ctx.ErrorMessage.invalidItemId()])
})

test('sowing is refused for an item that is not a seed', () => {
  const g = game({
    plant: { status: 0 },
    inventory: { 'fruit-1': { itemId: 'fruit-1', quantity: 1 } },
    items: [{ id: 'fruit', resourceType: 5 /* FRUIT_REWARD_TYPE */, resourceId: 1 }],
    seeds: oneSeedPlant,
  })

  g.sowSeed('fruit-1')

  sameJson(g.errors(), [g.ctx.ErrorMessage.invalidResource()])
})

test('sowing is refused when there is no seed left in the bag', () => {
  const g = game({ plant: { status: 0 }, inventory: {}, items: seedItems, seeds: oneSeedPlant })

  g.sowSeed('seed-1')

  sameJson(g.errors(), [g.ctx.ErrorMessage.notEnoughToSow()])
})

// --- picking a fruit ---------------------------------------------------------------------------

// Recorded: picking resets the plant and hands over nothing. There is no fruit item, no rate table and
// no add to the inventory in pickingFruitHandle - it writes the inventory it read back unchanged - and
// nothing else in this repository reads FRUIT_REWARD_TYPE or gives a fruit, so the pick is a reset.
// The Java API in legacy/quarkus-game-api does hand one over, picked by rate, which is how the two
// implementations came to differ. Whether this one is unfinished or the reward arrives from elsewhere
// is not something the code says.
test('picking clears the plant and hands over no fruit', () => {
  const g = game({ plant: { status: 2, nextTimeToPick: 1_700_000_000 - 1, currentFruit: 3, maxExp: 20 } })

  g.pickFruit()

  assert.equal(g.plant().status, g.ctx.PlanStatus.CAN_SOW)
  assert.equal(g.plant().plantId, 0)
  assert.equal(g.plant().maxExp, 0)
  assert.equal(g.plant().currentFruit, 0, 'the three fruit the plant was carrying are gone')
  assert.deepEqual(g.userInfo()[0].inventories, {}, 'the player is told they have nothing they did not have before')
})

// --- protecting --------------------------------------------------------------------------------

// The shield is found by resource id, so the fixture asks the constants rather than guessing the number:
// the first attempt used 1 and every protect test came back with itemNotFound.
const shieldResourceId = load().ConsumeResource.SHIELD
const shields = [{ id: 'shield-1', resourceType: 3 /* CONSUME_TYPE */, resourceId: shieldResourceId }]

test('protecting costs a shield and marks the plant', () => {
  const g = game({ inventory: { 'shield-1': { itemId: 'shield-1', quantity: 2 } }, items: shields })

  g.protect(g.ctx.ProtectType.COIN)

  assert.equal(g.plant().protectCoin, true)
  assert.equal(g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]['shield-1'].quantity, 1)
})

test('protecting the same thing twice is refused', () => {
  const g = game({ plant: { protectWater: true }, inventory: { 'shield-1': { itemId: 'shield-1', quantity: 2 } }, items: shields })

  g.protect(g.ctx.ProtectType.WATER)

  sameJson(g.errors(), [g.ctx.ErrorMessage.hasBeenUseShieldToProtect()])
  assert.equal(g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]['shield-1'].quantity, 2, 'and the shield is not spent on a refusal')
})

test('protecting is refused with no shield in the bag', () => {
  const g = game({ inventory: {}, items: shields })

  g.protect(g.ctx.ProtectType.COIN)

  sameJson(g.errors(), [g.ctx.ErrorMessage.notEnoughShieldToProtect()])
})

test('protecting is refused for a type that is not one', () => {
  const g = game({ inventory: { 'shield-1': { itemId: 'shield-1', quantity: 1 } }, items: shields })

  g.protect(4)

  sameJson(g.errors(), [g.ctx.ErrorMessage.invalidParameterPayload()])
  assert.equal(g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]['shield-1'].quantity, 1)
})

// Recorded, and the same shape as the unknown protect type the API README records - except that here
// the shield is spent. Type 0 passes the range check, the switch has a default that does nothing, and
// the line that takes the shield out of the bag runs after the switch whatever happened in it.
test('protecting with type zero spends a shield and protects nothing', () => {
  const g = game({ inventory: { 'shield-1': { itemId: 'shield-1', quantity: 2 } }, items: shields })

  g.protect(0) // ProtectType.NONE

  assert.equal(g.errors().length, 0, 'it is answered as success')
  assert.equal(g.plant().protectCoin, false)
  assert.equal(g.plant().protectWater, false)
  assert.equal(g.plant().protectFruit, false)
  assert.equal(g.storage[g.ctx.tableConfigs.USER_INVENTORY_COLLECTION][g.ctx.tableConfigs.USER_INVENTORY_KEY]['shield-1'].quantity, 1,
    'and the shield is gone')
})

// Recorded: the API refuses to protect a plant that is not ripe, and this handler does not look at the
// status at all - a shield can be spent on a plot with nothing in it.
test('protecting works on a plant that is not even grown', () => {
  const g = game({ plant: { status: 0, plantId: 0 }, inventory: { 'shield-1': { itemId: 'shield-1', quantity: 1 } }, items: shields })

  g.protect(g.ctx.ProtectType.FRUIT)

  assert.equal(g.errors().length, 0)
  assert.equal(g.plant().protectFruit, true, 'an empty plot now carries a fruit protection')
})

// --- the match lifecycle ------------------------------------------------------------------------

test('a match starts with the player the params name', () => {
  const ctx = load()
  const { state, tickRate: rate, label } = ctx.matchInit({}, quietLogger, {}, { userId: 'ada' })

  assert.equal(state.userId, 'ada')
  assert.equal(state.label, 'userId:ada')
  assert.equal(state.matchStatus, ctx.OpCode.INIT_RESOURCES)
  assert.equal(state.nextTimeGetADropOfWater, 0, 'the match state starts without an anchor')
  assert.equal(state.emptyTicks, 0)
  assert.equal(label, 'userId:ada')
  assert.equal(rate, ctx.tickRate)
})

test('joining sends the player their state and asks the match to start', () => {
  const g = game({ plant: { currentExp: 15 }, seeds: oneSeedPlant })
  g.state.matchStatus = g.ctx.OpCode.INIT_RESOURCES

  g.join()

  assert.equal(g.userInfo().length, 1)
  assert.equal(g.state.matchStatus, g.ctx.OpCode.START)
  assert.equal(g.plant().currentLevel, 2, 'fifteen experience is past the first ten and not the second twenty')
  assert.deepEqual(g.dispatcher.labels, ['userId:ada'],
    'one presence is a full private room, so the label is refreshed')
})

// The duplicate the API README warned about has already drifted. checkWateringCanHandle works out the
// drops from the stored row and saves them; this copy works them out from the match state - and saves
// neither, because the line at the end of the block writes the plant progress it did not touch. So the
// two paths that refill a can, one on a tick and one on a join, give different answers, and this pair
// of tests is that difference: same fixture, 5 and 8 against 5 and 5.
test('joining works out the water and then loses it', () => {
  const g = game({ can: { wateringCan: 5, nextTimeGetADropOfWater: 1_700_000_000 - 600 } })
  g.state.nextTimeGetADropOfWater = 1_700_000_000 - 600 // due, and the stored anchor agrees
  g.state.matchStatus = g.ctx.OpCode.START

  g.join()

  assert.equal(g.can().wateringCan, 5, 'the water it worked out was written to the plant progress row instead')
})

test('a tick works out the same water and keeps it', () => {
  const g = game({ can: { wateringCan: 5, nextTimeGetADropOfWater: 1_700_000_000 - 600 } })
  g.state.nextTimeGetADropOfWater = 1_700_000_000 - 600
  g.state.matchStatus = g.ctx.OpCode.START

  g.loopTick()

  assert.equal(g.can().wateringCan, 8, 'the same ten minutes, counted by the other copy')
})

test('a match with nobody in it for long enough closes itself', () => {
  const g = game()
  g.state.matchStatus = g.ctx.OpCode.START
  g.state.presences = {}
  g.state.joinsInProgress = 0
  g.state.emptyTicks = g.ctx.maxEmptySec * g.ctx.tickRate

  assert.equal(g.loopTick(), null)
})

test('a leaving player is struck off the presence list', () => {
  const g = game()
  const left = g.ctx.matchLeave({ matchId: 'm1' }, quietLogger, g.nk, g.dispatcher, 1, g.state, [{ userId: 'ada' }])

  assert.equal(left, null)
  assert.equal(g.state.presences['ada'], null)
})

test('a tick hands a watering message to the watering handler', () => {
  const g = game({ seeds: oneSeedPlant, countdown: { fruitTimeCountdown: [60] } })
  g.state.matchStatus = g.ctx.OpCode.START

  g.loopTick([g.message(g.ctx.OpCode.SPRAY_WATER, { quantity: 3 })])

  assert.equal(g.can().wateringCan, 17)
  assert.equal(g.plant().currentExp, 3)
})

test('a tick ignores an opcode it does not know', () => {
  // both anchors in the future, or the can tick would refill and send a message that has nothing to do
  // with the opcode being ignored
  const g = game({ can: { wateringCan: 20, nextTimeGetADropOfWater: 1_700_000_000 + 60 }, seeds: oneSeedPlant })
  g.state.matchStatus = g.ctx.OpCode.START
  g.state.nextTimeGetADropOfWater = 1_700_000_000 + 60

  g.loopTick([g.message(9999, { quantity: 3 })])

  assert.equal(g.can().wateringCan, 20)
  assert.equal(g.dispatcher.sent.length, 0)
})

// --- energy ------------------------------------------------------------------------------------

function energyGame({ now = 1_700_000_000, energy } = {}) {
  const ctx = load({ now })
  const storage = {
    [ctx.tableConfigs.USER_ENERGY_COLLECTION]: { [ctx.tableConfigs.USER_ENERGY_KEY]: energy },
  }
  const nk = gameNk(ctx, storage)
  return { ctx, nk, energy: () => storage[ctx.tableConfigs.USER_ENERGY_COLLECTION][ctx.tableConfigs.USER_ENERGY_KEY] }
}

// Energy comes back on a clock of its own: three minutes a point, where the can is five, and its own
// ceiling of fifty. Ten minutes is floor(600/180) + 1, which is four.
test('energy comes back with the clock', () => {
  const g = energyGame({ energy: { currentEnergy: 3, maxEnergy: 10, nextTimeToReset: 1_700_000_000 - 600 } })

  const response = JSON.parse(g.ctx.getUserEnergy({ userId: 'ada' }, quietLogger, g.nk, ''))

  assert.equal(response.currentEnergy, 7)
  assert.equal(g.energy().currentEnergy, 7)
  assert.equal(g.energy().nextTimeToReset, 1_700_000_000 + g.ctx.EXPIRE_TIME_TO_GET_NEXT_USER_ENERGY)
  assert.equal(g.ctx.EXPIRE_TIME_TO_GET_NEXT_USER_ENERGY, 3 * 60, 'three minutes, against the can\'s five')
})

// Recorded: filling to the ceiling uses a second constant, EXPIRE_TIME_TO_MAX_NEXT_USER_ENERGY, which
// today holds the same number as the usual interval. The name is written as if a full bar should wait
// longer before its next point, so either the number is a placeholder or the name is a leftover; I wrote
// this test expecting the two to differ and it is the assertion that says they do not.
test('energy that fills to the ceiling moves its clock by the other constant', () => {
  const g = energyGame({ energy: { currentEnergy: 49, maxEnergy: 50, nextTimeToReset: 1_700_000_000 - 600 } })

  const response = JSON.parse(g.ctx.getUserEnergy({ userId: 'ada' }, quietLogger, g.nk, ''))

  assert.equal(response.currentEnergy, 50, 'four points owed, one fitted')
  assert.equal(g.energy().nextTimeToReset, 1_700_000_000 + g.ctx.EXPIRE_TIME_TO_MAX_NEXT_USER_ENERGY)
  assert.equal(g.ctx.EXPIRE_TIME_TO_MAX_NEXT_USER_ENERGY, g.ctx.EXPIRE_TIME_TO_GET_NEXT_USER_ENERGY,
    'the two constants hold the same number today')
})

test('energy refuses to answer without a player', () => {
  const g = energyGame({ energy: { currentEnergy: 1, maxEnergy: 10, nextTimeToReset: 0 } })

  assert.throws(() => g.ctx.getUserEnergy({}, quietLogger, g.nk, ''))
})

// --- what the server registers ------------------------------------------------------------------

// A handler that exists and is not registered is a feature nobody can call, which is a shape this
// project has already turned up twice - a can nothing fills and a flag nothing reads. This is the test
// that would catch the third one.
test('the module registers every rpc and every match function it has', () => {
  const ctx = load()
  const rpcs = {}
  const matches = {}
  let authHook = null
  const initializer = {
    registerRpc: (id, fn) => { rpcs[id] = fn },
    registerMatch: (name, handlers) => { matches[name] = handlers },
    registerAfterAuthenticateDevice: (fn) => { authHook = fn },
  }

  ctx.InitModule({}, quietLogger, {}, initializer)

  assert.deepEqual(Object.keys(rpcs).sort(), [
    ctx.rpcIdFindPrivateRoom,
    ctx.rpcIdListItemsShop,
    ctx.rpcIdListUserInventory,
    ctx.rpcIdUserEnergy,
  ].sort())
  for (const fn of Object.values(rpcs)) assert.equal(typeof fn, 'function')

  assert.equal(typeof matches[ctx.moduleName].matchInit, 'function')
  for (const name of ['matchInit', 'matchJoinAttempt', 'matchJoin', 'matchLeave', 'matchLoop', 'matchTerminate', 'matchSignal']) {
    assert.equal(typeof matches[ctx.moduleName][name], 'function', name + ' is not registered')
  }
  assert.equal(typeof authHook, 'function')
})

// --- joining a match ------------------------------------------------------------------------------

function attempt(g, presence = { userId: 'ada' }) {
  return g.ctx.matchJoinAttempt({ userId: 'ada', sessionId: 's1' }, quietLogger, g.nk, g.dispatcher, 1, g.state, presence, {})
}

test('a player who is not in the match yet is let in', () => {
  const g = game()

  const answer = attempt(g)

  assert.equal(answer.accept, true)
  assert.equal(answer.state.joinsInProgress, 1)
})

test('a player coming back after a disconnect is held while they are counted', () => {
  const g = game()
  g.state.presences = { ada: null } // struck off by matchLeave

  const answer = attempt(g)

  assert.equal(answer.accept, false)
  assert.equal(answer.state.joinsInProgress, 1)
  assert.equal(answer.rejectMessage, undefined, 'nothing to reject: they are being let back in')
})

test('a player already in the match cannot join it again', () => {
  const g = game()
  g.state.presences = { ada: { userId: 'ada' } }

  const answer = attempt(g)

  assert.equal(answer.accept, false)
  assert.equal(answer.rejectMessage, 'already joined')
})

test('a full match says so', () => {
  const g = game()
  g.state.presences = { someone: {} }
  g.state.joinsInProgress = g.ctx.limitRoom

  const answer = attempt(g)

  assert.equal(answer.accept, false)
  assert.equal(answer.rejectMessage, 'match full')
})

test('a join without a session or a player is refused loudly', () => {
  const g = game()

  assert.throws(() => g.ctx.matchJoinAttempt({ sessionId: 's1' }, quietLogger, g.nk, g.dispatcher, 1, g.state, { userId: 'ada' }, {}))
  assert.throws(() => g.ctx.matchJoinAttempt({ userId: 'ada' }, quietLogger, g.nk, g.dispatcher, 1, g.state, { userId: 'ada' }, {}))
})

test('the signal and terminate hooks hand the state back untouched', () => {
  const g = game()

  assert.equal(g.ctx.matchSignal({}, quietLogger, g.nk, g.dispatcher, 1, g.state).state, g.state)
  assert.equal(g.ctx.matchTerminate({}, quietLogger, g.nk, g.dispatcher, 1, g.state, 5).state, g.state)
})

test('asking the server for the time answers with the clock', () => {
  const g = game()

  g.ctx.getCurrentTimeServerHandle(g.nk, quietLogger, g.state, g.dispatcher, { data: '{}' })

  assert.deepEqual(g.dispatcher.sent, [{ opCode: g.ctx.OpCode.GET_CURRENT_TIME_SERVER, data: { currentTime: 1_700_000_000 } }])
})

// --- the authenticate hook ------------------------------------------------------------------------

function authNk(ctx, account, calls = []) {
  return {
    accountGetId: () => account,
    walletUpdate: (...args) => calls.push(['walletUpdate', ...args]),
    accountUpdateId: (...args) => calls.push(['accountUpdateId', ...args]),
  }
}

test('a new player is given a wallet and the fields the client expects', () => {
  const ctx = load()
  const calls = []
  const nk = authNk(ctx, { user: { userId: 'ada', metadata: {} } }, calls)

  const out = ctx.initializeAuthenticateDevice({ userId: 'ada' }, quietLogger, nk, { token: 't' }, {})

  assert.deepEqual(out, { token: 't' }, 'the session comes back as it went in')
  sameJson(calls[0], ['walletUpdate', 'ada', { coin: 0 }, {}, true])
  const update = calls[1]
  assert.equal(update[0], 'accountUpdateId')
  assert.equal(update[3], 'DEFAULT DEFAULT', 'recorded: every new player is called this')
  assert.equal(update[8].hasInit, true)
})

test('a player who was already initialized is left alone', () => {
  const ctx = load()
  const calls = []
  const nk = authNk(ctx, { user: { userId: 'ada', metadata: { hasInit: true } } }, calls)

  ctx.initializeAuthenticateDevice({ userId: 'ada' }, quietLogger, nk, { token: 't' }, {})

  assert.deepEqual(calls, [], 'no wallet and no account write on every login')
})

test('the authenticate hook refuses to run without a player', () => {
  const ctx = load()
  const nk = authNk(ctx, { user: { userId: 'ada', metadata: {} } })

  assert.throws(() => ctx.initializeAuthenticateDevice({}, quietLogger, nk, {}, {}))
})

// --- the two list rpcs ---------------------------------------------------------------------------

test('the inventory rpc refuses to answer without a player', () => {
  const ctx = load()

  assert.throws(() => ctx.listUserInventories({}, quietLogger, gameNk(ctx, {}), ''))
})

// The item is joined onto the row by the id in the row itself, and the config is keyed by item while the
// bag is keyed by variant - the same pair of words sowing taught these tests. A row holding the config's
// id gets the item; a row holding a variant gets nothing back.
test('the inventory rpc joins the config onto rows that name it', () => {
  const ctx = load()
  const storage = {
    [ctx.tableConfigs.SYSTEM_COLLECTION]: { [ctx.tableConfigs.SYSTEM_ITEM_CONFIG_KEY]: [{ id: 'seed', resourceType: 2, resourceId: 1 }] },
    [ctx.tableConfigs.USER_INVENTORY_COLLECTION]: {
      [ctx.tableConfigs.USER_INVENTORY_KEY]: {
        named: { itemId: 'seed', quantity: 2 },
        variant: { itemId: 'seed-1', quantity: 1 },
      },
    },
  }

  const list = JSON.parse(ctx.listUserInventories({ userId: 'ada' }, quietLogger, gameNk(ctx, storage), ''))

  const byId = Object.fromEntries(list.map((row) => [row.itemId, row]))
  assert.equal(byId.named.item.id, 'seed', 'the row that names the config gets the item')
  assert.deepEqual(byId.variant.item, {}, 'and the row that names a variant gets an empty one')
  assert.equal(byId.named.quantity, 2)
})

// --- the shop rpc --------------------------------------------------------------------------------

test('the shop rpc lists what is on sale and leaves the rest out', () => {
  const ctx = load()
  const storage = {
    [ctx.tableConfigs.SYSTEM_COLLECTION]: {
      [ctx.tableConfigs.SYSTEM_SHOP_COIN_CONFIG_KEY]: [
        { id: 'on-sale', itemId: 'seed', status: 0 },
        { id: 'hidden', itemId: 'seed', status: 1 },
      ],
      [ctx.tableConfigs.SYSTEM_ITEM_CONFIG_KEY]: [{ id: 'seed', resourceType: 2, resourceId: 1 }],
    },
  }

  const list = JSON.parse(ctx.listItemsShop({}, quietLogger, gameNk(ctx, storage), ''))

  assert.equal(list.length, 1)
  assert.equal(list[0].id, 'on-sale')
})

test('the shop rpc answers with nothing when there is nothing configured', () => {
  const ctx = load()

  assert.deepEqual(JSON.parse(ctx.listItemsShop({}, quietLogger, gameNk(ctx, {}), '')), [],
    'a shop with no config is an empty shop, not an error')
})
