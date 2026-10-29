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

`blender/newl_tile.py` (`blender` is a symlink to `blender python/cgsBlenderPythonLibrary/newl_tile`, where the files live; `basic.py` there loads and registers it) — or run it from Blender's Scripting workspace; panel in the 3D viewport sidebar (N) > **Newl**.

- **One mesh.** The tile is a single object `NewlTile` holding 32 pieces as islands: 16 copies of a (8 as a, 8 through S and inside out as b) and 16 copies of the half of c below its diagonal (each c square = the half + the half through S). The islands coincide along their outlines but are not welded.
- **Linked copies.** Tab into Edit Mode and use ordinary mesh tools on any piece; with *Live symmetry + outline lock* on, the edit is carried to the other 15 copies — vertex moves live during the drag, topology changes (subdivide, knife, dissolve, fill, delete…) when the tool finishes. The edited piece is found as the one that disagrees with the rest, so undo works too. **Sync Copies** does the same on demand.
- **Fixed outlines.** The outline of each motif (square edges, and c's diagonal) cannot move. Its corners are put straight back; a vertex inside a segment can be slid along that segment (it lands on the nearest point of the segment, and stops just short of a corner or the next outline vertex). Cutting or subdividing an outline edge adds an outline vertex; dissolving one removes it. The rim of a hole cut inside a motif is not treated as outline.
- **Mesh size** (panel field, default 3) sets the n×n grid that **New Flat Tile** gives each motif square.
- **Build Tile** welds everything into one closed mesh `NewlTileBuilt`, inserting vertices where neighbouring pieces have different vertices along a shared edge. **Remesh Motif** resamples a or c on a regular grid. **Load newl JSON** reads the app's version 2 saves.
- **Zero-volume faces** are removed as part of **Build Tile** (checkbox *Remove zero-volume faces*, on by default). Every coincident vertex is welded; faces on the same vertices cancel in back-to-back pairs; and faces lying in one plane facing opposite ways have their overlap cut out of both (the leftover pieces are re-joined to their neighbours, so differently cut or partly overlapping faces are handled). Vertices closer than the panel's **Weld distance** (default 0.01; 0 = exact only) count as the same vertex and are welded, so a bump placed by hand almost exactly into a neighbour's dent cancels too — at the cost of moving those vertices by up to that distance (for an exact fit, snap the vertex to the other one while editing). Bent quads are triangulated first so they have a definite surface. It breaks the a / b / c symmetry, so it is a post effect on `NewlTileBuilt` only and never touches the editable tile. What it cannot remove is an edge where the solid merely touches itself (four faces in two crossing sheets): that is a property of the shape and is reported as a non-manifold edge.
- Per-element bookkeeping lives in three mesh attributes: `newl_piece` (face → piece), `newl_vert` (vertex → motif vertex, negative = outline), `newl_rest` (where an outline vertex sits on the outline, in the motif frame).

Test: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python blender/test_newl_tile.py`.

## Deployment note

Renamed (2026-10-29): the app is now served at `https://chaimgoodmanstrauss.com/chair44-drawer/` (deployed to `public_html/apps/chair44-drawer/` by `./deploy.sh`). It was previously `/newl/` and `/ltile/`; both old URLs 301-redirect to the new one via the redirect lines in `../update-htaccess.sh`. Local folder name stays `newl`.
