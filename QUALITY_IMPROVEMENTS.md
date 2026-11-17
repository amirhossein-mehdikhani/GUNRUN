# Gameplay reliability and optimization — 2026-11-17

Implemented the five areas requested from GAME_REVIEW.md.

## Server-side shooting

- Shared weapon definitions keep damage, range, magazine size, fire rate and reload time consistent between server and browser.
- The server owns magazines, switching delays and reload completion. Respawn refills magazines and keeps the selected gun; match start resets the loadout.
- Shots require an active match, live shooter, finite normalized direction, plausible origin, correct equipped weapon, remaining ammo and an elapsed fire interval. The server constructs the ray from its stored player position, computes the nearest player hit, and checks map cover. Client-supplied victim, headshot and backstab claims do not determine damage.
- Static collision data is baked from the actual scaled/centered GLB map geometry for all five arenas. The release workflow rebuilds it before testing/packaging. Run `npm run bake:collision` after editing any arena model.
- A fixed 75 ms server-controlled history lookup aligns enemy hit volumes with the existing interpolation delay. This is basic lag compensation for LAN play, not fully authoritative movement simulation or an internet anti-cheat system. Grenade physics/detonation locations still originate on the throwing client; event shapes and thrower identity are checked, but grenade trajectories are not simulated on the server in this change.

## Resource lifetime

- Map teardown traverses nested meshes, lights, textures and materials and disposes each owned resource once. Discarded asynchronous map loads are disposed too.
- Remote-player removal stops and uncaches animation mixers and disposes per-player materials, procedural geometry, sprite textures and skeleton resources. Cached character geometry/textures remain shared and alive. An asynchronous character load cannot attach a model after its player has been destroyed.
- Impact geometry/materials are shared across bursts; transient tracers and sparks are cleared between matches and on leaving a room.

## Asset serving

- HTTP asset requests use asynchronous stat/realpath/read operations. Overlapping requests for the same file share their pending read; buffers are released after requests finish.
- Buffered async reads preserve packaged snapshot compatibility. ETags support revalidation and 304 responses; HEAD does not read the body. Missing files return 404 rather than HTML.
- Decoded path traversal, NULs, Windows separators and symlink escapes are rejected. Preview writing is disabled unless explicitly enabled with `ENABLE_PREVIEW_WRITE=1`, remains unavailable in packaged executables, and constrains filenames/categories/payload sizes.

## Spatial queries

- Browser shooting uses a static triangle BVH to bound the nearest wall hit and raycasts only player hit volumes. Target/intersection arrays are reused; the fallback path still handles non-indexed maps.
- Collision candidate collection uses a Set to deduplicate overlapping octree leaves rather than repeatedly scanning candidate arrays. Existing double-sided/seam/ceiling collision rules remain.
- `node scripts/benchmark-collision.mjs` compares 300 downward rays per map against a brute-force scan using the same intersection kernel, requiring matching hits and distances. Local runs ranged from about 10–60 times faster for this query workload. This does not establish an equivalent improvement in total FPS.

## Reconnection and input validation

- Socket.IO recovery retains a player's room, identity, scores and weapon state for transient transport failures lasting up to 30 seconds. Explicit leave/disconnect still removes the player immediately. An expired/unrecoverable session returns to the lobby with an explanation.
- The browser clears held input/fire and hides the scoreboard on disconnect, shows connection status, and restores room/match data on recovery. Recovery deliberately resumes through the pause menu so the player can reacquire pointer lock.
- Names, character types, colors, maps, gravity, modes, score limits and incoming event shapes are validated. Player-provided strings are escaped in generated HTML. Packet size/rate limits bound malformed/flooding traffic. Team/map changes are limited to the lobby and room control actions require the host.

## Verification and limitations

- All 25 tests pass, including a real child server with two Socket.IO clients: create/join/start, malformed inputs, forged hit claims, eight concurrent map downloads, ammo preservation across an actual transport drop/recovery, and explicit room leave.
- Unit checks cover wall occlusion on both windings, weapon range, invalid/dead/empty-magazine shots, reload timing/cancellation, shared-resource ownership, static spatial queries and the earlier crouch/graphics tests.
- The Windows executable is rebuilt and checked outside the source checkout for HTTP, embedded modules/models/collision data, WebSocket ping and actual match start.
- Browser verification loaded Dust II, character assets and a match in both the in-app browser and Chrome. Automated Resume clicks failed to acquire pointer lock (`WrongDocumentError`). Native Chrome input was then stopped because the automation could not verify the current URL safely. Active mouse-look/movement and a complete human multiplayer session were not browser-verified. No physical weak-device or cross-device Wi-Fi benchmark is claimed.
- Refresh every player's browser after updating: the shooting/reload protocol now requires the new client and server together.
