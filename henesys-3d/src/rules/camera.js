// Follow camera: while the player walks, the camera yaw swings behind them.
// Walking forward turns it fast, sideways or backward slowly, so strafing
// does not spin the view. A finger on the camera always wins. Pure.

/** camYaw places the camera at (sin, cos) * dist from the player, so "behind" is playerYaw + PI. */
export function followYaw(camYaw, playerYaw, dt, { moving, forward, dragging }) {
  if (dragging || !moving) return camYaw;
  const rate = 1 + 3 * Math.max(0, forward);
  let diff = playerYaw + Math.PI - camYaw;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return camYaw + diff * (1 - Math.exp(-rate * dt));
}
