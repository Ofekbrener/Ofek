// Frame-rate independent exponential ease toward a target.
export const ease = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
