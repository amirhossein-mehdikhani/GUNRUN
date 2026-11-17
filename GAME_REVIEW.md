# Game review — 2026-11-17

This is a source review of the current local checkout, including the recent gameplay changes. Performance findings identify plausible bottlenecks; they are not measurements from an older physical device or a multiplayer Wi-Fi session.

## Highest priorities

| Priority | Finding / owning source | Suggested improvement | Verification |
| --- | --- | --- | --- |
| High | `server.js`, player-shoot handler: shooter supplies victim, headshot/backstab flags and hit location; no server-side fire-rate, ammo, range or line-of-sight validation. | Add authoritative weapon state and shot validation. Once remote interpolation is used, retain position history for lag-compensated hit checks. | Reject excessive shots, impossible range, shots through cover and hits from dead players; validate normal shots at simulated latency. |
| High | `server.js` accepts room/player names and `public/js/game.js` inserts them into room, player, scoreboard and feed HTML. Player colors also enter style attributes. | Build user-controlled labels using textContent; validate colors against a hex format and validate all room settings/event shapes server-side. | Join with markup-like names and malformed event values; confirm literal display and no crashed handlers. |
| High | `server.js` exposes `/api/save-preview` to LAN clients and incorporates category/name into a filesystem path without an allowlist. | Disable by default outside explicit local preview generation; constrain paths and image payloads if retained. | Requests cannot write outside the preview folder or mutate a distributed game build. |
| High | `public/js/map.js`, clearMap removes root groups but only disposes geometry/material on the root itself. GLB children and texture ownership are not cleaned up. Discarded async loads also return without disposal. `RemotePlayer.destroy()` removes its group and one texture but leaves procedural meshes, sprite material and animation mixer references. | Traverse owned resources, deduplicate disposal, distinguish cloned/shared GLTF geometry from per-player resources, and stop/uncache mixers. | Repeat map switches and join/leave cycles; renderer memory counts should stabilize. Avoid disposing shared assets still used by other players. |

## Performance opportunities

| Priority | Finding / owning source | Suggested improvement | Verification |
| --- | --- | --- | --- |
| High | `server.js` uses existsSync/statSync/readFileSync for every asset request, including map/model data. Multiple joining devices block the same event loop used by game messages. | Use asynchronous/streamed asset serving with containment checks and cache headers. Keep executable asset smoke tests because the current code documents historical pkg stream issues. | Measure ping and event-loop delay while several clients download maps; compare packaged and source runtimes. |
| Medium | `public/js/game.js`, handleShoot allocates target arrays and raycasts every shootable map mesh recursively for each shot. | Reuse targets, use nearest-hit acceleration/BVH for static geometry and a separate player broad phase. | Measure shot-frame duration on every map, especially automatic fire and multiple opponents. |
| Medium | `public/js/map.js` collision uses full visual-map triangle data; stepped wall movement may query several times per frame. | Profile collision first, then use simplified collision meshes or improved spatial queries; preserve existing seam and double-sided floor behavior. | Walking, stairs, ramps, crouch, ceilings and fast movement must remain solid at 30/60 FPS. |
| Medium | `public/js/weapon.js` creates impact geometry/materials per shot; expired particles dispose geometry but not their shared-per-burst material. | Pool impact meshes/materials and bound concurrent tracers/particles. | Sustain automatic fire and confirm stable GPU memory and no new shader compilation spikes. |
| Medium | `public/js/character.js` preloads every character and updates every animated remote player regardless of distance. | Lazy-load selected models, use distance-based animation frequency and optional simple-model mode. | Measure first-join loading, memory and animation cost with a full room on low hardware. |
| Medium | `public/js/game.js` simulation and rendering share variable frame timing; capped rendering can still produce uneven movement steps on irregular refresh rates. | Separate a bounded fixed physics step from rendering, cap catch-up work, keep input immediate, and send one latest network pose per cadence. | Compare speed/jumps/collision at 30, 60 and 144 Hz with frame stalls; avoid a catch-up spiral on weak hardware. |

## Networking and gameplay improvements

- Add sequence numbers, movement-arrival gap statistics and transport backpressure diagnostics. Current ping/jitter is round-trip variation; it does not prove packet loss. Volatile movement intentionally drops obsolete updates. Evaluate the existing 75 ms display buffer on separate Wi-Fi devices before increasing delay.
- Reconnection currently does not restore room membership: the new socket gets a new identity and stale local match state can remain. Add a clear reconnect/rejoin flow, and reset old match UI on disconnect.
- Add a graphics selector to the pause menu so players can change quality without leaving a match. Add clearer loading progress and explicit unsupported-WebGL feedback.
- Keep enemy health hidden as requested. The UI hides it, but server room/damage payloads still disclose HP to opponents; per-recipient data filtering is needed if this must be enforced against modified clients.
- Add an actual crouched pose instead of vertically scaling the whole remote model. Preserve matching visual and hitbox heights.
- Expand end-to-end regression coverage around death → respawn → full magazines, full-room play, team changes, grenades after death, match completion, disconnect/rejoin, and held Tab in a real browser. Current Node tests validate components but are not a substitute for these sessions.

## Suggested order

1. Land and run the release workflow on all four native runners.
2. Fix input/HTML/path handling and resource lifetime problems.
3. Measure concurrent joining and collision/shooting frame costs, then optimize the measured bottleneck.
4. Add authoritative shooting, reconnection and latency simulation tests.

Current validation: all 11 Node regression tests pass. The Windows executable built locally and passed the standalone smoke test (HTTP, embedded assets and WebSocket) from outside the checkout. macOS/Linux binaries and GitHub publishing require a successful Actions run; see RELEASING.md for the exact process. No optimization beyond the release tooling was implemented in this review.
