// Keeps each hunting zone populated: fills on the first update, then
// respawns a mob RESPAWN seconds after each death. Pure.
export const ZONE_CAP = 6;
export const TOTAL_CAP = 15;
export const RESPAWN = 7;

export class Spawner {
  constructor(zones, rng = Math.random) {
    this.zones = zones;
    this.rng = rng;
    this.alive = zones.map(() => 0);
    this.timers = zones.map(() => []);
    this.filled = false;
  }

  count(zone) { return this.alive[zone]; }
  total() { return this.alive.reduce((a, b) => a + b, 0); }

  onDeath(zone) {
    this.alive[zone] = Math.max(0, this.alive[zone] - 1);
    this.timers[zone].push(RESPAWN);
  }

  #spawn(zone) {
    const z = this.zones[zone], a = z.area, r = this.rng;
    this.alive[zone]++;
    return {
      mobId: z.mobIds[Math.floor(r() * z.mobIds.length)],
      zone,
      x: a.x + (r() - 0.5) * a.w,
      z: a.z + (r() - 0.5) * a.d,
    };
  }

  update(dt) {
    const out = [];
    const room = zone => this.alive[zone] < ZONE_CAP && this.total() < TOTAL_CAP;
    if (!this.filled) {
      this.filled = true;
      this.zones.forEach((_, i) => { while (room(i)) out.push(this.#spawn(i)); });
      return out;
    }
    this.timers.forEach((list, i) => {
      for (let k = list.length - 1; k >= 0; k--) {
        list[k] -= dt;
        if (list[k] <= 0) {
          list.splice(k, 1);
          if (room(i)) out.push(this.#spawn(i));
        }
      }
    });
    return out;
  }
}
