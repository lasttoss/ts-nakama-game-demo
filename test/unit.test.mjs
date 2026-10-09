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
