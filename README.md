# newl (L-tile Decorator)

Interactive 3D editor for the a / b / c decorations of the chair ("l-tile"), showing the decorated tile and its substitution tiling.

Run: serve this folder statically (e.g. `python3 -m http.server`) and open `index.html`. No build step; three.js r186 is vendored in `vendor/`.
Test the geometry core: `node test/core.test.mjs`. Headless smoke test: `node tools/smoke.mjs <url> <outdir>`.

## Coarse / polyhedral mode

Grid resolution 2×2–6×6 gives a coarse mesh; tick **Flat facets** (H) for faceted shading so each decoration reads as a polyhedron. On coarse grids the brush radius is widened to at least 1.1 grid cells so it always reaches a vertex. Deploys to `public_html/newl/` via `./deploy.sh`.

## Editing tools

- **Vertex (V)** drags one vertex (c: its mirror partner follows). **Flip quad (E)** swaps the diagonal of the quad formed by the clicked triangle and its neighbour across the nearest edge (hover shows the quad, the edge in red, and the new diagonal in green). **Subdivide (D)** splits the clicked triangle in four; **Refine (R)** does the same for every triangle under the brush radius. Splits are conforming (neighbours are bisected to match). **Delete vertex (X)** removes an interior vertex and re-triangulates the hole left by its triangles (the inverse of subdividing; on c the mirror vertex goes too, and diagonal vertices are kept). Flips need no convexity — only that the new edge doesn't already exist. Boundary edges are never split or flipped, so square edges stay the base grid.
- Meshes are general triangle meshes (`makeMesh` in `js/core.js`); c's mirror vertex is found from rest positions, flips/refinements are applied to the mirror too, and c's diagonal edges are never flipped. `Regrid` returns to a regular grid.
- Orbit is a free trackball (no poles/gimbal lock); "Invert orbit direction" flips the drag sense. `Home` resets the view.
- Saved files are version 2 (mesh + topology); version 1 grid files still load.

## Data notes

- **Chair44decorationtransforms labels are permuted.** Taken literally, with a bounded by `{{-1,0,0},{0,0,0},{0,1,0},{-1,1,0}}` and c by the unit square, three squares land outside the tile and three pairs overlap. Relabelling the given entries **a→c, b→a, c→b** makes all 24 unit squares of the tile covered exactly once, sends local +z outward everywhere, and in the tiling makes every interior face an a|b pair (W_a = W_b·S) or a c|c pair (W₁ = W₂·S). See `CHAIR_RELABEL` in `js/core.js`.
- The given l-tile facets were all wound inward; `orientFacets` reverses them to outward.

## Model

- a and c are (n+1)² vertex grids over their unit squares; b = S(a) turned inside out, S(x,y,z) = (y,x,−z).
- c is kept S-invariant (P(j,i) = S·P(i,j)), so its diagonal stays on the line x=y, z=0.
- Square edges are pinned, so neighbouring decorations always meet; brush weights taper to zero near them.
- Brushes act in world space on every decoration of the touched tile and are mapped back into the stored a / c frames.
