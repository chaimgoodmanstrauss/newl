// Pure geometry core for the decorated 3D chair ("l-tile") editor.
// No three.js dependency, so it can be unit-tested in Node.
// Matrices are 4x4 row-major nested arrays acting on column vectors {x,y,z,1},
// exactly as in the Mathematica source data.

// ---------------------------------------------------------------- source data

export const LSUB = [
  [[1, 0, 0, -1], [0, 1, 0, -1], [0, 0, 1, -1], [0, 0, 0, 1]],
  [[0, 1, 0, -1], [1, 0, 0, -1], [0, 0, -1, 1], [0, 0, 0, 1]],
  [[1, 0, 0, -1], [0, 0, -1, 1], [0, 1, 0, -1], [0, 0, 0, 1]],
  [[0, 0, 1, -1], [-1, 0, 0, 1], [0, -1, 0, 1], [0, 0, 0, 1]],
  [[0, 0, -1, 1], [0, 1, 0, -1], [1, 0, 0, -1], [0, 0, 0, 1]],
  [[0, -1, 0, 1], [0, 0, 1, -1], [-1, 0, 0, 1], [0, 0, 0, 1]],
  [[-1, 0, 0, 1], [0, -1, 0, 1], [0, 0, 1, -1], [0, 0, 0, 1]],
  [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
];

// [label as given, transform] — Chair44decorationtransforms, verbatim.
//
// NOTE: taken literally, these labels do not fit the stated boundaries
// (a on [-1,0]x[0,1], c on [0,1]^2, b = S(a)): squares land outside the tile
// or on top of each other.  They fit exactly under the relabelling
//   given 'a' -> c,  given 'b' -> a,  given 'c' -> b
// which covers all 24 unit squares of the l-tile once, maps local +z outward
// everywhere, and in the tiling makes every interior face an a|b pair or a
// c|c pair related by S (checked in test/core.test.mjs).
export const CHAIR_RELABEL = { a: 'c', b: 'a', c: 'b' };
export const CHAIR_GIVEN = [
  ['a', [[-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 1, 1], [0, 0, 0, 1]]],
  ['a', [[-1, 0, 0, 1], [0, -1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]]],
  ['a', [[0, -1, 0, 0], [-1, 0, 0, 0], [0, 0, -1, -1], [0, 0, 0, 1]]],
  ['a', [[0, -1, 0, 0], [0, 0, 1, 1], [-1, 0, 0, 0], [0, 0, 0, 1]]],
  ['a', [[0, 0, -1, -1], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]]],
  ['a', [[0, 0, 1, 1], [-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 0, 1]]],
  ['a', [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, -1, -1], [0, 0, 0, 1]]],
  ['a', [[1, 0, 0, 0], [0, 0, -1, -1], [0, 1, 0, 0], [0, 0, 0, 1]]],
  ['b', [[-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 1, 1], [0, 0, 0, 1]]],
  ['b', [[0, -1, 0, 0], [0, 0, 1, 1], [-1, 0, 0, 0], [0, 0, 0, 1]]],
  ['b', [[0, 0, -1, -1], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]]],
  ['b', [[0, 0, -1, -1], [1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 0, 1]]],
  ['b', [[0, 0, 1, 1], [-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 0, 1]]],
  ['b', [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, -1, -1], [0, 0, 0, 1]]],
  ['b', [[1, 0, 0, 0], [0, 0, -1, -1], [0, 1, 0, 0], [0, 0, 0, 1]]],
  ['b', [[1, 0, 0, 1], [0, 0, 1, 0], [0, -1, 0, 1], [0, 0, 0, 1]]],
  ['c', [[-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 1, 1], [0, 0, 0, 1]]],
  ['c', [[0, -1, 0, 0], [0, 0, 1, 1], [-1, 0, 0, 0], [0, 0, 0, 1]]],
  ['c', [[0, 0, -1, -1], [0, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 1]]],
  ['c', [[0, 0, 1, 0], [0, 1, 0, 1], [-1, 0, 0, 1], [0, 0, 0, 1]]],
  ['c', [[0, 0, 1, 1], [-1, 0, 0, 0], [0, -1, 0, 0], [0, 0, 0, 1]]],
  ['c', [[0, 1, 0, 0], [0, 0, -1, -1], [-1, 0, 0, 0], [0, 0, 0, 1]]],
  ['c', [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, -1, -1], [0, 0, 0, 1]]],
  ['c', [[1, 0, 0, 0], [0, 0, -1, -1], [0, 1, 0, 0], [0, 0, 0, 1]]],
];

export const CHAIR = CHAIR_GIVEN.map(([t, M]) => [CHAIR_RELABEL[t], M]);

// The a<->b / c<->c symmetry: (x,y,z) -> (y,x,-z). An involution with det +1.
export const S4 = [[0, 1, 0, 0], [1, 0, 0, 0], [0, 0, -1, 0], [0, 0, 0, 1]];

// Undecorated l-tile facets, as given (orientation not yet trusted).
export const LTILE_FACETS_RAW = [
  [[0, 0, 1], [1, 0, 1], [1, -1, 1], [-1, -1, 1], [-1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [1, 1, 0], [1, 1, -1], [1, -1, -1], [1, -1, 1], [1, 0, 1]],
  [[0, 1, 0], [0, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 0]],
  [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
  [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]],
  [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1]],
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
];

// Flat boundary squares (z = 0) of each decoration in its own frame.
export const DECO_SQUARE = {
  a: [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [-1, 1, 0]],
  c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
};
DECO_SQUARE.b = DECO_SQUARE.a.map((p) => applyPt(S4, p));

// ---------------------------------------------------------------- matrix math

export const I4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];

export function mul(A, B) {
  const C = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j];
      C[i][j] = s;
    }
  return C;
}

export function scaleMat(s) {
  return [[s, 0, 0, 0], [0, s, 0, 0], [0, 0, s, 0], [0, 0, 0, 1]];
}

export function translateMat(t) {
  return [[1, 0, 0, t[0]], [0, 1, 0, t[1]], [0, 0, 1, t[2]], [0, 0, 0, 1]];
}

export function applyPt(M, p) {
  return [
    M[0][0] * p[0] + M[0][1] * p[1] + M[0][2] * p[2] + M[0][3],
    M[1][0] * p[0] + M[1][1] * p[1] + M[1][2] * p[2] + M[1][3],
    M[2][0] * p[0] + M[2][1] * p[1] + M[2][2] * p[2] + M[2][3],
  ];
}

export function applyVec(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}

export function det3(M) {
  return (
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  );
}

// Inverse of an affine 4x4 (general 3x3 linear part).
export function invAffine(M) {
  const d = det3(M);
  const [a, b, c] = M[0], [e, f, g] = M[1], [h, i, j] = M[2];
  const L = [
    [(f * j - g * i) / d, (c * i - b * j) / d, (b * g - c * f) / d],
    [(g * h - e * j) / d, (a * j - c * h) / d, (c * e - a * g) / d],
    [(e * i - f * h) / d, (b * h - a * i) / d, (a * f - b * e) / d],
  ];
  const t = [M[0][3], M[1][3], M[2][3]];
  const ti = [0, 1, 2].map((r) => -(L[r][0] * t[0] + L[r][1] * t[1] + L[r][2] * t[2]));
  return [[...L[0], ti[0]], [...L[1], ti[1]], [...L[2], ti[2]], [0, 0, 0, 1]];
}

// ---------------------------------------------------------------- substitution

// substitute(foo)[i,j] = scale[2] . foo[i] . scale[1/2] . lsubmatrices[j]
export function substitute(foo) {
  const out = [];
  const s2 = scaleMat(2), sh = scaleMat(0.5);
  for (const f of foo) for (const L of LSUB) out.push(mul(mul(mul(s2, f), sh), L));
  return out;
}

export function placements(level) {
  let list = [I4];
  for (let k = 0; k < level; k++) list = substitute(list);
  return list;
}

// Unit cubes making up the l-tile: [-1,1]^3 minus the octant [0,1]^3.
export const LTILE_CUBES = [];
for (const x of [-1, 0]) for (const y of [-1, 0]) for (const z of [-1, 0])
  if (!(x === 0 && y === 0 && z === 0)) LTILE_CUBES.push([x, y, z]);

export const LTILE_CENTROID = LTILE_CUBES.reduce(
  (acc, c) => acc.map((v, i) => v + (c[i] + 0.5) / LTILE_CUBES.length), [0, 0, 0]);

// ---------------------------------------------------------------- facet orientation

const key3 = (p) => p.map((v) => Math.round(v * 1e6) / 1e6).join(',');

export function newellNormal(poly) {
  const n = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]);
    n[1] += (p[2] - q[2]) * (p[0] + q[0]);
    n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return n;
}

function signedVolume(facets) {
  let v = 0;
  for (const f of facets)
    for (let i = 1; i + 1 < f.length; i++) {
      const [a, b, c] = [f[0], f[i], f[i + 1]];
      v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
  return v;
}

// Make a closed polygonal surface consistently oriented with outward normals:
// propagate across shared edges (a shared edge must be traversed in opposite
// directions), then fix the global sign by making the enclosed volume positive.
export function orientFacets(facetsIn) {
  const facets = facetsIn.map((f) => f.map((p) => [...p]));
  const edgeOwners = new Map();
  facets.forEach((f, fi) => f.forEach((p, i) => {
    const q = f[(i + 1) % f.length];
    const k = [key3(p), key3(q)].sort().join('|');
    if (!edgeOwners.has(k)) edgeOwners.set(k, []);
    edgeOwners.get(k).push(fi);
  }));
  const directed = (f) => new Set(f.map((p, i) => key3(p) + '>' + key3(f[(i + 1) % f.length])));
  const done = new Array(facets.length).fill(false);
  const queue = [0];
  done[0] = true;
  while (queue.length) {
    const fi = queue.shift();
    const f = facets[fi];
    f.forEach((p, i) => {
      const q = f[(i + 1) % f.length];
      const k = [key3(p), key3(q)].sort().join('|');
      for (const gi of edgeOwners.get(k)) {
        if (done[gi]) continue;
        // neighbour must contain q>p, not p>q
        if (directed(facets[gi]).has(key3(p) + '>' + key3(q))) facets[gi].reverse();
        done[gi] = true;
        queue.push(gi);
      }
    });
  }
  if (signedVolume(facets) < 0) facets.forEach((f) => f.reverse());
  return facets;
}

export const LTILE_FACETS = orientFacets(LTILE_FACETS_RAW);

// ---------------------------------------------------------------- decoration meshes
//
// A decoration is a triangle mesh over its flat unit square ("rest" positions, z = 0):
//   mesh = { type, pos, rest, tri, pin, taper, partner, cache }
// tri is CCW seen from +z, and +z is the decoration's outward side. Only `pos` is ever edited in
// place; rest/tri/pin/taper/partner/cache are immutable and shared between clones, and any
// topology change (flip, refine) makes a new mesh object.
//   a: b is derived as S(a) turned inside out.
//   c: S(c) = c turned inside out, i.e. pos(partner(v)) = S pos(v). `partner` is found by mirroring
//      the rest positions, so c's rest/topology must be swap-symmetric, with no triangle straddling
//      the diagonal x = y (it stays a union of edges; diagonal edges are never flipped).
// Boundary vertices (pin) are pinned and boundary edges are never split or flipped, so the square
// edges stay exactly the base grid and neighbouring decorations always meet.

export const EDGE_TAPER = 0.15;
const key2 = (x, y) => Math.round(x * 1e6) + ',' + Math.round(y * 1e6);

export function restPoint(type, u, v) {
  return type === 'a' ? [-1 + u, v, 0] : [u, v, 0];
}

export function makeMesh(type, rest, tri, pos = rest.slice()) {
  const V = rest.length / 3, x0 = type === 'a' ? -1 : 0;
  const pin = new Uint8Array(V), taper = new Float32Array(V);
  for (let v = 0; v < V; v++) {
    const u = rest[3 * v] - x0, w = rest[3 * v + 1];
    const d = Math.min(u, 1 - u, w, 1 - w);
    pin[v] = d < 1e-9 ? 1 : 0;
    const t = Math.min(1, Math.max(0, d) / EDGE_TAPER);
    taper[v] = t * t * (3 - 2 * t);
  }
  let partner = null;
  if (type === 'c') {
    const at = new Map();
    for (let v = 0; v < V; v++) at.set(key2(rest[3 * v], rest[3 * v + 1]), v);
    partner = new Int32Array(V);
    for (let v = 0; v < V; v++) {
      const p = at.get(key2(rest[3 * v + 1], rest[3 * v]));
      if (p === undefined) throw new Error('c mesh is not swap-symmetric');
      partner[v] = p;
    }
  }
  return { type, pos, rest, tri, pin, taper, partner, cache: {} };
}

export function gridIndices(n) {
  const idx = [];
  const at = (i, j) => j * (n + 1) + i;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      // split each quad along (i,j)-(i+1,j+1): that diagonal is swap-invariant
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1));
      idx.push(at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
  return Uint32Array.from(idx);
}

export function gridMesh(type, n) {
  const rest = new Float32Array((n + 1) * (n + 1) * 3);
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) rest.set(restPoint(type, i / n, j / n), (j * (n + 1) + i) * 3);
  return makeMesh(type, rest, gridIndices(n));
}

export function reversedIndices(idx) {
  const out = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t += 3) {
    out[t] = idx[t]; out[t + 1] = idx[t + 2]; out[t + 2] = idx[t + 1];
  }
  return out;
}

export const cloneMesh = (m) => ({ ...m, pos: m.pos.slice() });

export function applyS(pos, out = new Float32Array(pos.length)) {
  for (let k = 0; k < pos.length; k += 3) {
    const x = pos[k], y = pos[k + 1], z = pos[k + 2];
    out[k] = y; out[k + 1] = x; out[k + 2] = -z;
  }
  return out;
}

// Enforce pos(partner(v)) = S pos(v) by averaging each vertex with the S-image of its partner.
export function symmetrizeC(m) {
  const P = m.pos, part = m.partner;
  for (let v = 0; v < part.length; v++) {
    const p = part[v];
    if (p < v) continue;
    const a = v * 3, b = p * 3;
    const x = (P[a] + P[b + 1]) / 2, y = (P[a + 1] + P[b]) / 2, z = (P[a + 2] - P[b + 2]) / 2;
    P[a] = x; P[a + 1] = y; P[a + 2] = z;
    P[b] = y; P[b + 1] = x; P[b + 2] = -z;
  }
  return m;
}

export function vertexNormals(pos, idx, out = new Float32Array(pos.length)) {
  out.fill(0);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { out[v] += nx; out[v + 1] += ny; out[v + 2] += nz; }
  }
  for (let k = 0; k < out.length; k += 3) {
    const l = Math.hypot(out[k], out[k + 1], out[k + 2]) || 1;
    out[k] /= l; out[k + 1] /= l; out[k + 2] /= l;
  }
  return out;
}

// ---- topology queries (cached on the shared mesh.cache)

const ekey = (u, v, V) => (u < v ? u * V + v : v * V + u);

// edge key -> [u, v, triangle indices]
export function edgeMap(m) {
  if (m.cache.edges) return m.cache.edges;
  const V = m.rest.length / 3, edges = new Map();
  for (let t = 0; t < m.tri.length / 3; t++)
    for (let e = 0; e < 3; e++) {
      const u = m.tri[3 * t + e], v = m.tri[3 * t + (e + 1) % 3], k = ekey(u, v, V);
      if (!edges.has(k)) edges.set(k, [Math.min(u, v), Math.max(u, v), []]);
      edges.get(k)[2].push(t);
    }
  return (m.cache.edges = edges);
}

export function neighbors(m) {
  if (m.cache.nbrs) return m.cache.nbrs;
  const sets = Array.from({ length: m.rest.length / 3 }, () => new Set());
  for (const [u, v] of edgeMap(m).values()) { sets[u].add(v); sets[v].add(u); }
  return (m.cache.nbrs = sets.map((x) => Uint32Array.from(x)));
}

export function meanEdge(m) {
  if (m.cache.meanEdge) return m.cache.meanEdge;
  let sum = 0;
  const R = m.rest;
  for (const [u, v] of edgeMap(m).values()) sum += Math.hypot(R[3 * u] - R[3 * v], R[3 * u + 1] - R[3 * v + 1]);
  return (m.cache.meanEdge = sum / edgeMap(m).size);
}

// ---- edge flip: swap the diagonal of the quadrilateral formed by the two triangles on an edge

const area2 = (R, a, b, c) =>
  (R[3 * b] - R[3 * a]) * (R[3 * c + 1] - R[3 * a + 1]) - (R[3 * b + 1] - R[3 * a + 1]) * (R[3 * c] - R[3 * a]);

// Topological flip: triangles (u,v,w) and (v,u,x) become (u,x,w) and (x,v,w). Returns the new
// triangle array, or a string saying why not. The only refusals are a boundary edge (one triangle) and
// a new edge w-x that already exists (the flip would make a duplicate edge). Convexity is NOT required:
// the surface lives in 3D, so a quad that is non-convex in the flat rest square can still be flipped.
function flipOnce(tri, u, v) {
  let t1 = -1, t2 = -1, w = -1, x = -1;
  for (let t = 0; t < tri.length / 3; t++)
    for (let e = 0; e < 3; e++) {
      const p = tri[3 * t + e], q = tri[3 * t + (e + 1) % 3], o = tri[3 * t + (e + 2) % 3];
      if (p === u && q === v) { t1 = t; w = o; } else if (p === v && q === u) { t2 = t; x = o; }
    }
  if (t1 < 0 || t2 < 0) return 'That is a boundary edge (only one triangle), so it can’t be flipped';
  for (let t = 0; t < tri.length / 3; t++) {
    const a = tri[3 * t], b = tri[3 * t + 1], c = tri[3 * t + 2];
    if ((a === w || b === w || c === w) && (a === x || b === x || c === x))
      return 'The flipped edge would duplicate an edge that already exists';
  }
  const out = tri.slice();
  out.set([u, x, w], 3 * t1);
  out.set([x, v, w], 3 * t2);
  return out;
}

// Returns a new mesh with the edge u-v flipped (c: and its mirror edge too), or a string with the reason.
export function flipEdge(m, u, v) {
  let tri = flipOnce(m.tri, u, v);
  if (typeof tri === 'string') return tri;
  if (m.partner) {
    const pu = m.partner[u], pv = m.partner[v];
    if (!((pu === u && pv === v) || (pu === v && pv === u))) {
      tri = flipOnce(tri, pu, pv);
      if (typeof tri === 'string') return 'The mirror edge on c can’t be flipped together with this one (' + tri.toLowerCase().replace(/^that is/, 'it is') + ')';
    }
  }
  return { ...m, tri, cache: {} };
}

// ---- selective refinement: split marked edges at their midpoints, every triangle by template
// (0 marked: keep; 1: bisect; 2: three triangles; 3: four triangles). Always conforming, and purely
// combinatorial, so a symmetric set of marked edges gives a symmetric mesh.

const canon = (R, v) => [Math.min(R[3 * v], R[3 * v + 1]), Math.max(R[3 * v], R[3 * v + 1])];
const lexLess = (p, q) => p[0] < q[0] - 1e-9 || (Math.abs(p[0] - q[0]) <= 1e-9 && p[1] < q[1] - 1e-9);

// edges: iterable of [u, v]. Boundary edges are ignored. Returns a new mesh, or null if nothing to do.
export function refineEdges(m, edges) {
  const V = m.rest.length / 3, em = edgeMap(m), marked = new Map();
  const mark = (u, v) => {
    const k = ekey(u, v, V), e = em.get(k);
    if (e && e[2].length === 2) marked.set(k, -1);
  };
  for (const [u, v] of edges) {
    mark(u, v);
    if (m.partner) mark(m.partner[u], m.partner[v]);
  }
  if (!marked.size) return null;
  if (m.partner) {
    // A triangle that is its own mirror image (it straddles c's diagonal after a diagonal flip) can't
    // be split 1-to-3 symmetrically, so a self-mirror triangle with two marked edges gets its third.
    const P = m.partner;
    for (let changed = true; changed;) {
      changed = false;
      for (let t = 0; t < m.tri.length; t += 3) {
        const a = m.tri[t], b = m.tri[t + 1], c = m.tri[t + 2];
        const set = new Set([a, b, c]);
        if (!(set.has(P[a]) && set.has(P[b]) && set.has(P[c]))) continue;
        const es = [[a, b], [b, c], [c, a]], un = es.filter(([p, q]) => !marked.has(ekey(p, q, V)));
        if (un.length === 1) { const k = ekey(un[0][0], un[0][1], V), e = em.get(k); if (e && e[2].length === 2) { marked.set(k, -1); changed = true; } }
      }
    }
  }
  const keys = [...marked.keys()].sort((a, b) => a - b);
  const V2 = V + keys.length;
  const rest = new Float32Array(V2 * 3), pos = new Float32Array(V2 * 3);
  rest.set(m.rest); pos.set(m.pos);
  keys.forEach((k, i) => {
    const [u, v] = em.get(k), mid = V + i;
    marked.set(k, mid);
    for (let d = 0; d < 3; d++) {
      rest[3 * mid + d] = (m.rest[3 * u + d] + m.rest[3 * v + d]) / 2;
      pos[3 * mid + d] = (m.pos[3 * u + d] + m.pos[3 * v + d]) / 2;
    }
  });
  const M = (a, b) => marked.get(ekey(a, b, V)) ?? -1;
  const dist = (a, b) => Math.hypot(rest[3 * a] - rest[3 * b], rest[3 * a + 1] - rest[3 * b + 1]);
  const out = [];
  for (let t = 0; t < m.tri.length; t += 3) {
    let A = m.tri[t], B = m.tri[t + 1], C = m.tri[t + 2];
    let mAB = M(A, B), mBC = M(B, C), mCA = M(C, A);
    const cnt = (mAB >= 0) + (mBC >= 0) + (mCA >= 0);
    const rot = () => { [A, B, C] = [B, C, A]; [mAB, mBC, mCA] = [mBC, mCA, mAB]; };
    if (cnt === 0) out.push(A, B, C);
    else if (cnt === 3) out.push(A, mAB, mCA, mAB, B, mBC, mCA, mBC, C, mAB, mBC, mCA);
    else if (cnt === 1) {
      while (mAB < 0) rot();
      out.push(A, mAB, C, mAB, B, C);
    } else {
      while (mBC >= 0) rot(); // marked: AB and CA, sharing A
      out.push(A, mAB, mCA);
      const d1 = dist(mAB, C), d2 = dist(mCA, B);
      const first = Math.abs(d1 - d2) > 1e-9 ? d1 < d2 : !lexLess(canon(rest, C), canon(rest, B));
      if (first) out.push(mAB, B, C, mAB, C, mCA);
      else out.push(mAB, B, mCA, B, C, mCA);
    }
  }
  try { return makeMesh(m.type, rest, Uint32Array.from(out), pos); } catch { return null; }
}

// ---- delete vertex: remove an interior vertex and re-triangulate the hole left by its star
// (the inverse of subdividing). Ear clipping in the flat rest square, preferring well-shaped ears and
// never creating an edge that already exists. On c the mirror vertex is deleted with it, using the
// mirrored triangulation; c's diagonal vertices (their own mirror) can't be deleted.

const minAngle = (R, a, b, c) => {
  const ang = (p, q, r) => {
    const ux = R[3 * q] - R[3 * p], uy = R[3 * q + 1] - R[3 * p + 1], vx = R[3 * r] - R[3 * p], vy = R[3 * r + 1] - R[3 * p + 1];
    return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1))));
  };
  return Math.min(ang(a, b, c), ang(b, c, a), ang(c, a, b));
};

// cyc: CCW polygon (vertex ids). hasEdge(a, b): true if a-b is already an edge. Returns triangles or null.
function triangulateHole(R, cyc, hasEdge) {
  const poly = cyc.slice(), out = [], chords = new Set();
  const ck = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  const inside = (p, a, b, c) => area2(R, a, b, p) > -1e-9 && area2(R, b, c, p) > -1e-9 && area2(R, c, a, p) > -1e-9;
  while (poly.length > 3) {
    let best = -1, bs = -Infinity;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
      if (area2(R, a, b, c) < 1e-9 || hasEdge(a, c) || chords.has(ck(a, c))) continue;
      if (poly.some((w) => w !== a && w !== b && w !== c && inside(w, a, b, c))) continue;
      const sc = minAngle(R, a, b, c);
      if (sc > bs) { bs = sc; best = i; }
    }
    if (best < 0) return null;
    const a = poly[(best + n - 1) % n], b = poly[best], c = poly[(best + 1) % n];
    out.push([a, b, c]);
    chords.add(ck(a, c));
    poly.splice(best, 1);
  }
  if (area2(R, poly[0], poly[1], poly[2]) < 1e-9) return null;
  out.push(poly);
  return out;
}

// Returns a new mesh, or a string saying why not.
export function deleteVertex(m, v) {
  const P = m.partner, V = m.rest.length / 3;
  if (m.pin[v]) return 'Boundary vertices are pinned and can’t be deleted';
  if (P && P[v] === v) return 'Vertices on c’s diagonal can’t be deleted (they are their own mirror)';
  const em = edgeMap(m);
  const star = (x) => { const r = []; for (let t = 0; t < m.tri.length / 3; t++) if (m.tri.subarray(3 * t, 3 * t + 3).includes(x)) r.push(t); return r; };
  const sv = star(v);
  if (sv.length < 3) return 'That vertex has too few triangles around it';
  // ordered link: triangle (v,a,b) gives a -> b
  const next = new Map();
  for (const t of sv) {
    let k = 0;
    while (m.tri[3 * t + k] !== v) k++;
    next.set(m.tri[3 * t + (k + 1) % 3], m.tri[3 * t + (k + 2) % 3]);
  }
  const first = next.keys().next().value, cyc = [first];
  for (let q = next.get(first); q !== first; q = next.get(q)) {
    if (q === undefined || cyc.length > sv.length) return 'The triangles around that vertex don’t form a closed fan';
    cyc.push(q);
  }
  if (cyc.length !== sv.length) return 'The triangles around that vertex don’t form a closed fan';
  let removed = [v], remove = sv.slice(), tris = null, mirror = [];
  if (P) {
    const pv = P[v];
    if (em.has(v < pv ? v * V + pv : pv * V + v)) return 'The vertex is adjacent to its mirror vertex on c, so they can’t both be deleted';
    const sp = star(pv);
    if (sv.some((t) => sp.includes(t))) return 'The vertex shares a triangle with its mirror vertex on c';
    removed.push(pv); remove = remove.concat(sp);
  }
  // on c, a chord that is its own mirror image (both ends on the diagonal, or mirror partners) would be made twice
  const selfMirror = (a, b) => P && ((P[a] === a && P[b] === b) || P[a] === b);
  tris = triangulateHole(m.rest, cyc, (a, b) => em.has(a < b ? a * V + b : b * V + a) || selfMirror(a, b));
  if (!tris) return 'Couldn’t re-triangulate the hole (a new edge would duplicate an existing one, or the fan is folded)';
  if (P) {
    mirror = tris.map(([a, b, c]) => [P[a], P[c], P[b]]);
    const count = new Map();
    for (const [a, b, c] of tris.concat(mirror))
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const k = p < q ? p * V + q : q * V + p;
        if (!em.has(k)) count.set(k, (count.get(k) || 0) + 1);
      }
    if ([...count.values()].some((n) => n > 2)) return 'The vertex and its mirror would create the same new edge';
  }
  const drop = new Set(remove), gone = new Set(removed);
  const keep = [];
  for (let t = 0; t < m.tri.length / 3; t++) if (!drop.has(t)) keep.push(m.tri[3 * t], m.tri[3 * t + 1], m.tri[3 * t + 2]);
  for (const t of tris.concat(mirror)) keep.push(...t);
  const remap = new Int32Array(V).fill(-1);
  let V2 = 0;
  for (let i = 0; i < V; i++) if (!gone.has(i)) remap[i] = V2++;
  const rest = new Float32Array(V2 * 3), pos = new Float32Array(V2 * 3);
  for (let i = 0; i < V; i++) if (remap[i] >= 0) { rest.set(m.rest.subarray(3 * i, 3 * i + 3), 3 * remap[i]); pos.set(m.pos.subarray(3 * i, 3 * i + 3), 3 * remap[i]); }
  try { return makeMesh(m.type, rest, Uint32Array.from(keep, (i) => remap[i]), pos); } catch { return 'Deleting that vertex would break c’s symmetry'; }
}

// Triangles whose centroid lies within r of the stamp centre (plus `always`, a triangle index or -1).
export function trianglesNear(m, center, r, always = -1) {
  const P = m.pos, out = [];
  for (let t = 0; t < m.tri.length / 3; t++) {
    const a = m.tri[3 * t] * 3, b = m.tri[3 * t + 1] * 3, c = m.tri[3 * t + 2] * 3;
    const d = Math.hypot((P[a] + P[b] + P[c]) / 3 - center[0], (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - center[1],
      (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - center[2]);
    if (d < r || t === always) out.push(t);
  }
  return out;
}

export function refineTriangles(m, tris) {
  const edges = [];
  for (const t of tris) for (let e = 0; e < 3; e++) edges.push([m.tri[3 * t + e], m.tri[3 * t + (e + 1) % 3]]);
  return refineEdges(m, edges);
}

// ---------------------------------------------------------------- editable state

export function makeState(n = 16) {
  return { n, a: gridMesh('a', n), c: gridMesh('c', n) };
}

export function cloneState(s) {
  return { n: s.n, a: cloneMesh(s.a), c: cloneMesh(s.c) };
}

// true when both states share topology (so GPU buffers can be reused)
export const sameTopology = (s, t) => s.a.tri === t.a.tri && s.c.tri === t.c.tri && s.a.rest === t.a.rest && s.c.rest === t.c.rest;

// Point location in rest space, then barycentric interpolation of the displacement field
// onto a new regular grid of resolution n2.
export function resampleState(s, n2) {
  const out = makeState(n2);
  for (const type of ['a', 'c']) {
    const om = s[type], nm = out[type], R = om.rest, P = om.pos;
    for (let v = 0; v < nm.pin.length; v++) {
      if (nm.pin[v]) continue;
      const x = nm.rest[3 * v], y = nm.rest[3 * v + 1];
      let best = -1, bestMin = -Infinity, bw = null;
      for (let t = 0; t < om.tri.length; t += 3) {
        const i = om.tri[t], j = om.tri[t + 1], k = om.tri[t + 2];
        const det = (R[3 * j + 1] - R[3 * k + 1]) * (R[3 * i] - R[3 * k]) + (R[3 * k] - R[3 * j]) * (R[3 * i + 1] - R[3 * k + 1]);
        const l1 = ((R[3 * j + 1] - R[3 * k + 1]) * (x - R[3 * k]) + (R[3 * k] - R[3 * j]) * (y - R[3 * k + 1])) / det;
        const l2 = ((R[3 * k + 1] - R[3 * i + 1]) * (x - R[3 * k]) + (R[3 * i] - R[3 * k]) * (y - R[3 * k + 1])) / det;
        const mn = Math.min(l1, l2, 1 - l1 - l2);
        if (mn > bestMin) { bestMin = mn; best = t; bw = [l1, l2, 1 - l1 - l2]; if (mn >= -1e-9) break; }
      }
      const ids = [om.tri[best], om.tri[best + 1], om.tri[best + 2]];
      for (let d = 0; d < 3; d++)
        for (let q = 0; q < 3; q++) nm.pos[3 * v + d] += bw[q] * (P[3 * ids[q] + d] - R[3 * ids[q] + d]);
    }
  }
  symmetrizeC(out.c);
  return out;
}

// Structural check used by tests and file loading: c's triangle set must be swap-symmetric.
export function cIsSymmetric(c) {
  const seen = new Set();
  const tk = (a, b, d) => [a, b, d].sort((x, y) => x - y).join(',');
  for (let t = 0; t < c.tri.length; t += 3) seen.add(tk(c.tri[t], c.tri[t + 1], c.tri[t + 2]));
  for (let t = 0; t < c.tri.length; t += 3)
    if (!seen.has(tk(c.partner[c.tri[t]], c.partner[c.tri[t + 1]], c.partner[c.tri[t + 2]]))) return false;
  return true;
}

// ---------------------------------------------------------------- brushes
//
// A stamp is the brush centre expressed in a stored decoration's frame:
//   { store: 'a'|'c', center: [x,y,z], vec: 3x3 (world vector -> store vector), nsign: ±1 }
// nsign is the sign that turns the stored mesh's outward normal into the outward
// normal of the instance the user is touching (b instances and the mirrored half
// of c are inside-out, so nsign = -1 there).

export const falloff = (t) => (t >= 1 ? 0 : (1 - t * t) * (1 - t * t));

// Brush weight fades to zero approaching the pinned square edge (mesh.taper), so edits
// blend into the seam instead of creasing against it.
function forStamp(state, st, r, fn) {
  const mesh = state[st.store], pos = mesh.pos;
  const [cx, cy, cz] = st.center;
  for (let k = 0, v = 0; k < pos.length; k += 3, v++) {
    if (mesh.pin[v]) continue;
    const d = Math.hypot(pos[k] - cx, pos[k + 1] - cy, pos[k + 2] - cz);
    if (d < r) fn(pos, k, falloff(d / r) * mesh.taper[v], v);
  }
}

// Per-frame "airbrush" style brushes. amount is already scaled by dt.
export function applyBrush(state, stamps, tool, r, amount) {
  const touched = new Set();
  const normals = {}, snap = {};
  for (const store of new Set(stamps.map((s) => s.store))) {
    normals[store] = vertexNormals(state[store].pos, state[store].tri);
    snap[store] = state[store].pos.slice();
    touched.add(store);
  }
  for (const st of stamps) {
    const mesh = state[st.store];
    if (tool === 'pull') {
      const N = normals[st.store];
      forStamp(state, st, r, (pos, k, w) => {
        const s = st.nsign * amount * w * r;
        pos[k] += s * N[k]; pos[k + 1] += s * N[k + 1]; pos[k + 2] += s * N[k + 2];
      });
    } else if (tool === 'smooth') {
      const src = snap[st.store], nbrs = neighbors(mesh);
      forStamp(state, st, r, (pos, k, w, v) => {
        const nb = nbrs[v];
        let ax = 0, ay = 0, az = 0;
        for (const q of nb) { ax += src[q * 3]; ay += src[q * 3 + 1]; az += src[q * 3 + 2]; }
        const t = Math.min(1, amount * 4 * w);
        pos[k] += t * (ax / nb.length - src[k]);
        pos[k + 1] += t * (ay / nb.length - src[k + 1]);
        pos[k + 2] += t * (az / nb.length - src[k + 2]);
      });
    } else if (tool === 'flatten') {
      const rest = mesh.rest;
      forStamp(state, st, r, (pos, k, w) => {
        const t = Math.min(1, amount * 3 * w);
        pos[k] += t * (rest[k] - pos[k]);
        pos[k + 1] += t * (rest[k + 1] - pos[k + 1]);
        pos[k + 2] += t * (rest[k + 2] - pos[k + 2]);
      });
    }
  }
  if (touched.has('c')) symmetrizeC(state.c);
  return touched;
}

// Grab: weights are frozen at stroke start; each move sets P = P0 + sum_s w_s * vec_s(delta).
export function grabBegin(state, stamps, r) {
  const g = { start: cloneState(state), terms: [] };
  for (const st of stamps) {
    const ws = [];
    forStamp(state, st, r, (pos, k, w) => ws.push(k, w));
    if (ws.length) g.terms.push({ st, ws });
  }
  return g;
}

export function grabMove(state, g, deltaWorld) {
  const touched = new Set();
  for (const store of new Set(g.terms.map((t) => t.st.store))) {
    state[store].pos.set(g.start[store].pos);
    touched.add(store);
  }
  for (const { st, ws } of g.terms) {
    const d = st.vec.map((row) => row[0] * deltaWorld[0] + row[1] * deltaWorld[1] + row[2] * deltaWorld[2]);
    const pos = state[st.store].pos;
    for (let t = 0; t < ws.length; t += 2) {
      const k = ws[t], w = ws[t + 1];
      pos[k] += w * d[0]; pos[k + 1] += w * d[1]; pos[k + 2] += w * d[2];
    }
  }
  if (touched.has('c')) symmetrizeC(state.c);
  return touched;
}

// Single-vertex drag: the interior vertex of the stamp's store nearest its centre,
// moved rigidly (weight 1). For c, the mirrored stamp moves the partner vertex too.
export function nearestInterior(state, st) {
  const mesh = state[st.store], pos = mesh.pos, [cx, cy, cz] = st.center;
  let best = -1, bd = Infinity;
  for (let k = 0, v = 0; k < pos.length; k += 3, v++) {
    if (mesh.pin[v]) continue;
    const d = Math.hypot(pos[k] - cx, pos[k + 1] - cy, pos[k + 2] - cz);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

export function vertexGrabBegin(state, stamps) {
  const g = { start: cloneState(state), terms: [] };
  for (const st of stamps) {
    const v = nearestInterior(state, st);
    if (v >= 0) g.terms.push({ st, ws: [v * 3, 1] });
  }
  return g;
}

// Given a stamp on the c store, its S-mirrored twin (keeps edits symmetric).
export function mirrorStamp(st) {
  const S3 = [[0, 1, 0], [1, 0, 0], [0, 0, -1]];
  const vec = S3.map((row) => [0, 1, 2].map((j) => row[0] * st.vec[0][j] + row[1] * st.vec[1][j] + row[2] * st.vec[2][j]));
  return { store: st.store, center: applyPt(S4, st.center), vec, nsign: -st.nsign };
}

// ---------------------------------------------------------------- presets

// Displaces the flat version of `base` (a grid resolution, or a state whose topology is kept).
export function presetState(name, base) {
  const s = typeof base === 'number' ? makeState(base) : cloneState(base);
  for (const t of ['a', 'c']) s[t].pos.set(s[t].rest);
  const bump = (mesh, fn) => {
    const x0 = mesh.type === 'a' ? -1 : 0;
    for (let v = 0; v < mesh.pin.length; v++) {
      if (mesh.pin[v]) continue;
      const [dx, dy, dz] = fn(mesh.rest[3 * v] - x0, mesh.rest[3 * v + 1]);
      mesh.pos[3 * v] += dx; mesh.pos[3 * v + 1] += dy; mesh.pos[3 * v + 2] += dz;
    }
  };
  const window = (u, v) => Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
  if (name === 'bumps') {
    bump(s.a, (u, v) => [0, 0, 0.35 * Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) / 0.03) * window(u, v)]);
    bump(s.c, (u, v) => [0, 0, 0.3 * (Math.exp(-((u - 0.7) ** 2 + (v - 0.3) ** 2) / 0.02) - Math.exp(-((u - 0.3) ** 2 + (v - 0.7) ** 2) / 0.02))]);
  } else if (name === 'waves') {
    bump(s.a, (u, v) => [0, 0, 0.12 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * v)]);
    bump(s.c, (u, v) => [0, 0, 0.15 * (u - v) * window(u, v) * 2]);
  } else if (name === 'knob') {
    bump(s.a, (u, v) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const h = d < 0.3 ? 0.45 * Math.cos((d / 0.3) * Math.PI / 2) ** 2 : 0;
      const flare = d < 0.3 ? 0.25 * Math.sin((d / 0.3) * Math.PI) * h : 0;
      return [(u - 0.5) * flare, (v - 0.5) * flare, h];
    });
    bump(s.c, (u, v) => [0, 0, 0.18 * Math.sin(Math.PI * (u - v)) * window(u, v)]);
  }
  symmetrizeC(s.c);
  return s;
}
