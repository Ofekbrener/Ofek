// Classic (tank) controls: stick up walks forward along the facing, down
// walks backward, left/right turn in place. Pure.
export const TURN_RATE = 2.6;   // rad/s at full stick
export const BACK_SPEED = 0.6;  // fraction of walk speed
const DEAD = 0.2;

/** Returns the new yaw and a unit-speed displacement for this frame. */
export function classicStep(stick, yaw, dt) {
  const turn = Math.abs(stick.x) > DEAD ? stick.x : 0;
  const push = Math.abs(stick.y) > DEAD ? stick.y : 0;
  const ny = yaw - turn * TURN_RATE * dt;
  const k = push > 0 ? push : push * BACK_SPEED;
  if (!k) return { yaw: ny, dx: 0, dz: 0, back: false };
  return { yaw: ny, dx: Math.sin(ny) * k, dz: Math.cos(ny) * k, back: push < 0 };
}
