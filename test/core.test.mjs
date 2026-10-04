// Consistency checks on the source data and the core geometry.  Run: node test/core.test.mjs
import * as C from '../js/core.js';

let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const eqM = (A, B) => A.every((r, i) => r.every((v, j) => near(v, B[i][j])));

const insideLtile = (p) => p.every((v) => v > -1 && v < 1) && !p.every((v) => v > 0);
const add = (p, v, s = 1) => p.map((x, i) => x + s * v[i]);
const centroid = (poly) => poly.reduce((a, p) => add(a, p, 1 / poly.length), [0, 0, 0]);

console.log('l-tile facets');
const flipped = C.LTILE_FACETS.map((f, i) => {
  const n = C.newellNormal(f), m = C.newellNormal(C.LTILE_FACETS_RAW[i]);
  return n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0 ? i : -1;
}).filter((i) => i >= 0);
console.log('       given facets whose orientation had to be reversed:', JSON.stringify(flipped));
for (const f of C.LTILE_FACETS) {
  const n = C.newellNormal(f), l = Math.hypot(...n);
  const c = centroid(f);
  // centroid of an L-shaped hexagon may lie outside it; probe at a vertex-adjacent interior point instead
  const probe = add(add(f[0], add(f[1], f[0], -1), 0.01), add(f[f.length - 1], f[0], -1), 0.01);
  check(!insideLtile(add(probe, n, 0.01 / l)) && insideLtile(add(probe, n, -0.01 / l)), `facet outward ${JSON.stringify(f[0])}.. n=${n.map((v) => v / l)}`);
}

console.log('substitution: 8 copies of scale[1/2].lsub[j] tile the l-tile');
const cells = new Map();
for (const L of C.LSUB) {
  const M = C.mul(C.scaleMat(0.5), L);
  for (const cube of C.LTILE_CUBES) {
    const ctr = C.applyPt(M, cube.map((v) => v + 0.5));
    const k = ctr.map((v) => v.toFixed(3)).join(',');
    cells.set(k, (cells.get(k) || 0) + 1);
    if (!insideLtile(ctr)) { check(false, 'sub cell outside tile ' + k); }
  }
}
check(cells.size === 56 && [...cells.values()].every((v) => v === 1), `56 distinct half-cells (got ${cells.size})`);

console.log('decorations cover the tile surface, +z outward');
const surfaceSquares = new Map();
for (const [type, M] of C.CHAIR) {
  const sq = C.DECO_SQUARE[type].map((p) => C.applyPt(M, p));
  const ctr = centroid(sq);
  const k = ctr.map((v) => v.toFixed(3)).join(',');
  surfaceSquares.set(k, (surfaceSquares.get(k) || 0) + 1);
  const out = C.applyVec(M, [0, 0, 1]);
  const ok = !insideLtile(add(ctr, out, 0.01)) && insideLtile(add(ctr, out, -0.01));
  check(ok, `${type} square at ${k}: +z -> ${out} outward, det ${C.det3(M)}`);
}
check(surfaceSquares.size === 24 && [...surfaceSquares.values()].every((v) => v === 1), '24 distinct unit squares');

console.log('tiling (level 2): every interior face pairs a<->b with Wa = Wb.S, or c<->c with W1 = W2.S');
for (const level of [1, 2]) {
  const P = C.placements(level);
  const faces = new Map();
  P.forEach((T, ti) => C.CHAIR.forEach(([type, M]) => {
    const W = C.mul(T, M);
    const ctr = centroid(C.DECO_SQUARE[type].map((p) => C.applyPt(W, p))).map((v) => v.toFixed(3)).join(',');
    if (!faces.has(ctr)) faces.set(ctr, []);
    faces.get(ctr).push({ ti, type, W });
  }));
  let pairs = 0, bad = 0, triples = 0;
  for (const list of faces.values()) {
    if (list.length > 2) triples++;
    if (list.length !== 2) continue;
    pairs++;
    const [p, q] = list;
    let ok = false;
    if (p.type === 'c' && q.type === 'c') ok = eqM(p.W, C.mul(q.W, C.S4));
    else if (p.type === 'a' && q.type === 'b') ok = eqM(p.W, C.mul(q.W, C.S4));
    else if (p.type === 'b' && q.type === 'a') ok = eqM(q.W, C.mul(p.W, C.S4));
    if (!ok) { bad++; if (bad < 5) console.log('       mismatch', p.type, q.type, JSON.stringify(p.W), JSON.stringify(q.W)); }
  }
  check(bad === 0 && triples === 0, `level ${level}: ${P.length} tiles, ${pairs} interior faces, ${bad} mismatched`);
}

console.log('decoration mesh model');
{
  const n = 8;
  const s = C.presetState('bumps', n);
  const c2 = C.symmetrizeC(C.cloneMesh(s.c));
  check(c2.pos.every((v, i) => near(v, s.c.pos[i], 1e-6)), 'preset c is S-symmetric');
  const sc = C.applyS(s.c.pos);
  let ok = true;
  for (let v = 0; v < s.c.partner.length; v++)
    for (let d = 0; d < 3; d++) ok &&= near(sc[v * 3 + d], s.c.pos[s.c.partner[v] * 3 + d], 1e-6);
  check(ok, 'S maps c onto itself (vertex-wise)');
  const nr = C.vertexNormals(s.a.rest, s.a.tri);
  check(nr[2] > 0.99, 'a winding gives +z normal');
  const r = C.resampleState(s, 16);
  check(r.n === 16 && r.a.pos.length === 17 * 17 * 3, 'resample');
  check(near(r.a.pos[(8 * 17 + 8) * 3 + 2], s.a.pos[(4 * 9 + 4) * 3 + 2], 1e-4), 'resample keeps the shape');
  const st = { store: 'c', center: [0.7, 0.3, 0], vec: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], nsign: 1 };
  const s2 = C.makeState(n);
  C.applyBrush(s2, [st, C.mirrorStamp(st)], 'pull', 0.3, 0.2);
  const zAt = (i, j) => s2.c.pos[(j * (n + 1) + i) * 3 + 2];
  check(zAt(6, 2) > 0 && near(zAt(6, 2), -zAt(2, 6), 1e-6), `c pull is antisymmetric (${zAt(6, 2).toFixed(4)}, ${zAt(2, 6).toFixed(4)})`);
}

console.log('edge flip and refinement');
{
  const area = (m) => {
    let A = 0, bad = 0;
    for (let t = 0; t < m.tri.length; t += 3) {
      const R = m.rest, [i, j, k] = [m.tri[t], m.tri[t + 1], m.tri[t + 2]];
      const a = ((R[3 * j] - R[3 * i]) * (R[3 * k + 1] - R[3 * i + 1]) - (R[3 * j + 1] - R[3 * i + 1]) * (R[3 * k] - R[3 * i])) / 2;
      if (a <= 1e-12) bad++;
      A += a;
    }
    return { A, bad };
  };
  const manifold = (m) => [...C.edgeMap(m).values()].every((e) => e[2].length <= 2);
  const bnd = (mm) => [...C.edgeMap(mm).values()].filter((e) => e[2].length === 1).length;
  const s = C.makeState(4);
  const a1 = C.flipEdge(s.a, 6, 7);
  check(typeof a1 !== 'string' && area(a1).bad === 0 && near(area(a1).A, 1) && manifold(a1), 'a: flip keeps a valid mesh');
  check(typeof a1 !== 'string' && !C.edgeMap(a1).has(6 * 25 + 7) && C.edgeMap(a1).size === C.edgeMap(s.a).size, 'a: edge swapped');
  check(typeof C.flipEdge(s.a, 0, 1) === 'string', 'a: boundary edge refused (with a reason)');
  // every adjacent pair of triangles is flippable (unless the new edge already exists)
  {
    let tried = 0, refused = 0;
    for (const [u, v, ts] of C.edgeMap(s.a).values()) {
      if (ts.length < 2) continue;
      tried++;
      if (typeof C.flipEdge(s.a, u, v) === 'string') refused++;
    }
    check(refused === 0, `a: all ${tried} interior edges flip`);
    const f = C.refineTriangles(s.a, [5]);
    let nonconvex = 0, ok = 0;
    for (const [u, v, ts] of C.edgeMap(f).values()) {
      if (ts.length < 2) continue;
      const r = C.flipEdge(f, u, v);
      if (typeof r !== 'string') { ok++; if (area(r).bad) nonconvex++; } else if (!/duplicate/.test(r)) nonconvex = 1e9;
    }
    check(ok > 0 && nonconvex < 1e9, `a refined: interior edges flip even when non-convex (${nonconvex} of ${ok} non-convex)`);
  }
  const c1 = C.flipEdge(s.c, 12 + 1, 12 + 2);
  check(typeof c1 !== 'string' && C.cIsSymmetric(c1) && area(c1).bad === 0, 'c: flip also flips the mirror edge, stays symmetric');
  // c diagonal edge: allowed now; the result is symmetric and refinable
  const cd = C.flipEdge(s.c, 6, 12);
  check(typeof cd !== 'string' && C.cIsSymmetric(cd) && manifold(cd), 'c: diagonal edge flips (self-mirror edge)');
  const cdr = typeof cd !== 'string' ? C.refineTriangles(cd, Array.from({ length: cd.tri.length / 3 }, (_, t) => t).filter((t) => t % 3 === 0)) : null;
  check(cdr && C.cIsSymmetric(cdr) && manifold(cdr) && near(area(cdr).A, 1), 'c: refining around a flipped diagonal stays symmetric');
  const r1 = C.refineTriangles(s.a, [5]);
  check(r1 && area(r1).bad === 0 && near(area(r1).A, 1) && manifold(r1) && r1.rest.length > s.a.rest.length, 'a: refine one triangle');
  const vs = C.refineTriangles(s.c, [5]);
  check(vs && C.cIsSymmetric(vs) && area(vs).bad === 0 && near(area(vs).A, 1) && manifold(vs), 'c: refine stays symmetric');
  // repeated mixed operations (flips may be non-convex) keep c symmetric and manifold
  let m = s.c;
  for (let round = 0; round < 12; round++) {
    const t = (round * 7) % (m.tri.length / 3);
    m = C.refineTriangles(m, [t]) || m;
    const es = [...C.edgeMap(m).values()];
    for (let q = 0; q < 4; q++) { const e = es[(round * 13 + q * 29) % es.length]; const r = C.flipEdge(m, e[0], e[1]); if (typeof r !== 'string') m = r; }
  }
  check(C.cIsSymmetric(m) && manifold(m) && bnd(m) === 16, `c: 12 rounds of refine+flip (${m.tri.length / 3} tris) manifold and symmetric`);
  let ma = s.a;
  for (let round = 0; round < 6; round++) ma = C.refineTriangles(ma, [(round * 5) % (ma.tri.length / 3)]) || ma;
  check(area(ma).bad === 0 && near(area(ma).A, 1) && manifold(ma) && bnd(ma) === 16, `a: 6 refinements (${ma.tri.length / 3} tris) valid, boundary untouched`);
  const d = C.cloneState(s); d.a.pos[6 * 3 + 2] = 0.5;
  const dr = C.refineTriangles(d.a, [0, 1, 2, 3]);
  check(dr && dr.pos.some((v, i) => i % 3 === 2 && v > 0.2 && i / 3 >= 25), 'refine interpolates positions');
}

console.log('delete vertex');
{
  const manifold = (m) => [...C.edgeMap(m).values()].every((e) => e[2].length <= 2);
  const totalArea = (m) => { let A = 0; const R = m.rest; for (let t = 0; t < m.tri.length; t += 3) { const [i, j, k] = [m.tri[t], m.tri[t + 1], m.tri[t + 2]]; A += ((R[3 * j] - R[3 * i]) * (R[3 * k + 1] - R[3 * i + 1]) - (R[3 * j + 1] - R[3 * i + 1]) * (R[3 * k] - R[3 * i])) / 2; } return A; };
  const s = C.makeState(4);
  const a1 = C.deleteVertex(s.a, 6);
  check(typeof a1 !== 'string' && a1.rest.length === s.a.rest.length - 3 && manifold(a1) && near(totalArea(a1), 1), `a: delete interior vertex (${typeof a1 === 'string' ? a1 : a1.tri.length / 3 + ' tris'})`);
  check(typeof C.deleteVertex(s.a, 0) === 'string', 'a: boundary vertex refused');
  // subdivide a triangle, then delete the three new midpoint vertices again
  let m = C.refineTriangles(s.a, [5]);
  const V0 = s.a.rest.length / 3;
  let ok = 0;
  for (let q = m.rest.length / 3 - 1; q >= V0; q--) { const r = C.deleteVertex(m, q); if (typeof r !== 'string') { m = r; ok++; } }
  check(ok > 0 && manifold(m) && near(totalArea(m), 1), `a: deleting subdivision vertices works (${ok} removed)`);
  const c1 = C.deleteVertex(s.c, 7);
  check(typeof c1 !== 'string' && C.cIsSymmetric(c1) && manifold(c1) && near(totalArea(c1), 1) && c1.rest.length === s.c.rest.length - 6, `c: delete removes the mirror vertex too (${typeof c1 === 'string' ? c1 : 'ok'})`);
  check(typeof C.deleteVertex(s.c, 6) === 'string', 'c: diagonal vertex refused');
  // stress: random deletes/refines/flips keep c symmetric
  let c = s.c;
  for (let round = 0; round < 30; round++) {
    const V = c.rest.length / 3;
    const act = round % 3;
    let r;
    if (act === 0) r = C.refineTriangles(c, [(round * 11) % (c.tri.length / 3)]);
    else if (act === 1) r = C.deleteVertex(c, (round * 7) % V);
    else { const es = [...C.edgeMap(c).values()]; const e = es[(round * 17) % es.length]; r = C.flipEdge(c, e[0], e[1]); }
    if (r && typeof r !== 'string') c = r;
  }
  check(C.cIsSymmetric(c) && manifold(c), `c: 30 mixed refine/delete/flip steps stay symmetric and manifold (${c.tri.length / 3} tris)`);
}

console.log('glued-face cancellation');
for (const level of [0, 1, 2]) {
  const P = C.placements(level);
  const recs = [];
  P.forEach((T, ti) => C.CHAIR.forEach(([type, M]) => recs.push({ type, tile: ti, M: C.mul(T, M) })));
  const gone = C.cancelCoincident(recs, (r) => r.M);
  // interior faces = pairs of squares shared by two tiles; each removes 2 decorations
  const n = P.length;
  const outer = recs.length - gone.size;
  // closed surface check: the surviving decorations still tile a surface (every surviving unit square is unique)
  const keys = new Map();
  for (const r of recs) if (!gone.has(r)) { const k = C.DECO_SQUARE[r.type].map((p) => C.applyPt(r.M, p).map((v) => Math.round(v * 1e4)).join(',')).sort().join('|'); keys.set(k, (keys.get(k) || 0) + 1); }
  check([...keys.values()].every((v) => v === 1) && gone.size % 2 === 0 && (level === 0 ? gone.size === 0 : gone.size > 0),
    `level ${level}: ${n} tiles, ${recs.length} decorations, ${gone.size} glued away, ${outer} on the outer surface`);
}
{
  // exploding the tiles apart separates the faces, so nothing cancels
  const P = C.placements(1);
  const recs = [];
  P.forEach((T, ti) => C.CHAIR.forEach(([type, M]) => recs.push({ type, tile: ti, M: C.mul(T, M), ti })));
  const gone = C.cancelCoincident(recs, (r) => C.mul(C.translateMat([r.ti * 0.01, 0, 0]), r.M));
  check(gone.size === 0, 'shifted tiles: nothing cancels');
}

console.log('grid snapping');
{
  const s = C.presetState('bumps', 8);
  for (const step of [1, 0.5, 0.25]) {
    const t = C.snapState(C.cloneState(s), step);
    const onLattice = (m) => { for (let v = 0; v < m.pin.length; v++) if (!m.pin[v]) for (let d = 0; d < 3; d++) { const x = m.pos[3 * v + d] / step; if (Math.abs(x - Math.round(x)) > 1e-5) return false; } return true; };
    const sym = C.symmetrizeC(C.cloneMesh(t.c));
    check(onLattice(t.a) && sym.pos.every((v, i) => near(v, t.c.pos[i], 1e-6)) && C.snapValue(0.26, 0.5) === 0.5 && C.snapValue(-0.74, 0.5) === -0.5, `step ${step}: free vertices on the lattice (a), c still S-symmetric`);
  }
  const t = C.snapState(C.cloneState(s), 0.5);
  check(t.a.pos.slice(0, 3).every((v, i) => near(v, s.a.pos[i], 1e-9)), 'pinned boundary vertices untouched');
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
