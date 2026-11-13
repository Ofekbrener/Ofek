// Weapon moves. Each attack is a pose timeline solved with two-bone IK on top of the body clip:
// the weapon hand reaches a target, the weapon points along a direction, the other hand grips the shaft.
// Pose space is the survivor's own: x = their left (the weapon hand side), y = up, z = forward. Units are model meters.
// pre: keys from attack start (t 0) to the strike (t 1). post: keys from the strike (t 0) to the end (t 1).
'use strict';
const mvKey = (t, h, d, p) => ({t, h, d, p});
const MV_REST = mvKey(0, [.3, .6, .05], [.2, .9, .2]);        // weapon up at the side
const MV_GUARD = mvKey(0, [.2, .55, .08], [0, .08, 1]);         // spear level, tip forward
const MV_KGUARD = mvKey(0, [.3, .62, .1], [0, .3, 1]);          // knife low and forward
const mvAt = (key, t) => ({...key, t});
// reach and arc scale the weapon's own; side turns knockback (+1 pushes to the survivor's right, -1 to the left)
const MOVES = {
  jab: {clip: 'Stab', reach: 1.15, arc: .6, lunge: 1.3, snd: 1.2, twist: .5,
    pre: [MV_KGUARD, mvKey(.6, [.32, .66, -.12], [.1, .3, 1]), mvKey(1, [.12, .74, .42], [-.05, .05, 1])],
    post: [mvKey(0, [.12, .74, .42], [-.05, .05, 1]), mvKey(.35, [.14, .72, .38], [-.05, .1, 1]), mvAt(MV_KGUARD, 1)]},
  backslash: {clip: 'Slash', reach: 1, arc: 1.3, side: -1, snd: 1.1, twist: -1,
    pre: [MV_KGUARD, mvKey(.7, [-.12, .82, .12], [-1, .25, .2], [1, -.4, -.4]), mvKey(1, [.1, .76, .4], [0, .1, 1])],
    post: [mvKey(0, [.1, .76, .4], [0, .1, 1]), mvKey(.4, [.42, .72, .18], [1, .05, -.1]), mvAt(MV_KGUARD, 1)]},
  stabDown: {clip: 'Stab', reach: 1.1, arc: .65, dmg: 1, snd: .9, twist: .4, smash: 'small',
    pre: [MV_KGUARD, mvKey(.7, [.25, 1.05, 0], [0, -.6, .4], [1, .2, -.6]), mvKey(1, [.14, .55, .42], [0, -1, .25])],
    post: [mvKey(0, [.14, .55, .42], [0, -1, .25]), mvKey(.3, [.14, .5, .42], [0, -1, .2]), mvAt(MV_KGUARD, 1)]},
  thrust: {clip: 'Punch', reach: 1.15, arc: .4, lunge: 1.4, snd: 1.15, twist: .3, pierce: true,
    pre: [MV_GUARD, mvKey(.65, [.24, .6, -.32], [-.02, .1, 1], [1, -1, -.3]), mvKey(1, [.05, .72, .5], [0, .02, 1], [1, -1, -.3])],
    post: [mvKey(0, [.05, .72, .5], [0, .02, 1]), mvKey(.35, [.06, .72, .46], [0, .02, 1]), mvAt(MV_GUARD, 1)]},
  sweep: {clip: 'Slash', reach: .9, arc: 1.5, side: 1, snd: .9, twist: 1, trip: .6,
    pre: [MV_GUARD, mvKey(.7, [.38, .55, -.05], [.85, -.25, .4]), mvKey(1, [.05, .55, .38], [0, -.3, 1])],
    post: [mvKey(0, [.05, .55, .38], [0, -.3, 1]), mvKey(.45, [-.28, .58, .18], [-.9, -.25, .3], [1, -1, .2]), mvAt(MV_GUARD, 1)]},
  hSwing: {clip: 'Slash', reach: 1, side: 1, snd: 1, twist: 1,
    pre: [MV_REST, mvKey(.7, [.4, .88, -.15], [.5, .55, -.65], [1, -.2, -.8]), mvKey(.88, [.32, .74, .2], [.9, .15, .35]), mvKey(1, [.05, .72, .42], [0, .05, 1])],
    post: [mvKey(0, [.05, .72, .42], [0, .05, 1]), mvKey(.3, [-.25, .72, .3], [-.9, .05, .4], [1, -1, .3]), mvKey(.65, [-.3, .78, 0], [-.6, .3, -.7], [1, -1, .3]), mvAt(MV_REST, 1)]},
  backhand: {clip: 'Slash', reach: 1, side: -1, snd: 1.08, twist: -1,
    pre: [MV_REST, mvKey(.7, [-.25, .85, -.05], [-.6, .5, -.6], [1, -.6, -.4]), mvKey(.88, [-.2, .74, .25], [-.9, .15, .35], [1, -.8, -.2]), mvKey(1, [.08, .72, .42], [0, .05, 1])],
    post: [mvKey(0, [.08, .72, .42], [0, .05, 1]), mvKey(.3, [.38, .72, .25], [.9, .05, .35]), mvKey(.65, [.4, .8, 0], [.6, .35, -.6]), mvAt(MV_REST, 1)]},
  overhead: {clip: 'Slash', reach: .9, arc: .7, dmg: 1, snd: .8, twist: .5, smash: 'big',
    pre: [MV_REST, mvKey(.7, [.15, 1.12, -.12], [.05, .35, -1], [1, .3, -.3]), mvKey(.88, [.1, 1, .25], [0, .7, .6], [1, .3, -.3]), mvKey(1, [.06, .62, .45], [0, -.55, .85])],
    post: [mvKey(0, [.06, .62, .45], [0, -.55, .85]), mvKey(.3, [.06, .45, .42], [0, -.85, .5]), mvAt(MV_REST, 1)]},
  chop: {clip: 'Slash', reach: .9, arc: .65, dmg: 1, snd: .75, twist: .5, smash: 'big',
    pre: [MV_REST, mvKey(.7, [.2, 1.1, -.08], [0, .6, -.8], [1, .3, -.3]), mvKey(.9, [.12, .98, .28], [0, .5, .85], [1, .3, -.3]), mvKey(1, [.08, .55, .45], [0, -.75, .65])],
    post: [mvKey(0, [.08, .55, .45], [0, -.75, .65]), mvKey(.3, [.08, .42, .42], [0, -.95, .3]), mvAt(MV_REST, 1)]},
  diag: {clip: 'Slash', reach: 1, arc: 1.1, side: 1, snd: .9, twist: 1,
    pre: [MV_REST, mvKey(.7, [.38, 1.02, -.05], [.5, .7, -.5], [1, 0, -.6]), mvKey(1, [.08, .65, .42], [-.3, -.35, .9])],
    post: [mvKey(0, [.08, .65, .42], [-.3, -.35, .9]), mvKey(.35, [-.25, .48, .25], [-.8, -.5, .3], [1, -1, .3]), mvAt(MV_REST, 1)]},
  neckJab: {clip: 'Punch', reach: 1.1, arc: .4, lunge: 1.2, snd: 1.1, twist: .3,
    pre: [MV_GUARD, mvKey(.65, [.24, .64, -.2], [0, .15, 1]), mvKey(1, [.1, .72, .42], [0, .05, 1])],
    post: [mvKey(0, [.1, .72, .42], [0, .05, 1]), mvKey(.35, [.1, .72, .4], [0, .05, 1]), mvAt(MV_REST, 1)]},
  grind: {clip: 'Punch', reach: 1.05, arc: .45, lunge: 1.1, snd: .9, twist: .3, ticks: 2,
    pre: [MV_GUARD, mvKey(.65, [.22, .62, -.18], [0, .1, 1]), mvKey(1, [.1, .7, .4], [0, .02, 1])],
    post: [mvKey(0, [.1, .7, .4], [0, .02, 1]), mvKey(.5, [.12, .7, .38], [0, .02, 1]), mvAt(MV_REST, 1)]},
  throw: {clip: 'Punch', reach: 1, snd: 1, twist: .6,
    pre: [MV_GUARD, mvKey(.75, [.3, 1.05, -.25], [0, .1, 1], [1, 0, -.6]), mvKey(1, [.1, .9, .35], [0, 0, 1], [1, 0, -.6])],
    post: [mvKey(0, [.1, .9, .35], [0, 0, 1]), mvAt(MV_REST, 1)]},
  spinOut: {clip: 'Slash', reach: 1, snd: 1, twist: 0,
    pre: [MV_REST, mvKey(1, [.45, .72, .15], [1, .05, .2], [1, -1, -.2])],
    post: [mvKey(0, [.45, .72, .15], [1, .05, .2], [1, -1, -.2]), mvKey(.85, [.45, .72, .15], [1, .05, .2], [1, -1, -.2]), mvAt(MV_REST, 1)]},
};
const POLE_L = [1, -.8, -.6], POLE_R = [-1, -.8, -.6];

// Catmull-Rom through the hand targets, smoothstep between weapon directions
function sampleKeys(keys, t) {
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const A = keys[i], B = keys[i + 1] || A, s = B.t > A.t ? clamp((t - A.t) / (B.t - A.t), 0, 1) : 1;
  const P0 = keys[i - 1] || A, P3 = keys[i + 2] || B, e = s * s * (3 - 2 * s);
  const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * s + (2 * a - 5 * b + 4 * c - d) * s * s + (-a + 3 * b - 3 * c + d) * s * s * s);
  const h = [0, 1, 2].map(j => cr(P0.h[j], A.h[j], B.h[j], P3.h[j]));
  const d = [0, 1, 2].map(j => lerp(A.d[j], B.d[j], e));
  const pa = A.p || POLE_L, pb = B.p || POLE_L, p = [0, 1, 2].map(j => lerp(pa[j], pb[j], e));
  return {h, d, p};
}
const mixKey = (a, b, s) => ({h: a.h.map((v, j) => lerp(v, b.h[j], s)), d: a.d.map((v, j) => lerp(v, b.d[j], s)), p: a.p.map((v, j) => lerp(v, b.p[j], s))});

const _ik = {S: new THREE.Vector3(), E: new THREE.Vector3(), H: new THREE.Vector3(), T: new THREE.Vector3(), E2: new THREE.Vector3(),
  u: new THREE.Vector3(), p: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(),
  q: new THREE.Quaternion(), q2: new THREE.Quaternion(), pq: new THREE.Quaternion(), id: new THREE.Quaternion()};
// rotate a bone so the world direction `from` turns toward `to`, by weight w
function turnBone(bone, from, to, w) {
  const {q, q2, pq, id} = _ik;
  q.setFromUnitVectors(from, to); if (w < 1) q.copy(id).slerp(q2.copy(q), w);
  bone.parent.getWorldQuaternion(pq);
  q2.copy(pq).invert().multiply(q).multiply(pq);
  bone.quaternion.premultiply(q2); bone.updateMatrixWorld(true);
}
// two-bone IK: upper arm + forearm put `end` on world point T; the elbow bends toward the pole direction
function solveArm(upper, lower, end, T, pole, w) {
  const {S, E, H, E2, u, p, a, b} = _ik;
  upper.getWorldPosition(S); lower.getWorldPosition(E); end.getWorldPosition(H);
  const la = S.distanceTo(E), lb = E.distanceTo(H);
  u.subVectors(T, S); const d = clamp(u.length(), Math.abs(la - lb) + .001, la + lb - .001); u.normalize();
  const along = (la * la - lb * lb + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, la * la - along * along));
  p.copy(pole).addScaledVector(u, -pole.dot(u)); if (p.lengthSq() < 1e-6) p.set(0, -1, 0); p.normalize();
  E2.copy(S).addScaledVector(u, along).addScaledVector(p, hh);
  turnBone(upper, a.subVectors(E, S).normalize(), b.subVectors(E2, S).normalize(), w);
  lower.getWorldPosition(E); end.getWorldPosition(H);
  const Tc = E2.copy(S).addScaledVector(u, d);
  turnBone(lower, a.subVectors(H, E).normalize(), b.subVectors(Tc, E).normalize(), w);
}
const TWO_HANDED = {Spear: true, WoodenBat_Barbed: true, WoodenBat_Saw: true, Axe: true, Guitar: true};
// pose the arms from a key; called after the mixer and the torso twist
function solvePose(P, key, w) {
  const r = P.rig, B = r.bones; if (!B.UpperArmL || !P.wMesh) return;
  r.root.updateMatrixWorld(true);
  const body = r.body, T = _ik.T, v = new THREE.Vector3(), pole = new THREE.Vector3(), dir = new THREE.Vector3();
  T.fromArray(key.h); body.localToWorld(T);
  pole.fromArray(key.p).transformDirection(body.matrixWorld);
  solveArm(B.UpperArmL, B.LowerArmL, B.Middle1L, T, pole, w);
  // weapon direction: turn the hand so the grip-to-tip axis points along key.d
  const e = weaponEnds(P.wMesh, .5), tip = P.wMesh.localToWorld(e.tip.clone()), grip = P.wMesh.localToWorld(e.grip.clone());
  dir.fromArray(key.d).normalize().transformDirection(body.matrixWorld);
  turnBone(B.Middle1L, v.subVectors(tip, grip).normalize(), dir, w);
  // the other hand grips the shaft a little below the weapon hand
  if (TWO_HANDED[P.weapon] && B.UpperArmR) {
    P.wMesh.localToWorld(tip.copy(e.tip)); P.wMesh.localToWorld(grip.copy(e.grip));
    const ax = v.subVectors(tip, grip).normalize(), hand = B.Middle1L.getWorldPosition(new THREE.Vector3());
    const along = Math.max(.02, hand.clone().sub(grip).dot(ax) - .16);
    T.copy(grip).addScaledVector(ax, along);
    pole.fromArray(POLE_R).transformDirection(body.matrixWorld);
    solveArm(B.UpperArmR, B.LowerArmR, B.Middle1R, T, pole, w);
  }
}
// per frame: sample the current move, blend in fast at the start, blend out after the attack ends
function updateArmPose(P, dt) {
  const a = P.atk; let key = null;
  if (a && a.move && MOVES[a.move]) {
    const M = MOVES[a.move];
    key = a.ct < a.hitAt ? sampleKeys(M.pre, clamp(a.ct / a.hitAt, 0, 1)) : sampleKeys(M.post, clamp((a.ct - a.hitAt) / Math.max(.01, a.endAt - a.hitAt), 0, 1));
    if (a.fromKey && a.ct < a.hitAt * .35) key = mixKey(a.fromKey, key, a.ct / (a.hitAt * .35));
    P.poseKey = key; P.poseW = Math.min(1, P.poseW + dt / .06);
  } else { P.poseW = Math.max(0, P.poseW - dt / .14); key = P.poseKey; }
  if (key && P.poseW > 0) solvePose(P, key, P.poseW);
}
