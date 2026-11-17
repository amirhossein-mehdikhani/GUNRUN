// A short display delay absorbs uneven arrivals; prediction is bounded.
export class MovementBuffer {
  constructor() { this.samples = []; }
  push(position, yaw, time, isCrouching = false) {
    const last = this.samples.at(-1);
    if (last && Math.hypot(position.x - last.x, position.y - last.y, position.z - last.z) > 8) this.samples.length = 0;
    this.samples.push({ x: position.x, y: position.y, z: position.z, yaw, time, isCrouching });
    if (this.samples.length > 12) this.samples.shift();
  }
  sample(now, out) {
    const list = this.samples;
    if (!list.length) return false;
    const time = now - 75;
    while (list.length > 2 && list[1].time <= time) list.shift();
    const a = list[0];
    const b = list[1] || a;
    const span = b.time - a.time;
    const t = span > 0 ? Math.max(0, Math.min(1 + 50 / span, (time - a.time) / span)) : 0;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * Math.min(1, t);
    out.z = a.z + (b.z - a.z) * t;
    out.yaw = a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * Math.min(1, t);
    // Interpolate body height along with eye height to keep feet planted while ducking.
    const crouchAmount = Number(a.isCrouching) + (Number(b.isCrouching) - Number(a.isCrouching)) * Math.min(1, t);
    out.heightScale = 1 - crouchAmount * 0.375;
    return true;
  }
}
