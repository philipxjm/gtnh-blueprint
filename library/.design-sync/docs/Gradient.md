---
category: Placement
---
A box, or a hollow shell, inside a `<Structure>`, filled with a colour gradient between waypoint blocks. The steps in between are real blocks chosen for their colour, compared in a perceptual colour space. Use it for walls that fade from dark stone at the base to pale marble at the top, towers that lighten as they rise, floors that blend one stone into another, or weathered facades.

- `blocks`: the waypoints, in order from the low end of `axis` to the high end, e.g. `["minecraft:obsidian@0", "minecraft:stonebrick@0", "chisel:marble@0"]`. Waypoints can be any full blocks.
- `from` / `to`: the box, corners inclusive. `hollow` builds only the shell, like `<Hollow>`, and takes `noFloor` / `noCeiling`.
- `axis`: `"y"` (default, bottom to top), `"x"` (west to east) or `"z"` (north to south).
- `steps`: how many blocks the strip has. By default there's one per block along the axis.
- `mode`:
  - `"bands"` (default): clean stripes;
  - `"dither"`: bands with scattered edges;
  - `"noise"`: bands with organic, interlocking edges;
  - `"map"`: patches from noise alone, with no direction.
- Noise settings:
  - `randomness` (0..1, default 0.5): how far noise can push a block, up to 3 steps;
  - `scale` (default 4): the size of the noise shapes, in blocks;
  - `octaves` (1..5, default 2): finer detail on top;
  - `seed` (default 1): change it for another arrangement. The same props always give the same blocks.
- Which blocks the steps may use:
  - `pool`: `"opaque"` (default) means full opaque blocks with one texture on every side; `"glass"` means see-through blocks; `"cubes"` means any full block.
  - Ores, beehives, light sources and busy, speckled textures are left out unless `busy` is set.
  - `unique` (default true) uses each block at most once in the strip.

Like the other placement components, it overwrites what's there, so carve doors and windows with `<Air>` after it. Show the palette it picks with `<GradientStrip>`, using the same `blocks` and `steps`.

```tsx
<Gradient blocks={["minecraft:obsidian@0", "minecraft:stonebrick@0", "chisel:marble@0"]}
  from={[0, 1, 0]} to={[8, 12, 8]} hollow noFloor noCeiling mode="noise" randomness={0.6} />
```
