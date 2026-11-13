// Character look: 4 survivors, per-part colors, starting weapon, and a rendered HUD portrait.
// The kit paints every character from one shared palette texture. Each palette cell is assigned to a body part
// by which bones the vertices sampling it follow, so a part can be recolored by rewriting its cells.
'use strict';
const SURVIVORS = [
  {id: 'Lis', name: 'LIS', tag: 'Paramedic', g: 'F'}, {id: 'Sam', name: 'SAM', tag: 'Night guard', g: 'F'},
  {id: 'Matt', name: 'MATT', tag: 'Ex-mechanic', g: 'M'}, {id: 'Shaun', name: 'SHAUN', tag: 'Skater', g: 'M'},
];
const survivorGender = () => (SURVIVORS.find(s => s.id === LOOK.char) || SURVIVORS[2]).g;
const LOOK_PARTS = [
  {id: 'skin', label: 'Skin', sw: ['#f3cfb1', '#e0ac85', '#c68863', '#8d5a3b', '#5a3a26']},
  {id: 'hair', label: 'Hair', sw: ['#2b1d14', '#6b4226', '#b07a3a', '#e3c27a', '#c0392b', '#d8d8d8']},
  {id: 'top', label: 'Top', sw: ['#2f6fb0', '#c0392b', '#2e8b57', '#f0b429', '#333333', '#ececec', '#8e44ad']},
  {id: 'bottom', label: 'Pants', sw: ['#2c3e57', '#5a4632', '#2b2b2b', '#556b2f', '#7a7a7a']},
  {id: 'shoes', label: 'Shoes', sw: ['#3a2a1e', '#1e1e1e', '#efefef', '#9b1c1c', '#2f6fb0']},
];
const LOOK_DEFAULT = {char: 'Matt', weapon: 'Knife', colors: {}};
const LOOK = Object.assign({}, LOOK_DEFAULT);
try { const s = JSON.parse(localStorage.getItem('ozLook')); if (s && s.char) Object.assign(LOOK, s); } catch (e) {}
const lookSaved = () => { try { return !!localStorage.getItem('ozLook'); } catch (e) { return false; } };
function saveLook() { try { localStorage.setItem('ozLook', JSON.stringify(LOOK)); } catch (e) {} }

// load a survivor model on demand (only Matt ships with the first load)
const charLoading = {};
function ensureCharacter(id) { return ensureModel('Characters_' + id); }
function ensureModel(n) {
  if (MODELS[n]) return Promise.resolve();
  if (!charLoading[n]) charLoading[n] = (async () => {
    const txt = await (await fetch('assets/models/' + n + '.json')).text();
    MODELS[n] = await new Promise((res, rej) => new THREE.GLTFLoader().parse(txt, '', res, rej));
    MODELS[n].scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  })();
  return charLoading[n];
}

// ---------- palette regions ----------
const REGION_CACHE = {};
const boneRegion = n => /Head|Neck|Eye|Hair|Mouth|Jaw/.test(n) ? 'head' : /LowerArm|Wrist|Palm|Thumb|Index|Middle|Ring|Pinky|Hand|Fist/.test(n) ? 'hands'
  : /Foot|Toe|Heel/.test(n) ? 'shoes' : /Hips|UpperLeg|LowerLeg|Pelvis/.test(n) ? 'bottom' : 'top';
const isSkin = (r, g, b) => r > g && g > b && r - b > 35 && r > 90 && r - g < 90;
function atlasPixels(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0); return {c, x, d: x.getImageData(0, 0, c.width, c.height)};
}
// color key -> part, from vertex votes on the survivor's body mesh
function paletteRegions(id) {
  if (REGION_CACHE[id]) return REGION_CACHE[id];
  let body = null; MODELS['Characters_' + id].scene.traverse(o => { if (o.isSkinnedMesh && !body) body = o; });
  const img = body.material.map.image, A = atlasPixels(img), W = A.c.width, H = A.c.height, d = A.d.data;
  const uv = body.geometry.attributes.uv, si = body.geometry.attributes.skinIndex, sw = body.geometry.attributes.skinWeight, bones = body.skeleton.bones;
  const votes = {};
  for (let i = 0; i < uv.count; i++) {
    let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const w = comp(sw, i, k); if (w > best) { best = w; bi = comp(si, i, k); } }
    const px = clamp(Math.floor(uv.getX(i) * W), 0, W - 1), py = clamp(Math.floor(uv.getY(i) * H), 0, H - 1), o = (py * W + px) * 4;
    const key = d[o] << 16 | d[o + 1] << 8 | d[o + 2];
    let reg = boneRegion(bones[bi].name);
    if (reg === 'head' || reg === 'hands') reg = isSkin(d[o], d[o + 1], d[o + 2]) ? 'skin' : reg === 'head' ? 'hair' : 'top';
    (votes[key] = votes[key] || {})[reg] = (votes[key][reg] || 0) + 1;
  }
  const map = {};
  for (const k in votes) { let br = null, bn = 0; for (const r in votes[k]) if (votes[k][r] > bn) { bn = votes[k][r]; br = r; } map[k] = br; }
  return (REGION_CACHE[id] = {map, img});
}
const comp = (a, i, k) => k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i); // r128 has no getComponent
const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;
// a recolored copy of the palette texture for this look
function lookTexture(look, srcTex) {
  const {map, img} = paletteRegions(look.char), A = atlasPixels(img), d = A.d.data;
  // mean brightness per part, so stripes and shading inside a part keep their contrast
  const sum = {}, cnt = {};
  for (let i = 0; i < d.length; i += 4) { const k = d[i] << 16 | d[i + 1] << 8 | d[i + 2], r = map[k]; if (r && look.colors[r]) { sum[r] = (sum[r] || 0) + lum(d[i], d[i + 1], d[i + 2]); cnt[r] = (cnt[r] || 0) + 1; } }
  const tgt = {}; for (const r in look.colors) if (look.colors[r]) tgt[r] = new THREE.Color(look.colors[r]);
  for (let i = 0; i < d.length; i += 4) {
    const k = d[i] << 16 | d[i + 1] << 8 | d[i + 2], r = map[k]; if (!r || !tgt[r]) continue;
    const f = clamp(lum(d[i], d[i + 1], d[i + 2]) / (sum[r] / cnt[r]), .55, 1.45), t = tgt[r];
    d[i] = clamp(t.r * 255 * f, 0, 255); d[i + 1] = clamp(t.g * 255 * f, 0, 255); d[i + 2] = clamp(t.b * 255 * f, 0, 255);
  }
  A.x.putImageData(A.d, 0, 0);
  const tex = new THREE.CanvasTexture(A.c); tex.flipY = srcTex.flipY; tex.encoding = srcTex.encoding; tex.magFilter = srcTex.magFilter; tex.minFilter = srcTex.minFilter; tex.generateMipmaps = srcTex.generateMipmaps;
  return tex;
}
// apply to a rig: only the body mesh changes, weapons keep the original palette
function applyLook(rig, look) {
  let tex = null;
  rig.model.traverse(o => { if (o.isSkinnedMesh) { tex = tex || lookTexture(look, o.material.map); o.material.map = tex; o.material.needsUpdate = true; } });
}

// ---------- portrait for the HUD ----------
const PORTRAIT = {img: null};
function renderPortrait(rig) {
  const S = 192, r = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
  r.setSize(S, S); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.2));
  const k = new THREE.DirectionalLight(0xfff0dd, 1.8); k.position.set(1.5, 2, 3); sc.add(k);
  const m = THREE.SkeletonUtils.clone(rig.model); m.traverse(o => { if (o.isMesh && WEAPON_MESHES.includes(o.name)) o.visible = false; });
  const mix = new THREE.AnimationMixer(m), idle = MODELS['Characters_' + LOOK.char].animations.find(a => a.name === 'Idle');
  if (idle) { mix.clipAction(idle).play(); mix.update(.3); }
  sc.add(m); m.updateMatrixWorld(true);
  let head = null; m.traverse(o => { if (o.isBone && o.name === 'Head') head = o; });
  const hp = head ? head.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.5, 0);
  const cam = new THREE.PerspectiveCamera(30, 1, .01, 20); cam.position.set(hp.x + .3, hp.y + .38, hp.z + 1.7); cam.lookAt(hp.x, hp.y + .3, hp.z);
  r.render(sc, cam); const img = new Image(); img.src = r.domElement.toDataURL('image/png'); PORTRAIT.img = img; r.dispose();
  return img.src;
}

// ---------- Dr. Adler ----------
// Doc wears a white lab coat over dark trousers, has grey hair and round glasses. Used for his radio face and for Patient Zero.
const DOC_LOOK = {skin: '#e9c4a4', top: '#f2f2ec', hair: '#8e9094', bottom: '#2c3445', shoes: '#1e1e1e'};
function dressDoc(model, char) {
  if (model.userData.doc) return; model.userData.doc = true;
  let tex = null;
  model.traverse(o => { if (o.isSkinnedMesh) { tex = tex || lookTexture({char, colors: DOC_LOOK}, o.material.map); o.material = o.material.clone(); o.material.map = tex; o.material.needsUpdate = true; } });
  let head = null; model.traverse(o => { if (o.isBone && o.name === 'Head') head = o; }); if (!head) return;
  const mat = new THREE.MeshStandardMaterial({color: 0x15171c, metalness: .6, roughness: .35}), lens = new THREE.MeshStandardMaterial({color: 0xbfe6ff, transparent: true, opacity: .35, metalness: .2, roughness: .05});
  const g = new THREE.Group();
  for (const sx of [-1, 1]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(.062, .013, 6, 18), mat); rim.position.x = sx * .075; g.add(rim);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(.058, 16), lens); gl.position.set(sx * .075, 0, .002); g.add(gl);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .16), mat); arm.position.set(sx * .14, .01, -.08); g.add(arm); }
  const br = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .012), mat); br.position.y = .02; g.add(br);
  // place the glasses in front of the eyes, measured in the model's rest pose
  model.updateMatrixWorld(true); const s = model.getWorldScale(new THREE.Vector3()).y;
  const hp = head.getWorldPosition(new THREE.Vector3()), eye = hp.clone().add(new THREE.Vector3(0, DOC_EYE.y * s, DOC_EYE.z * s));
  head.add(g); g.position.copy(head.worldToLocal(eye)); g.scale.setScalar(s / head.getWorldScale(new THREE.Vector3()).y);
  const hq = head.getWorldQuaternion(new THREE.Quaternion()).invert(), mq = model.getWorldQuaternion(new THREE.Quaternion()); g.quaternion.copy(hq.multiply(mq));
}
const DOC_EYE = {y: .2, z: .26};
