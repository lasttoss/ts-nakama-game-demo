# Measurements

## Environment

| | |
|---|---|
| Machine | 12-core x86-64 (AMD64), Ubuntu 24.04, Docker 29.1.3 |
| Toolchain | Go 1.27.2 / Node 24.19.0 / JDK 17 in `maven:3.9-eclipse-temurin-17` |
| Date | 2026-10-13 (UTC) |


## 69 tests against the shipped bundle

```
$ npm run build && npm test
ℹ tests 69
ℹ pass 69
ℹ fail 0
```

**Result.** `test/unit.test.mjs` is the only test file, and it runs `build/index.js` in a fresh VM
context rather than importing the sources - TypeScript concatenates this project into one bundle, so
what is tested is the artifact Nakama actually loads. The README names the pure-logic group
(room picker, clock helpers, amount formatter, DTO mappers); that group is 12 of the 69 today, and
the rest of the file covers the watering rules.

## The plugin loads into a real Nakama, on the version the kit pins

```
$ docker compose up -d --build --wait && make smoke
[PASS] device authentication
[PASS] three RPCs
[PASS] the match handler joins a room
[PASS] a private room is reused, never a stranger's
```

**Result.** The smoke test drives the public HTTP API against **Nakama 3.41.0**, which is the version
`nakama-migration-kit` and `nakama-go-server-kit` target: the image was on 3.32.0, three minor
versions behind, and this run is what says the upgrade is safe rather than assumed.
