#!/usr/bin/env node
/**
 * End-to-end smoke test for the Nakama demo plugin.
 *
 * It talks to the public HTTP API only, so it proves the whole chain works:
 * the container, the database migration, the compiled plugin, the after-authenticate
 * hook and all four RPCs.
 *
 *   node scripts/smoke.mjs [host] [port]
 */
const host = process.argv[2] ?? "127.0.0.1";
const port = process.argv[3] ?? "7350";
const base = `http://${host}:${port}`;
const serverKey = process.env.NAKAMA_SERVER_KEY ?? "defaultkey";

const fail = (msg) => {
  console.error(`  [FAIL] ${msg}`);
  process.exit(1);
};
const pass = (name, detail = "") => console.log(`  [PASS] ${name}${detail ? " - " + detail : ""}`);

async function waitForServer(attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${base}/healthcheck`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  fail(`${base} never became healthy`);
}

async function authenticate(deviceId) {
  const res = await fetch(`${base}/v2/account/authenticate/device?create=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${serverKey}:`).toString("base64"),
    },
    body: JSON.stringify({ id: deviceId }),
  });
  if (!res.ok) fail(`authenticate/device -> HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function account(token) {
  const res = await fetch(`${base}/v2/account`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) fail(`account -> HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// The match registry that backs matchList is indexed asynchronously, so a match can be
// missing from the index for a moment after it is created. Poll until it shows up.
async function waitForMatchIndex(token, matchId, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${base}/v2/match?limit=100&authoritative=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { matches = [] } = await res.json();
    if (matches.some((m) => m.match_id === matchId)) return i * 250;
    await new Promise((r) => setTimeout(r, 250));
  }
  fail(`match ${matchId} never showed up in the match registry`);
}

async function rpc(id, token, payload = {}) {
  // Nakama's HTTP gateway hands the RPC a *string*, so the body has to be a JSON
  // encoded string ("{}"), not a JSON object.
  const res = await fetch(`${base}/v2/rpc/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(JSON.stringify(payload)),
  });
  const text = await res.text();
  if (!res.ok) fail(`rpc ${id} -> HTTP ${res.status} ${text}`);
  const body = JSON.parse(text);
  return body.payload === undefined ? body : JSON.parse(body.payload ?? "null");
}

await waitForServer();
pass("server is healthy", base);

const deviceId = `smoke-${Date.now()}`;
const session = await authenticate(deviceId);
if (!session.token) fail("no session token returned");
const me = await account(session.token);
pass("authenticate by device", `user_id=${me.user.id}`);

// the after-authenticate hook initialises the wallet on the first login
const energy = await rpc("get_user_energy", session.token);
if (typeof energy.currentEnergy !== "number" || typeof energy.maxEnergy !== "number")
  fail(`get_user_energy returned ${JSON.stringify(energy)}`);
pass("rpc get_user_energy", `${energy.currentEnergy}/${energy.maxEnergy}`);

const inventory = await rpc("list_user_inventories", session.token);
if (!Array.isArray(inventory)) fail("list_user_inventories did not return an array");
pass("rpc list_user_inventories", `${inventory.length} entries`);

const shop = await rpc("list_items_shop", session.token);
if (!Array.isArray(shop)) fail("list_items_shop did not return an array");
pass("rpc list_items_shop", `${shop.length} entries (0 until shop config is seeded)`);

const room = await rpc("find_private_room", session.token);
if (!room.matchId) fail(`find_private_room returned ${JSON.stringify(room)}`);
pass("rpc find_private_room", `match_id=${room.matchId}`);

// the same call must return the same private room: one authoritative room per player
const waited = await waitForMatchIndex(session.token, room.matchId);
const again = await rpc("find_private_room", session.token);
if (again.matchId !== room.matchId)
  fail(`find_private_room did not reuse the existing room: ${again.matchId} != ${room.matchId}`);
pass("private room is reused for the same player", `indexed after ~${waited}ms`);

console.log("OK - plugin loaded, hook ran, RPCs and the match handler are reachable");
console.log(`device_id=${deviceId}`);
