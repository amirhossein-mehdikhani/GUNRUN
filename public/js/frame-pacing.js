// Follow display refresh during play: a 60 Hz cap on a 144 Hz display alternates
// two and three refresh intervals, making a constant-speed mouse turn judder.
// Menus/background tabs still sleep; Low explicitly trades cadence for GPU cost.
export class FramePacer {
  constructor() { this.next = null; this.interval = null; }
  shouldRender(timestamp, {active, hidden, low}) {
    const interval = hidden ? 200 : active ? (low ? 1000 / 60 : 0) : 1000 / 30;
    if (interval === 0) { this.next = null; this.interval = interval; return true; }
    if (this.interval !== interval || this.next === null) {
      this.interval = interval; this.next = timestamp + interval; return true;
    }
    if (timestamp + 0.5 < this.next) return false;
    // Advance at least once, including when tolerance admits an early frame.
    this.next += Math.max(1, Math.floor((timestamp - this.next) / interval) + 1) * interval;
    return true;
  }
}
