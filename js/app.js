// Interactive editor for the a/b/c decorations of the 3D chair ("l-tile").
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as C from './core.js';

const $ = (id) => document.getElementById(id);
const STATE_KEY = 'newl.decorations.v1';
const UI_KEY = 'newl.ui.v1';
const TYPES = ['a', 'b', 'c'];
const CLICK_TOOLS = ['flip', 'subdivide', 'delvert']
const MESH_TOOLS = ['vertex', ...CLICK_TOOLS]; // tools that act on mesh elements: always show the mesh; // one click edits the mesh topology
const TYPE_COLOR = { a: new THREE.Color(0xe07a5f), b: new THREE.Color(0x4aa3b8), c: new THREE.Color(0xe9c46a) };
const TOOL_COLOR = { grab: 0xffffff, pull: 0x8be08b, push: 0xffa25c, smooth: 0x7fb2ff, flatten: 0xbbbbbb, vertex: 0xff6bd6, flip: 0xffe066, refine: 0x9b8cff, subdivide: 0x9b8cff, delvert: 0xff7a7a };
const S3 = [[0, 1, 0], [1, 0, 0], [0, 0, -1]];

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const ui = Object.assign({
  view: 'tile', level: 1, explode: 0, peel: 0, tool: 'grab', radius: 0.3, strength: 0.5,
  colorBy: 'auto', snapStep: 0.5, cancel: true, invertOrbit: false, flat: false, wire: false, outlines: true, backfaces: true,
}, store.get(UI_KEY) || {}, { radius: 0.3, strength: 0.5, colorBy: 'auto', snapStep: 0.5, cancel: true, invertOrbit: false, outlines: true, backfaces: true });
if (ui.view !== 'tiling') ui.explode = 0;

// ------------------------------------------------------------------ state

const r6 = (arr) => Array.from(arr, (v) => Math.round(v * 1e6) / 1e6);
const meshToJSON = (m) => ({ pos: r6(m.pos), rest: r6(m.rest), tri: Array.from(m.tri) });

function meshFromJSON(type, o) {
  if (!o || !Array.isArray(o.pos) || !Array.isArray(o.rest) || !Array.isArray(o.tri)) return null;
  if (o.pos.length !== o.rest.length || o.pos.length % 3 || o.tri.length % 3 || o.pos.length > 3e5 || o.tri.length > 6e5) return null;
  const V = o.pos.length / 3;
  if (!o.tri.every((i) => Number.isInteger(i) && i >= 0 && i < V)) return null;
  try {
    const m = C.makeMesh(type, Float32Array.from(o.rest), Uint32Array.from(o.tri), Float32Array.from(o.pos));
    return type === 'c' && !C.cIsSymmetric(m) ? null : m;
  } catch { return null; }
}

function stateFromJSON(o) {
  if (!o || !Number.isInteger(o.n) || o.n < 2 || o.n > 128) return null;
  if (o.version === 2) {
    const a = meshFromJSON('a', o.a), c = meshFromJSON('c', o.c);
    if (!a || !c) return null;
    C.symmetrizeC(c);
    return { n: o.n, a, c };
  }
  // version 1: plain (n+1)^2 grids
  const len = (o.n + 1) ** 2 * 3;
  if (!Array.isArray(o.a) || !Array.isArray(o.c) || o.a.length !== len || o.c.length !== len) return null;
  const st = C.makeState(o.n);
  st.a.pos.set(o.a); st.c.pos.set(o.c);
  C.symmetrizeC(st.c);
  return st;
}
const stateToJSON = (st) => ({ format: 'newl-ltile-decorations', version: 2, n: st.n, a: meshToJSON(st.a), c: meshToJSON(st.c) });

let state = stateFromJSON(store.get(STATE_KEY)) || C.presetState('bumps', 16);
const saveState = () => store.set(STATE_KEY, stateToJSON(state));
const saveUI = () => store.set(UI_KEY, ui);

// ------------------------------------------------------------------ renderer / scene

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d23);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const keyLight = new THREE.DirectionalLight(0xffffff, 1.7);
keyLight.position.set(3, 5, 4);
const fillLight = new THREE.DirectionalLight(0xb8c8ff, 0.55);
fillLight.position.set(-4, -2, -3);
scene.add(keyLight, fillLight);

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
const world = new THREE.Group();
scene.add(world);

// our pointerdown must be registered before the controls' so it can claim the drag
canvas.addEventListener('pointerdown', onPointerDown);

// Free trackball: rotations are applied about the camera's own screen axes, so there are no poles
// and no gimbal lock. The object follows the mouse (drag right -> the near side moves right).
const controls = (() => {
  const c = { enabled: true, target: new THREE.Vector3() };
  let drag = null;
  const ax = new THREE.Vector3(), q = new THREE.Quaternion(), off = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (e) => {
    if (!c.enabled) return;
    drag = { id: e.pointerId, mode: e.button === 0 ? 'rotate' : e.button === 1 ? 'dolly' : 'pan', x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !c.enabled) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    off.copy(camera.position).sub(c.target);
    if (drag.mode === 'rotate') {
      const k = 0.005;
      const up = ax.set(0, 1, 0).applyQuaternion(camera.quaternion).clone();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      // object rotation Ro = R(up, dx) * R(right, dy); the camera takes its inverse
      const ro = new THREE.Quaternion().setFromAxisAngle(up, dx * k).multiply(q.setFromAxisAngle(right, dy * k));
      const inv = ro.invert();
      camera.quaternion.premultiply(inv).normalize();
      off.applyQuaternion(inv);
    } else if (drag.mode === 'pan') {
      const s = 2 * off.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      c.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
    } else off.multiplyScalar(Math.exp(dy * 0.01));
    camera.position.copy(c.target).add(off);
    pointer.moved = true;
  });
  const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    off.copy(camera.position).sub(c.target).multiplyScalar(Math.exp(e.deltaY * 0.001));
    camera.position.copy(c.target).add(off);
  }, { passive: false });
  return c;
})();

// coarse meshes: keep the brush wide enough to always reach a vertex
const brushR = () => Math.max(ui.radius, C.meanEdge(state.a), C.meanEdge(state.c));

const backTint = { value: ui.backfaces ? 0.75 : 0 };
const solidMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.5, metalness: 0, flatShading: ui.flat, side: THREE.DoubleSide, transparent: true,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});
solidMat.onBeforeCompile = (sh) => {
  sh.uniforms.uBackTint = backTint;
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uBackTint;')
    .replace('#include <color_fragment>',
      '#include <color_fragment>\nif (!gl_FrontFacing) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.06, 0.3), uBackTint); diffuseColor.a *= mix(1.0, 0.25, step(0.001, uBackTint)); }');
};
const wireMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.25, depthWrite: false });
const lineMat = new THREE.LineBasicMaterial({ color: 0x10131a, transparent: true, opacity: 0.55 });
const dashMat = new THREE.LineDashedMaterial({ color: 0x10131a, dashSize: 0.04, gapSize: 0.03, transparent: true, opacity: 0.6 });

// ------------------------------------------------------------------ decoration geometries

const geo = {}; // geo[type] = { gP, gN, posAttr, normAttr, baseIdx }

function buildGeometries() {
  for (const t of TYPES) if (geo[t]) { geo[t].gP.dispose(); geo[t].gN.dispose(); }
  const aRev = C.reversedIndices(state.a.tri), cRev = C.reversedIndices(state.c.tri);
  for (const t of TYPES) {
    const mesh = t === 'c' ? state.c : state.a, len = mesh.pos.length;
    const posAttr = new THREE.BufferAttribute(new Float32Array(len), 3).setUsage(THREE.DynamicDrawUsage);
    const normAttr = new THREE.BufferAttribute(new Float32Array(len), 3).setUsage(THREE.DynamicDrawUsage);
    // b = S(a) turned inside out, so its natural winding is the reversed winding of a
    const baseIdx = t === 'b' ? aRev : mesh.tri;
    const flipIdx = t === 'b' ? state.a.tri : t === 'a' ? aRev : cRev;
    const mk = (index) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', posAttr);
      g.setAttribute('normal', normAttr);
      g.setIndex(new THREE.BufferAttribute(index, 1));
      return g;
    };
    // gP for orientation-preserving placements, gN (reversed winding) for reflections
    geo[t] = { gP: mk(baseIdx), gN: mk(flipIdx), posAttr, normAttr, baseIdx };
  }
  syncGeometry(new Set(['a', 'c']));
}

function markDirty(t) {
  const g = geo[t];
  C.vertexNormals(g.posAttr.array, g.baseIdx, g.normAttr.array);
  g.posAttr.needsUpdate = true;
  g.normAttr.needsUpdate = true;
  g.gP.computeBoundingSphere();
  g.gN.boundingSphere = g.gP.boundingSphere.clone();
  for (const m of meshes) if (m.type === t) m.solid.boundingSphere = null;
}

function syncGeometry(touched) {
  if (touched.has('a')) {
    geo.a.posAttr.array.set(state.a.pos);
    C.applyS(state.a.pos, geo.b.posAttr.array);
    markDirty('a');
    markDirty('b');
  }
  if (touched.has('c')) {
    geo.c.posAttr.array.set(state.c.pos);
    markDirty('c');
  }
}

// ------------------------------------------------------------------ layout (which decorations go where)

let layout = null;
let meshes = []; // { type, sign, solid, wire, recs }
let visibleRecs = []; // every placed decoration of the visible tiles (what brushes act on)
let shownRecs = []; // those actually drawn / exported: visibleRecs minus cancelled coincident faces
let cancelledCount = 0;
const extras = new THREE.Group(); // outlines, labels
world.add(extras);

function buildLayout() {
  const L = { recs: [], tiles: [], scale: 1, level: 0 };
  if (ui.view === 'deco') {
    const off = { a: [-0.12, 0, 0], b: [0, -0.12, 0], c: [0, 0, 0] };
    TYPES.forEach((t, i) => {
      L.tiles.push({ key: 0 });
      L.recs.push({ type: t, tile: i, M: C.translateMat(off[t]) });
    });
  } else {
    L.level = ui.view === 'tile' ? 0 : ui.level;
    L.scale = 1 / 2 ** L.level;
    const patchC = C.LTILE_CENTROID.map((v) => v * 2 ** L.level);
    C.placements(L.level).forEach((T, ti) => {
      const c = C.applyPt(T, C.LTILE_CENTROID);
      L.tiles.push({ T, off: c.map((v, k) => v - patchC[k]), key: c[0] + c[1] + c[2] + 1e-3 * ti });
      for (const [type, M] of C.CHAIR) L.recs.push({ type, tile: ti, M: C.mul(T, M) });
    });
  }
  for (const r of L.recs) r.det = C.det3(r.M) > 0 ? 1 : -1;
  return L;
}

function hiddenTiles() {
  const hidden = new Set();
  if (ui.view !== 'tiling' || ui.peel <= 0) return hidden;
  const order = layout.tiles.map((t, i) => i).sort((i, j) => layout.tiles[j].key - layout.tiles[i].key);
  const k = Math.min(order.length - 1, Math.floor(ui.peel * order.length));
  for (let i = 0; i < k; i++) hidden.add(order[i]);
  return hidden;
}

function displayMatrix(r) {
  if (ui.view === 'tiling' && ui.explode > 0) {
    const off = layout.tiles[r.tile].off.map((v) => v * ui.explode);
    return C.mul(C.translateMat(off), r.M);
  }
  return r.M;
}

const toThree = (M) => new THREE.Matrix4().set(...M[0], ...M[1], ...M[2], ...M[3]);

function colorFor(r) {
  const mode = ui.view === 'tiling' ? 'tile' : 'type';
  if (mode === 'type') return TYPE_COLOR[r.type];
  const hue = (r.tile * 0.618034) % 1;
  const col = new THREE.Color().setHSL(hue, 0.42, 0.6);
  if (mode === 'both') col.lerp(TYPE_COLOR[r.type], 0.35);
  return col;
}

function rebuildMeshes() {
  for (const m of meshes) { world.remove(m.solid, m.wire); m.solid.dispose(); m.wire.dispose(); }
  meshes = [];
  layout = buildLayout();
  world.scale.setScalar(layout.scale);
  for (const type of TYPES)
    for (const sign of [1, -1]) {
      const cap = layout.recs.filter((r) => r.type === type && r.det === sign).length;
      if (!cap) continue;
      const g = sign > 0 ? geo[type].gP : geo[type].gN;
      const solid = new THREE.InstancedMesh(g, solidMat, cap);
      solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      solid.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
      solid.frustumCulled = false;
      const wire = new THREE.InstancedMesh(g, wireMat, cap);
      wire.instanceMatrix = solid.instanceMatrix;
      wire.frustumCulled = false;
      wire.renderOrder = 1; // draw after every solid; both are transparent, so otherwise camera-dependent depth sorting hides the mesh
      wire.raycast = () => {};
      meshes.push({ type, sign, solid, wire, recs: [] });
      world.add(solid, wire);
    }
  refreshInstances();
}

// signature of a decoration's placed surface, for the rare coincident pair that isn't a|b or c|c
function surfaceSig(r) {
  const M = displayMatrix(r), pos = r.type === 'c' ? state.c.pos : r.type === 'a' ? state.a.pos : C.applyS(state.a.pos);
  const out = [];
  for (let k = 0; k < pos.length; k += 3) out.push(C.applyPt(M, [pos[k], pos[k + 1], pos[k + 2]]).map((v) => Math.round(v * 1e4)).join(','));
  return out.sort().join(';');
}

const wireOn = () => ui.wire || MESH_TOOLS.includes(ui.tool);
function updateWire() { for (const m of meshes) m.wire.visible = wireOn(); }

function refreshInstances() {
  const hidden = hiddenTiles();
  visibleRecs = layout.recs.filter((r) => !hidden.has(r.tile));
  for (const r of visibleRecs) r.W = toThree(displayMatrix(r));
  const gone = ui.cancel && ui.view !== 'deco' ? C.cancelCoincident(visibleRecs, displayMatrix, surfaceSig) : new Set();
  cancelledCount = gone.size;
  shownRecs = [];
  for (const m of meshes) {
    let k = 0;
    m.recs = [];
    for (const r of visibleRecs) {
      if (r.type !== m.type || r.det !== m.sign || gone.has(r)) continue;
      m.solid.setMatrixAt(k, r.W);
      m.solid.setColorAt(k, colorFor(r));
      m.recs.push(r);
      k++;
    }
    m.solid.count = m.wire.count = k;
    m.solid.instanceMatrix.needsUpdate = true;
    m.solid.instanceColor.needsUpdate = true;
    m.solid.boundingSphere = null;
    m.solid.userData.recs = m.recs;
    m.wire.visible = wireOn();
    shownRecs.push(...m.recs);
  }
  rebuildExtras(hidden);
  updateStats();
}

// ------------------------------------------------------------------ outlines and labels

const LTILE_EDGES = (() => {
  const seen = new Map();
  for (const f of C.LTILE_FACETS)
    f.forEach((p, i) => {
      const q = f[(i + 1) % f.length];
      const k = [p.join(), q.join()].sort().join('|');
      if (!seen.has(k)) seen.set(k, [p, q]);
    });
  return [...seen.values()];
})();

function labelSprite(text, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 84px -apple-system, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#' + color.getHexString();
  ctx.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.setScalar(0.28);
  sp.raycast = () => {};
  return sp;
}

function rebuildExtras(hidden) {
  for (const o of [...extras.children]) { extras.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); }
  extras.visible = ui.outlines;
  const pts = [];
  const seg = (p, q) => pts.push(...p, ...q);
  if (ui.view === 'deco') {
    const off = { a: [-0.12, 0, 0], b: [0, -0.12, 0], c: [0, 0, 0] };
    for (const t of TYPES) {
      const sq = C.DECO_SQUARE[t].map((p) => p.map((v, i) => v + off[t][i]));
      sq.forEach((p, i) => seg(p, sq[(i + 1) % 4]));
    }
    const diag = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 0)]);
    const dl = new THREE.Line(diag, dashMat);
    dl.computeLineDistances();
    extras.add(dl);
  } else {
    layout.tiles.forEach((tile, ti) => {
      if (hidden.has(ti)) return;
      const off = ui.view === 'tiling' ? tile.off.map((v) => v * ui.explode) : [0, 0, 0];
      const M = C.mul(C.translateMat(off), tile.T);
      for (const [p, q] of LTILE_EDGES) seg(C.applyPt(M, p), C.applyPt(M, q));
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  extras.add(new THREE.LineSegments(g, lineMat));
}

// ------------------------------------------------------------------ picking and stamps

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointer = { inside: false, moved: false, shift: false, buttons: 0 };
let orbitOverride = false;
let stroke = null;

function pick() {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(meshes.map((m) => m.solid), false);
  if (!hits.length) return null;
  const h = hits[0];
  const rec = h.object.userData.recs[h.instanceId];
  const W = new THREE.Matrix4().multiplyMatrices(world.matrixWorld, rec.W);
  const normal = h.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(W)).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
  return { point: h.point.clone(), normal, rec, face: h.faceIndex };
}

const rows3 = (m3) => { const e = m3.elements; return [[e[0], e[3], e[6]], [e[1], e[4], e[7]], [e[2], e[5], e[8]]]; };
const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));

// Brush centre expressed in the stored decoration frames, for every decoration of the touched tile.
function stampsFor(hit) {
  const out = [];
  for (const rec of visibleRecs) {
    if (rec.tile !== hit.rec.tile) continue;
    const inv = new THREE.Matrix4().multiplyMatrices(world.matrixWorld, rec.W).invert();
    const q = hit.point.clone().applyMatrix4(inv);
    const sq = C.DECO_SQUARE[rec.type];
    const lo = [0, 1].map((d) => Math.min(...sq.map((p) => p[d]))), hi = [0, 1].map((d) => Math.max(...sq.map((p) => p[d])));
    const dx = Math.max(lo[0] - q.x, 0, q.x - hi[0]), dy = Math.max(lo[1] - q.y, 0, q.y - hi[1]);
    if (Math.hypot(dx, dy) > brushR() + 0.5) continue;
    out.push(...stampsForRec(rec, hit.point));
  }
  return out;
}

// Stamps for one placed decoration (c also gets its S-mirrored twin).
function stampsForRec(rec, point) {
  const inv = new THREE.Matrix4().multiplyMatrices(world.matrixWorld, rec.W).invert();
  const q = point.clone().applyMatrix4(inv);
  const L = rows3(new THREE.Matrix3().setFromMatrix4(inv));
  const p = [q.x, q.y, q.z];
  if (rec.type === 'a') return [{ store: 'a', center: p, vec: L, nsign: 1 }];
  if (rec.type === 'b') return [{ store: 'a', center: C.applyPt(C.S4, p), vec: mul3(S3, L), nsign: -1 }];
  const st = { store: 'c', center: p, vec: L, nsign: 1 };
  return [st, C.mirrorStamp(st)];
}

// Vertex the Vertex tool would drag for this hit, and its world position on the touched decoration.
function vertexTarget(hit) {
  const grab = C.vertexGrabBegin(state, stampsForRec(hit.rec, hit.point));
  if (!grab.terms.length) return null;
  const { st, ws } = grab.terms[0];
  const p = [0, 1, 2].map((d) => state[st.store].pos[ws[0] + d]);
  return { grab, pos: storeToScene(hit.rec, p) };
}

// A point of a stored mesh (a/c frame) -> scene coordinates on the given placed decoration.
function storeToScene(rec, p) {
  const f = rec.type === 'b' ? C.applyPt(C.S4, p) : p;
  return new THREE.Vector3(...f).applyMatrix4(new THREE.Matrix4().multiplyMatrices(world.matrixWorld, rec.W));
}

// Edge [u, v] of triangle `tri` of `mesh` nearest to `center` (store frame).
function nearestEdge(mesh, tri, center) {
  let best = null, bd = Infinity;
  const P = mesh.pos;
  for (let e = 0; e < 3; e++) {
    const u = mesh.tri[3 * tri + e], v = mesh.tri[3 * tri + (e + 1) % 3];
    const a = [P[3 * u], P[3 * u + 1], P[3 * u + 2]], b = [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
    const ab = b.map((x, i) => x - a[i]), ac = center.map((x, i) => x - a[i]);
    const t = Math.min(1, Math.max(0, (ab[0] * ac[0] + ab[1] * ac[1] + ab[2] * ac[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
    const d = Math.hypot(ac[0] - t * ab[0], ac[1] - t * ab[1], ac[2] - t * ab[2]);
    if (d < bd) { bd = d; best = [u, v]; }
  }
  return best;
}

// Flip / Refine: one click changes the topology of the touched store (and, for c, its mirror).
function topologyEdit(hit) {
  const sts = stampsForRec(hit.rec, hit.point), st = sts[0], mesh = state[st.store];
  let next = null;
  if (ui.tool === 'flip') {
    const [u, v] = nearestEdge(mesh, hit.face, st.center);
    next = C.flipEdge(mesh, u, v);
    if (typeof next === 'string') { toast(next); return false; }
  } else if (ui.tool === 'delvert') {
    const v = C.nearestInterior(state, st);
    next = v < 0 ? 'No interior vertex here' : C.deleteVertex(mesh, v);
    if (typeof next === 'string') { toast(next); return false; }
  } else if (ui.tool === 'subdivide') {
    next = C.refineTriangles(mesh, [hit.face]);
    if (!next) { toast('That triangle is surrounded by boundary edges and can’t be split'); return false; }
  } else {
    next = C.refineTriangles(mesh, C.trianglesNear(mesh, st.center, brushR() * 0.5, hit.face));
    if (!next) { toast('Nothing to refine here'); return false; }
  }
  pushUndo();
  setState({ ...state, [st.store]: next });
  return true;
}

// Flip preview: the quad around the edge (yellow fill), the edge, and the diagonal it would become.
const hiMat = (c, extra = {}) => ({ color: c, depthTest: false, ...extra });
const edgeHi = new THREE.Group();
const quadHi = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(hiMat(0xffffff, { transparent: true, opacity: 0.55, side: THREE.DoubleSide })));
const edgeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial(hiMat(0xff2d2d)));
const newLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial(hiMat(0x39ff88)));
edgeHi.add(quadHi, edgeLine, newLine);
edgeHi.children.forEach((o) => { o.renderOrder = 11; o.frustumCulled = false; o.raycast = () => {}; });
edgeHi.visible = false;
scene.add(edgeHi);

// setFromPoints can't grow an existing buffer, so replace the attribute each time
const setPts = (g, pts) => g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));

function showStar(hit) {
  const st = stampsForRec(hit.rec, hit.point)[0], mesh = state[st.store], v = C.nearestInterior(state, st);
  if (v < 0) { edgeHi.visible = false; return; }
  const at = (i) => storeToScene(hit.rec, [mesh.pos[3 * i], mesh.pos[3 * i + 1], mesh.pos[3 * i + 2]]);
  const pts = [], link = [];
  for (let t = 0; t < mesh.tri.length; t += 3) {
    const tri = [mesh.tri[t], mesh.tri[t + 1], mesh.tri[t + 2]];
    if (tri.includes(v)) { pts.push(...tri.map(at)); link.push(...tri.filter((q) => q !== v)); }
  }
  setPts(quadHi.geometry, pts);
  setPts(edgeLine.geometry, [at(v), at(v)]);
  setPts(newLine.geometry, [at(v), at(v)]);
  edgeHi.visible = true;
}

function showTriangle(hit) {
  const st = stampsForRec(hit.rec, hit.point)[0], mesh = state[st.store];
  const at = (e) => { const i = mesh.tri[3 * hit.face + e]; return storeToScene(hit.rec, [mesh.pos[3 * i], mesh.pos[3 * i + 1], mesh.pos[3 * i + 2]]); };
  setPts(quadHi.geometry, [at(0), at(1), at(2)]);
  setPts(edgeLine.geometry, [at(0), at(1), at(2), at(0)]);
  setPts(newLine.geometry, [at(0), at(0)]);
  edgeHi.visible = true;
}

function showEdge(hit) {
  const st = stampsForRec(hit.rec, hit.point)[0], mesh = state[st.store];
  const [u, v] = nearestEdge(mesh, hit.face, st.center);
  const at = (i) => storeToScene(hit.rec, [mesh.pos[3 * i], mesh.pos[3 * i + 1], mesh.pos[3 * i + 2]]);
  const tris = C.edgeMap(mesh).get(u < v ? u * (mesh.rest.length / 3) + v : v * (mesh.rest.length / 3) + u)[2];
  const opp = tris.map((t) => [0, 1, 2].map((e) => mesh.tri[3 * t + e]).find((q) => q !== u && q !== v));
  setPts(edgeLine.geometry, [at(u), at(v)]);
  if (opp.length === 2) {
    setPts(quadHi.geometry, [at(u), at(v), at(opp[0]), at(u), at(v), at(opp[1])]);
    setPts(newLine.geometry, [at(opp[0]), at(opp[1])]);
  } else {
    setPts(quadHi.geometry, [at(u), at(v), at(opp[0])]);
    setPts(newLine.geometry, [at(u), at(u)]);
  }
  edgeHi.visible = true;
}

// ------------------------------------------------------------------ strokes

const undoStack = [], redoStack = [];
function pushUndo() {
  undoStack.push(C.cloneState(state));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
}
function setState(s) {
  const topoChanged = !C.sameTopology(s, state);
  state = s;
  if (topoChanged) { buildGeometries(); rebuildMeshes(); }
  else syncGeometry(new Set(['a', 'c']));
  $('res').value = String(state.n);
  saveState();
  updateUndoButtons();
  updateStats();
}
function undo() { if (!undoStack.length) return; redoStack.push(C.cloneState(state)); setState(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(C.cloneState(state)); setState(redoStack.pop()); }
function updateUndoButtons() { $('undo').disabled = !undoStack.length; $('redo').disabled = !redoStack.length; }

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointer.shift = e.shiftKey;
  pointer.moved = true;
}

// ---- grid snapping (Vertex tool): the dragged vertex lands on the lattice of multiples of ui.snapStep
// in its own (store) frame. Works through the stamp's world->store map, then maps the snapped
// displacement back, so grabMove (and c's mirror partner) stay unchanged.
function inv3(M) {
  const [[a, b, c], [d, e, f], [g, h, i]] = M;
  const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const mulV3 = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

function snappedDelta(grab, d) {
  const { st, ws } = grab.terms[0], k = ws[0], start = grab.start[st.store].pos;
  const sd = mulV3(st.vec, d), p0 = [start[k], start[k + 1], start[k + 2]];
  const snapped = p0.map((v, i) => C.snapValue(v + sd[i], ui.snapStep));
  return mulV3(inv3(st.vec), snapped.map((v, i) => v - p0[i]));
}

function onPointerDown(e) {
  if (e.button !== 0 || orbitOverride || e.altKey || e.metaKey || e.ctrlKey) return;
  setPointer(e);
  const hit = pick();
  if (!hit) return;
  controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  if (CLICK_TOOLS.includes(ui.tool)) {
    stroke = { tool: ui.tool, pointerId: e.pointerId, changed: false, click: true };
    topologyEdit(hit);
    e.preventDefault();
    return;
  }
  pushUndo();
  stroke = { tool: ui.tool, pointerId: e.pointerId, changed: false };
  if (ui.tool === 'vertex') {
    const vt = vertexTarget(hit);
    if (!vt) { undoStack.pop(); updateUndoButtons(); stroke = null; controls.enabled = true; return; }
    stroke.grab = vt.grab;
    stroke.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), vt.pos);
    stroke.start = vt.pos.clone();
    stroke.rec = hit.rec;
    stroke.normal = hit.normal.clone();
    placeCursor(vt.pos, hit.normal);
  } else if (ui.tool === 'grab') {
    stroke.grab = C.grabBegin(state, stampsFor(hit), brushR());
    stroke.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
    stroke.start = hit.point.clone();
    stroke.normal = hit.normal.clone();
    placeCursor(hit.point, hit.normal);
  }
  e.preventDefault();
}

canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  pointer.inside = true;
  pointer.buttons = e.buttons;
  if ((stroke?.tool === 'grab' || stroke?.tool === 'vertex') && e.pointerId === stroke.pointerId) {
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(stroke.plane, p)) {
      const d = p.clone().sub(stroke.start);
      const snap = stroke.tool === 'vertex';
      syncGeometry(C.grabMove(state, stroke.grab, snap ? snappedDelta(stroke.grab, [d.x, d.y, d.z]) : [d.x, d.y, d.z]));
      stroke.changed = true;
      if (snap) {
        const { st, ws } = stroke.grab.terms[0], P = state[st.store].pos;
        placeCursor(storeToScene(stroke.rec, [P[ws[0]], P[ws[0] + 1], P[ws[0] + 2]]), stroke.normal);
      } else placeCursor(p, stroke.normal);
    }
  }
});
canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

function endStroke(e) {
  pointer.buttons = 0;
  if (!stroke || (e && e.pointerId !== stroke.pointerId)) return;
  if (canvas.hasPointerCapture(stroke.pointerId)) canvas.releasePointerCapture(stroke.pointerId);
  controls.enabled = true;
  if (!stroke.changed && !stroke.click) { undoStack.pop(); updateUndoButtons(); }
  else if (stroke.changed) saveState();
  stroke = null;
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function airbrush(dt) {
  if (!pointer.inside) return;
  const hit = pick();
  if (!hit) { cursor.visible = false; return; }
  placeCursor(hit.point, hit.normal);
  let tool = stroke.tool;
  let amt = ui.strength * dt * 1.6;
  if (tool === 'push') { tool = 'pull'; amt = -amt; }
  if (tool === 'pull' && pointer.shift) amt = -amt;
  syncGeometry(C.applyBrush(state, stampsFor(hit), tool, brushR(), amt));
  stroke.changed = true;
}

// ------------------------------------------------------------------ brush cursor

const cursor = new THREE.Group();
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false });
cursor.add(new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 72), ringMat));
cursor.add(new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), ringMat));
cursor.renderOrder = 10;
cursor.children.forEach((c) => { c.renderOrder = 10; });
cursor.visible = false;
scene.add(cursor);
const Z = new THREE.Vector3(0, 0, 1);

function placeCursor(point, normal) {
  const tool = stroke ? stroke.tool : ui.tool;
  const inverted = (tool === 'pull' || tool === 'push') && pointer.shift;
  ringMat.color.setHex(TOOL_COLOR[inverted ? (tool === 'pull' ? 'push' : 'pull') : tool]);
  cursor.position.copy(point).addScaledVector(normal, 0.003 * layout.scale);
  cursor.quaternion.setFromUnitVectors(Z, normal);
  cursor.scale.setScalar((tool === 'vertex' ? 0.05 : brushR()) * layout.scale);
  cursor.visible = true;
}

function hoverCursor() {
  if (stroke?.tool === 'grab' || stroke?.tool === 'vertex') return;
  edgeHi.visible = false;
  if (!pointer.inside || orbitOverride || (pointer.buttons && !stroke)) { cursor.visible = false; return; }
  if (stroke) return; // airbrush places it
  const hit = pick();
  if (!hit) { cursor.visible = false; return; }
  if (ui.tool === 'flip') { cursor.visible = false; showEdge(hit); return; }
  if (ui.tool === 'subdivide') { cursor.visible = false; showTriangle(hit); return; }
  if (ui.tool === 'delvert') { cursor.visible = false; showStar(hit); return; }
  const vt = ui.tool === 'vertex' ? vertexTarget(hit) : null;
  placeCursor(vt ? vt.pos : hit.point, hit.normal);
}

// ------------------------------------------------------------------ camera

function resetCamera() {
  if (ui.view === 'deco') {
    controls.target.set(0.05, -0.1, 0);
    camera.position.set(0.45, -3.1, 4.4);
  } else {
    controls.target.set(-0.1, -0.1, -0.1);
    camera.position.set(4.6, 3.6, 3.9);
  }
  camera.up.set(0, 0, 1);
  camera.lookAt(controls.target);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

// ------------------------------------------------------------------ export

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// triangles of one decoration type in its own frame, CCW from outside
function decoTriangles(type) {
  const pos = type === 'a' ? state.a.pos : type === 'c' ? state.c.pos : C.applyS(state.a.pos);
  const idx = type === 'b' ? C.reversedIndices(state.a.tri) : type === 'a' ? state.a.tri : state.c.tri;
  const tris = [];
  for (let t = 0; t < idx.length; t += 3)
    tris.push([0, 1, 2].map((e) => [pos[idx[t + e] * 3], pos[idx[t + e] * 3 + 1], pos[idx[t + e] * 3 + 2]]));
  return tris;
}

function placedTriangles(recs, matOf) {
  const local = { a: decoTriangles('a'), b: decoTriangles('b'), c: decoTriangles('c') };
  const out = [];
  for (const r of recs) {
    const M = matOf(r);
    const flip = C.det3(M) < 0;
    for (const tri of local[r.type]) {
      const p = tri.map((v) => C.applyPt(M, v));
      out.push(flip ? [p[0], p[2], p[1]] : p);
    }
  }
  return out;
}

const fmt = (v) => {
  if (Math.abs(v) < 5e-7) return '0';
  return v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
};
const mmaList = (tris) => '{' + tris.map((t) => '{' + t.map((p) => '{' + p.map(fmt).join(',') + '}').join(',') + '}').join(',\n  ') + '}';

function exportMathematica() {
  const tile = placedTriangles(C.CHAIR.map(([type, M]) => ({ type, M })), (r) => r.M);
  const txt = `(* L-tile decorations, ${state.a.tri.length / 3} / ${state.c.tri.length / 3} triangles (a / c), exported ${new Date().toISOString()} *)
(* Each decoration: list of triangles {p1,p2,p3} in its own frame, counter-clockwise seen from outside. *)
(* a is bounded by {{-1,0,0},{0,0,0},{0,1,0},{-1,1,0}}, c by {{0,0,0},{1,0,0},{1,1,0},{0,1,0}}. *)
(* b = S[a] turned inside out; S = {{0,1,0,0},{1,0,0,0},{0,0,-1,0},{0,0,0,1}}; S[c] = c turned inside out. *)
(* NB: these fit Chair44decorationtransforms only after relabelling its entries a->c, b->a, c->b. *)
(* chairTile is the assembled decorated tile using that relabelling. *)

adecoration = ${mmaList(decoTriangles('a'))};

bdecoration = ${mmaList(decoTriangles('b'))};

cdecoration = ${mmaList(decoTriangles('c'))};

chairTile = ${mmaList(tile)};
`;
  download('ltile-decorations.m', txt, 'text/plain');
}

function stl(tris) {
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const [a, b, c] of tris) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n) || 1;
    for (const x of [...n.map((q) => q / l), ...a, ...b, ...c]) { dv.setFloat32(o, x, true); o += 4; }
    o += 2;
  }
  return buf;
}

function exportStl(which) {
  const recs = which === 'tile' ? C.CHAIR.map(([type, M]) => ({ type, M })) : shownRecs;
  const matOf = which === 'tile' ? (r) => r.M : (r) => displayMatrix(r);
  const count = triCount(recs);
  if (count > 2e6 && !confirm(`That is ${(count / 1e6).toFixed(1)} million triangles (${Math.round(count * 50 / 1e6)} MB). Continue?`)) return;
  download(which === 'tile' ? 'ltile.stl' : `ltile-${ui.view}.stl`, stl(placedTriangles(recs, matOf)), 'model/stl');
}

// ------------------------------------------------------------------ UI wiring

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

const triCount = (recs) => recs.reduce((n, r) => n + (r.type === 'c' ? state.c.tri.length : state.a.tri.length) / 3, 0);

function updateStats() {
  if (!layout) return;
  const tiles = new Set(visibleRecs.map((r) => r.tile)).size;
  const tris = triCount(shownRecs);
}

function syncControls() {
  for (const b of $('viewSeg').children) b.classList.toggle('on', b.dataset.view === ui.view);
  for (const b of $('toolSeg').children) b.classList.toggle('on', b.dataset.tool === ui.tool);
  $('levelRow').style.display = ui.view === 'tiling' ? '' : 'none';
  $('peelRow').style.display = ui.view === 'tiling' ? '' : 'none';
  for (const k of ['level', 'peel']) $(k).value = ui[k];
  $('levelVal').textContent = `${ui.level} (${8 ** ui.level} tiles)`;
  $('peelVal').textContent = Math.round(ui.peel * 100) + '%';
  $('flat').checked = ui.flat;
  $('wire').checked = ui.wire;
  $('res').value = String(state.n);
}

function setView(v) {
  const wasDeco = ui.view === 'deco';
  ui.view = v;
  rebuildMeshes();
  if (wasDeco !== (v === 'deco')) resetCamera();
  syncControls();
  saveUI();
}
function setTool(t) {
  ui.tool = t;
  updateWire();
  pointer.moved = true; syncControls(); saveUI(); }

$('viewSeg').addEventListener('click', (e) => { const v = e.target.dataset?.view; if (v) setView(v); });
$('toolSeg').addEventListener('click', (e) => { const t = e.target.dataset?.tool; if (t) setTool(t); });
$('level').addEventListener('input', (e) => { ui.level = +e.target.value; rebuildMeshes(); syncControls(); saveUI(); });
$('peel').addEventListener('input', (e) => { ui.peel = +e.target.value; refreshInstances(); syncControls(); saveUI(); });
$('flat').addEventListener('change', (e) => { ui.flat = e.target.checked; solidMat.flatShading = ui.flat; solidMat.needsUpdate = true; saveUI(); });
$('wire').addEventListener('change', (e) => { ui.wire = e.target.checked; refreshInstances(); saveUI(); });
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
$('res').addEventListener('change', (e) => {
  pushUndo();
  setState(C.resampleState(state, +e.target.value));
  toast(`Regular ${state.n} × ${state.n} grid`);
});
$('regrid').addEventListener('click', () => {
  pushUndo();
  setState(C.resampleState(state, state.n));
  toast(`Regular ${state.n} × ${state.n} grid`);
});
$('preset').addEventListener('change', (e) => {
  const name = e.target.value;
  e.target.value = '';
  if (!name) return;
  pushUndo();
  setState(C.presetState(name, state));
  toast(`Started from “${name}” (undo to go back)`);
});
$('saveJson').addEventListener('click', () => download('ltile-decorations.json', JSON.stringify(stateToJSON(state)), 'application/json'));
$('loadJson').addEventListener('click', () => $('fileIn').click());
$('fileIn').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let s = null;
  try { s = stateFromJSON(JSON.parse(await f.text())); } catch { /* reported below */ }
  if (!s) { toast('Not a decorations file'); return; }
  pushUndo();
  setState(s);
  toast(`Loaded ${f.name}`);
});
$('saveStl').addEventListener('click', () => exportStl('view'));
// menu open/closed state persists across sessions; first visit: only the first menu (Show) is open
const SECTIONS_KEY = 'newl.sections.v1';
const sectionState = store.get(SECTIONS_KEY) || {};
document.querySelectorAll('details.sec').forEach((d, i) => {
  const name = d.querySelector('summary').textContent;
  d.open = name in sectionState ? !!sectionState[name] : i === 0;
  d.addEventListener('toggle', () => { sectionState[name] = d.open; store.set(SECTIONS_KEY, sectionState); });
});

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const k = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.metaKey || e.ctrlKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) { if (e.key === 'Alt') orbitOverride = true; return; }
  pointer.shift = e.shiftKey;
  if (e.key === ' ') { orbitOverride = true; cursor.visible = false; e.preventDefault(); return; }
  const tools = { g: 'grab', f: 'flatten', v: 'vertex', e: 'flip', d: 'subdivide', x: 'delvert' };
  if (tools[k]) setTool(tools[k]);
  else if (k === '1') setView('deco');
  else if (k === '2') setView('tile');
  else if (k === '3') setView('tiling');
  else if (k === 'h') { ui.flat = !ui.flat; solidMat.flatShading = ui.flat; solidMat.needsUpdate = true; syncControls(); saveUI(); }
  else if (k === 'w') { ui.wire = !ui.wire; refreshInstances(); syncControls(); saveUI(); }
  else if (k === 'o') { ui.outlines = !ui.outlines; extras.visible = ui.outlines; syncControls(); saveUI(); }
  else if (k === 'home') resetCamera();
  else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  pointer.shift = e.shiftKey;
  if (e.key === ' ' || e.key === 'Alt') orbitOverride = false;
});
window.addEventListener('blur', () => { orbitOverride = false; endStroke(); });

// ------------------------------------------------------------------ go

buildGeometries();
rebuildMeshes();
resetCamera();
syncControls();
updateUndoButtons();
resize();

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.updateMatrixWorld();
  if (stroke && stroke.tool !== 'grab' && stroke.tool !== 'vertex' && !CLICK_TOOLS.includes(stroke.tool)) airbrush(dt);
  else if (pointer.moved) hoverCursor();
  pointer.moved = false;
  renderer.render(scene, camera);
});

// exposed for debugging from the console
window.ltile = { C, camera, pick, hoverCursor, pointer, ndc, edgeHi, quadHi, edgeLine, get state() { return state; }, ui, setView, rebuildMeshes };
