# Performance review — 2026-11-16

## Findings and changes

- Local camera movement is client simulated. The server does not correct its position each frame, so local movement stutter alone does not establish packet loss.
- Movement used reliable Socket.IO emits in both directions. Replaced only movement with volatile emits so unwritable connections do not accumulate obsolete positions. Shooting, damage, room state and weapon changes keep reliable delivery. Prefer WebSocket with polling fallback; skip movement and ping while disconnected.
- Remote yaw used linear interpolation across the -PI/+PI seam, causing nearly full-circle turns. Now uses the shortest angular difference and exponential smoothing for consistent convergence at different frame rates.
- Rendering used up to 2x device pixel ratio. Cap is now 1.5x, reducing pixel count by 43.75% on devices previously using 2x; no reduction on 1x displays. Shadows remain enabled.
- Movement allocated several vectors per frame; collision queries allocated rays, capsules, triangle lists and edge arrays repeatedly. Reuse synchronous query scratch objects and copy received position data into a reusable target.
- Grounded movement repeated a floor raycast after already finding a valid floor. Reuse the existing floor result for safe-position tracking.
- FPS previously updated the DOM every frame and used a clamped delta, hiding the size of long stalls. Update twice a second from actual elapsed time. Hover FPS for worst frame, slow-frame count, draw calls and triangles. Ping shows RTT variation (jitter), transport in its tooltip, and stale/disconnected status. These metrics do not measure IP packet loss.

## Verification

- JavaScript syntax and git whitespace checks passed.
- `node --test tests/performance.test.js`: four regression tests passed: repeated floor queries including reversed winding, repeated wall collision queries, angle seam crossing, and smoothing consistency across 30/144 FPS with packet ownership.
- Browser: created room and started Dust II. After loading, sampled 145 FPS, worst frame 7.6 ms, zero frames over 33 ms, 65 draw calls and 18,660 triangles. Ping 3 ms over WebSocket. The match was paused because pointer lock was not held during automation; this is not a moving-player benchmark.
- Two real Socket.IO clients on localhost: 90/90 movement events received at approximately 30 Hz; average relay 2.32 ms, maximum 5.51 ms, ping 2.81 ms. Invalid movement rejected. Test clients disconnected afterward.

## Limits and next investigation

No packet loss has been confirmed. Localhost delivery does not validate a separate device's Wi-Fi. No controlled before/after frame-time benchmark was collected, so no measured FPS improvement is claimed. The single instantaneous pre-change browser reading was 66 FPS and is not comparable to the post-load sample.

Dense map triangle queries and full-scene shadow rendering can still become expensive. Profile active movement on the affected map before changing collision semantics or disabling shadows. A proper multi-device test should compare local frame stalls against RTT/jitter during the reported symptom. A snapshot interpolation buffer may further improve remote motion under variable arrival times, at the cost of additional display latency.

The updated game server is running on port 3000. Changes are local and uncommitted.

## Weaker-device support

Added saved Auto, Low, Balanced and High graphics presets. Auto starts Low when reported CPU concurrency or device memory is at most four; unknown hardware starts Balanced. Low disables shadows, caps render resolution at 960×540 pixels with at most 0.75 device ratio, reduces cosmetic particles to roughly one quarter, and disables overlay blur. Balanced caps pixels at 1600×900 without shadows. High keeps shadows and up to 1.5 device ratio. MSAA is disabled to reduce GPU and framebuffer cost.

Auto lowers resolution in 10% steps down to 60% of its starting ratio when three seconds of active, loaded gameplay averages under 45 FPS. Rendering targets 60 FPS in active gameplay, 30 in menus/pause, and 5 in hidden tabs. Visibility changes clear held movement/fire input and reset timing. Settings are local to each device and do not change collision or damage.

Verification: six Node regression tests passed. Low selection survived a browser reload; the canvas was 535×500 on a 714×667 viewport. Dust II loaded and rendered without captured console errors. The paused view used 36 draw calls / 9,405 triangles versus the earlier shadow-enabled view's 65 / 18,660. Paused FPS is intentionally capped and is not a hardware benchmark. No physical low-end machine was tested. Current Three.js requires WebGL 2, so unsupported legacy GPUs still cannot run this engine.

## Movement smoothing, crouch and automatic reload

Remote motion now uses a 75 ms arrival-time interpolation buffer rather than chasing the latest position. Horizontal prediction is limited to 50 ms and then holds; vertical prediction is disabled to avoid lifting crouched players through floors. Large teleports reset history, and respawns explicitly clear it. This introduces a deliberate display delay and is jitter mitigation, not proof that network packet loss was fixed. Movement cadence now preserves its remainder so render timing does not systematically lower the intended 30 Hz send rate.

Hold either Ctrl key to crouch while mouse control is active: eye/collision height changes from 1.6 m to 1.0 m, movement becomes 45% speed, and sprint is disabled. Feet stay planted; ceiling geometry blocks standing until there is clearance. Remote model and hitbox heights follow the synchronized crouch state. Visibility/focus loss clears held inputs.

Empty firearms automatically start reloading in active play, including DMR and sniper. The existing reload duration is preserved. Switching weapons cancels the old reload callback so it cannot refill another gun. Ammo/reload HUD changes are refreshed when state changes, including scope cleanup.

Validation: all 11 tests passed, covering packet gaps, angular wrap, bounded prediction, teleports, crouch clearance, auto reload eligibility/completion, reload cancellation, and earlier graphics/collision tests. A two-client local check received 90/90 movement updates with crouch state, mean relay 1.31 ms, maximum 2.84 ms and ping 0.99 ms. Browser loaded a new match and displayed the Ctrl guide without captured console errors. Automated browser verification was paused without pointer lock; active human movement and cross-device Wi-Fi remain unverified.
