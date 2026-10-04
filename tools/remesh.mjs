// Merge coplanar triangles of an STL (binary/ASCII) or OBJ into polygons and drop vertices lying mid-line.
// usage: node tools/remesh.mjs in.stl|in.obj out.obj [--reverse] [--tol=0.005] [--snap=0.5]
//   --reverse flips the winding; --tol welds vertices and treats faces/edges as coplanar/straight within tol.
import fs from 'fs';
const [inp, outp, ...opts] = process.argv.slice(2);
const opt = opts.includes('--reverse') ? '--reverse' : '';
const TOL = +(opts.find((o) => o.startsWith('--tol='))?.slice(6) ?? 1e-4);
const SNAP = +(opts.find((o) => o.startsWith('--snap='))?.slice(7) ?? 0); // round coords to multiples of SNAP
const buf = fs.readFileSync(inp);
const verts = [];
const V = (p) => {
  if (SNAP) p = p.map((v) => Math.round(v / SNAP) * SNAP + 0);
  let i = verts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) <= TOL);
  if (i < 0) { i = verts.length; verts.push(p.slice()); }
  return i;
};
let tris = [];
const n = buf.length > 84 ? buf.readUInt32LE(80) : 0;
if (inp.endsWith('.obj')) {
  const raw = [], faces = [];
  for (const l of buf.toString().split('\n')) {
    const t = l.trim().split(/\s+/);
    if (t[0] === 'v') raw.push(t.slice(1, 4).map(Number));
    else if (t[0] === 'f') faces.push(t.slice(1).map((s) => { const i = parseInt(s); return i < 0 ? raw.length + i : i - 1; }));
  }
  const ids = raw.map(V);
  for (const f of faces) for (let i = 1; i + 1 < f.length; i++) tris.push([ids[f[0]], ids[f[i]], ids[f[i + 1]]]);
} else if (84 + n * 50 === buf.length) {
  for (let i = 0; i < n; i++) { const o = 84 + i * 50; tris.push([0, 1, 2].map((v) => V([0, 1, 2].map((d) => buf.readFloatLE(o + 12 + v * 12 + d * 4))))); }
} else {
  const vs = [...buf.toString().matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map((m) => V([+m[1], +m[2], +m[3]]));
  for (let i = 0; i < vs.length; i += 3) tris.push(vs.slice(i, i + 3));
}
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (u, w) => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
const norm = (t) => { const c = cross(sub(verts[t[1]], verts[t[0]]), sub(verts[t[2]], verts[t[0]])), l = Math.hypot(...c); return c.map((v) => v / l); };
// group: same plane (normal + offset) and connected through shared edges
tris = tris.filter((t) => new Set(t).size === 3 && Math.hypot(...cross(sub(verts[t[1]], verts[t[0]]), sub(verts[t[2]], verts[t[0]]))) > 1e-12);
const nrm = tris.map(norm);
const edgeTris = new Map();
tris.forEach((t, i) => t.forEach((a, e) => { const k = a + '>' + t[(e + 1) % 3]; edgeTris.set(k, i); }));
const grp = new Array(tris.length).fill(-1); let G = 0;
for (let i = 0; i < tris.length; i++) {
  if (grp[i] >= 0) continue;
  const st = [i], n0 = nrm[i], d0 = n0.reduce((q, v, d) => q + v * verts[tris[i][0]][d], 0); grp[i] = G;
  const coplanar = (j) => nrm[j].reduce((q, v, d) => q + v * n0[d], 0) > 1 - 1e-3 && tris[j].every((v) => Math.abs(n0.reduce((q, w, d) => q + w * verts[v][d], 0) - d0) <= 2 * TOL);
  while (st.length) {
    const t = tris[st.pop()];
    t.forEach((a, e) => { const j = edgeTris.get(t[(e + 1) % 3] + '>' + a); if (j !== undefined && grp[j] < 0 && coplanar(j)) { grp[j] = G; st.push(j); } });
  }
  G++;
}
// boundary loops per group (directed edges whose reverse is not in the same group)
const polys = [];
for (let g = 0; g < G; g++) {
  const next = new Map();
  tris.forEach((t, i) => { if (grp[i] !== g) return; t.forEach((a, e) => { const b = t[(e + 1) % 3], j = edgeTris.get(b + '>' + a); if (j === undefined || grp[j] !== g) { if (!next.has(a)) next.set(a, []); next.get(a).push(b); } }); });
  for (const [a, l] of next) if (l.length > 1) console.error('group', g, 'vertex', a, 'has branching boundary (non-manifold pinch)');
  while (next.size) {
    const s = next.keys().next().value, loop = [s];
    for (let a = s; ;) { const l = next.get(a); const b = l.shift(); if (!l.length) next.delete(a); if (b === s) break; loop.push(b); a = b; if (!next.has(a)) { console.error('open loop in group', g); break; } }
    polys.push({ g, loop });
  }
}
// drop vertices that are collinear in every polygon that uses them
const collinear = (p, a, b) => Math.hypot(...cross(sub(verts[a], verts[p]), sub(verts[b], verts[p]))) / (Math.hypot(...sub(verts[a], verts[b])) || 1) < Math.max(TOL, 1e-6) && (() => { const u = sub(verts[a], verts[p]), w = sub(verts[b], verts[p]); return u.reduce((s, v, i) => s + v * w[i], 0) < 0; })();
for (let changed = true; changed;) {
  changed = false;
  const ok = new Map();
  for (const { loop } of polys) loop.forEach((p, i) => { const L = loop.length, c = collinear(p, loop[(i + L - 1) % L], loop[(i + 1) % L]); ok.set(p, (ok.get(p) ?? true) && c); });
  for (const P of polys) { const f = P.loop.filter((p) => !ok.get(p)); if (f.length !== P.loop.length) { P.loop = f; changed = true; } }
}
if (opt === '--reverse') polys.forEach((p) => p.loop.reverse());
const used = [...new Set(polys.flatMap((p) => p.loop))].sort((a, b) => a - b), re = new Map(used.map((v, i) => [v, i + 1]));
const holes = polys.length - G;
const obj = used.map((v) => 'v ' + verts[v].join(' ')).join('\n') + '\n' + polys.map((p) => 'f ' + p.loop.map((v) => re.get(v)).join(' ')).join('\n') + '\n';
fs.writeFileSync(outp, obj);
console.log({ trianglesIn: tris.length, polygons: polys.length, vertsIn: verts.length, vertsOut: used.length, extraLoopsBeyondOnePerGroup: holes, sizes: [...new Set(polys.map((p) => p.loop.length))].sort((a, b) => a - b) });
