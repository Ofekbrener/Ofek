// 2D (x/z) collision against circles and axis-aligned boxes, and ground height. Pure.

export function resolve(pos, radius, colliders, bounds) {
  let { x, z } = pos;
  for (const c of colliders) {
    if (c.type === 'circle') {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min) {
        const nx = d > 1e-9 ? dx / d : 1, nz = d > 1e-9 ? dz / d : 0;
        x = c.x + nx * min; z = c.z + nz * min;
      }
    } else {
      const ox = c.hw + radius - Math.abs(x - c.x), oz = c.hd + radius - Math.abs(z - c.z);
      if (ox > 0 && oz > 0) {
        if (ox < oz) x = c.x + Math.sign(x - c.x || 1) * (c.hw + radius);
        else z = c.z + Math.sign(z - c.z || 1) * (c.hd + radius);
      }
    }
  }
  x = Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x));
  z = Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z));
  return { x, z };
}

export function groundHeight(heightFns, x, z) {
  let h = 0;
  for (const f of heightFns) {
    const v = f(x, z);
    if (v != null && v > h) h = v;
  }
  return h;
}

/**
 * Height function for a box you can stand on (a log, a flat rock) centred at
 * (x, z) on ground height y, rotated by ry. pl: { hw, hd, top }.
 */
export function platformHeight(pl, x, z, y, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (px, pz) => {
    const dx = px - x, dz = pz - z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) <= pl.hw && Math.abs(lz) <= pl.hd ? y + pl.top : null;
  };
}

/** Can a walker standing at height y step to a spot whose ground is `floor`? */
export const canStep = (y, floor, step = 0.45) => floor <= y + step;
