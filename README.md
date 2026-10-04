# newl (L-tile Decorator)

Interactive 3D editor for the a / b / c decorations of the chair ("l-tile"), showing the decorated tile and its substitution tiling.

Run: serve this folder statically (e.g. `python3 -m http.server`) and open `index.html`. No build step; three.js r186 is vendored in `vendor/`.
Test the geometry core: `node test/core.test.mjs`. Headless smoke test: `node tools/smoke.mjs <url> <outdir>`.

## Coarse / polyhedral mode

Grid resolution 2×2–6×6 gives a coarse mesh; tick **Flat facets** (H) for faceted shading so each decoration reads as a polyhedron. On coarse grids the brush radius is widened to at least 1.1 grid cells so it always reaches a vertex. Deploys to `public_html/newl/` via `./deploy.sh`.

## Editing tools

- **Vertex (V)** drags one vertex (c: its mirror partner follows). **Flip quad (E)** swaps the diagonal of the quad formed by the clicked triangle and its neighbour across the nearest edge (hover shows the quad, the edge in red, and the new diagonal in green). **Subdivide (D)** splits the clicked triangle in four; **Refine (R)** does the same for every triangle under the brush radius. Splits are conforming (neighbours are bisected to match). **Delete vertex (X)** removes an interior vertex and re-triangulates the hole left by its triangles (the inverse of subdividing; on c the mirror vertex goes too, and diagonal vertices are kept). Flips need no convexity — only that the new edge doesn't already exist. Boundary edges are never split or flipped, so square edges stay the base grid.
- **Snap to grid**: the Vertex tool always drops the dragged vertex onto the lattice of multiples of the chosen step (1 = integers, 0.5 = integers + half-integers, 0.25, 0.125), in the decoration's own frame — the same lattice in the tile frame, since all placements are integer maps. *Snap all vertices* moves every free vertex to the lattice at once (undoable); c stays symmetric. Pinned boundary vertices never move.
- Meshes are general triangle meshes (`makeMesh` in `js/core.js`); c's mirror vertex is found from rest positions, flips/refinements are applied to the mirror too, and c's diagonal edges are never flipped. `Regrid` returns to a regular grid.
- Orbit is a free trackball (no poles/gimbal lock); "Invert orbit direction" flips the drag sense. `Home` resets the view.
- Saved files are version 2 (mesh + topology); version 1 grid files still load.

## Glued-face cancellation

Where two decorations sit face to face on the same unit square (every interior face of a tiling is an a|b or c|c pair) their surfaces coincide exactly, so the pair is dropped from display and from the STL "view" export (checkbox *Cancel glued faces*, on by default; the meshes themselves are untouched). Level 2 drops 1152 of 1536 decorations. Matching uses a 1e-4 coordinate tolerance (`cancelCoincident` in `js/core.js`), so exploding the tiles apart stops the cancellation. Because both faces share the same triangulation the removed region is a whole face; no partial-overlap remeshing is done.

## Data notes

- **Chair44decorationtransforms labels are permuted.** Taken literally, with a bounded by `{{-1,0,0},{0,0,0},{0,1,0},{-1,1,0}}` and c by the unit square, three squares land outside the tile and three pairs overlap. Relabelling the given entries **a→c, b→a, c→b** makes all 24 unit squares of the tile covered exactly once, sends local +z outward everywhere, and in the tiling makes every interior face an a|b pair (W_a = W_b·S) or a c|c pair (W₁ = W₂·S). See `CHAIR_RELABEL` in `js/core.js`.
- The given l-tile facets were all wound inward; `orientFacets` reverses them to outward.

## Model

- a and c are (n+1)² vertex grids over their unit squares; b = S(a) turned inside out, S(x,y,z) = (y,x,−z).
- c is kept S-invariant (P(j,i) = S·P(i,j)), so its diagonal stays on the line x=y, z=0.
- Square edges are pinned, so neighbouring decorations always meet; brush weights taper to zero near them.
- Brushes act in world space on every decoration of the touched tile and are mapped back into the stored a / c frames.

## Blender version (tile view only)

`blender/newl_tile.py` (`blender` is a symlink to `blender python/cgsBlenderPythonLibrary/newl_tile`, where the files live; `basic.py` there loads and registers it) — or run it from Blender's Scripting workspace; panel in the 3D viewport sidebar (N) > **Newl**. The tile is 32 objects sharing two meshes: `newl_a` (a; b is the same mesh placed through S and flipped) and `newl_c` (the half of c below its diagonal; the other half is the same mesh through S). Tab into any piece and use ordinary Edit Mode tools; every copy follows. Outline vertices (square edges, and c's diagonal) are put back on their lines at z = 0 and corners on corners; they can slide, be added or dissolved. **Build Tile** welds everything into one closed mesh `NewlTileBuilt`, inserting vertices where neighbouring pieces have different vertices along a shared edge. **Remesh Motif** resamples the active motif on a regular grid. **Load newl JSON** reads the app's version 2 saves. Test: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender/test_newl_tile.py`.
