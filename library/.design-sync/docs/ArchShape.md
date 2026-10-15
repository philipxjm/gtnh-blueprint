---
category: Placement
---
ArchitectureCraft shapes inside a `<Structure>`: sloped roofs, ridges and valleys, cornices, columns and capitals, arches, windows, banisters and balustrades, cut at the sawbench from one material block. One shape per block space, at `at` or a run to `to`. They render exactly as in game, including roof pieces joining their neighbours.

- `block`: the material: any full opaque block (logs and stripped logs included), glass or a slab (`"minecraft:brick_block@0"`, `"chisel:marble@0"`, `"minecraft:planks@1"`, `"etfuturum:log2_stripped@1"`).
- `facing`:
  - two-sided shapes point it at their back: uphill for `roofTile`, slopes, `stairs` and banisters, the wall for cornices and overhangs;
  - ridges and valleys take either side across the ridge line (a ridge running east-west takes `"north"` or `"south"`);
  - corner shapes sit in the corner between `facing` and the next direction clockwise: `"north"` is the north-east corner, `"east"` south-east, `"south"` south-west, `"west"` north-west;
  - windows put their glass across `facing`;
  - round and four-way shapes ignore it.
- `upsideDown` hangs a shape from above (eaves, ceiling coves). Not windows.
- `secondary`: window glass (`"minecraft:glass_pane@0"`, `"minecraft:stained_glass_pane@15"`), or cladding over a roof's slope.
- `offsetX` shifts banisters sideways (`0.375` or `-0.375`).

Shapes by family:

| Family | Shapes |
|---|---|
| Roofs | `roofTile`, `roofOuterCorner`, `roofInnerCorner`, `roofRidge`, `roofValley`, `roofSmartRidge` (hip), `roofSmartValley`, `doubleRoofTile`, `angledRoofRidge` |
| Roof overhangs | `roofOverhang`, `roofOverhangOuterCorner`, `roofOverhangInnerCorner`, `roofOverhangGableLH`/`RH`, `roofOverhangGableEndLH`/`RH`, `roofOverhangRidge`, `roofOverhangValley` |
| Slopes | `slopeTileA1`–`A2`, `slopeTileB1`–`B3`, `slopeTileC1`–`C4` (shallower slopes laid as a run of 2, 3 or 4 pieces); glowing `...SE` versions |
| Cornices | `corniceLH`, `corniceRH`, `corniceEndLH`, `corniceEndRH`, `corniceRidge`, `corniceValley`, `corniceBottom` |
| Classical | `pillarBase`, `doricCapital`, `ionicCapital`, `corinthianCapital`, `doricTriglyph`, `doricTriglyphCorner`, `doricMetope`, `architrave`, `architraveCorner` |
| Round | `cylinder`, `cylinderHalf`, `cylinderQuarter`, `cylinderLargeQuarter`, `anticylinderLargeQuarter`, `pillar`, `post`, `pole`, `sphereFull`, `sphereHalf`, `sphereQuarter`, `sphereEighth`, `sphereEighthLarge`, `sphereEighthLargeRev` |
| Bevels | `bevelledOuterCorner`, `bevelledInnerCorner` |
| Arches | `archD1` (1 wide), `archD2` (2), `archD3A`–`C` (3), `archD4A`–`C` (4) |
| Windows | `windowFrame`, `windowCorner`, `windowMullion` (frames join when side by side) |
| Banisters | `banisterPlain`, `banisterPlainBottom`, `banisterPlainTop`, `banisterPlainEnd`, `banisterPlainInnerCorner`, `banisterFancy`, `banisterFancyBottom`, `banisterFancyTop`, `banisterFancyEnd`, `banisterFancyNewelTall` |
| Balustrades | `balustradePlain`, `balustradePlainOuterCorner`, `balustradePlainInnerCorner`, `balustradePlainWithNewel`, `balustradePlainEnd`, `balustradeFancy`, `balustradeFancyCorner`, `balustradeFancyWithNewel`, `balustradeFancyNewel` |
| Basic | `slab`, `stairs`, `stairsOuterCorner`, `stairsInnerCorner`, `squareSE`, `slabSE`, `roofTileSE` |

Gable roof over a 7×7 house whose walls end at y = 3, ridge running along x. Each slope climbs one block per row, and the ridge sits one level above the top tiles:

```tsx
const R = "minecraft:brick_block@0";
<ArchShape shape="roofTile" block={R} at={[0, 4, 0]} to={[6, 4, 0]} facing="south" />
<ArchShape shape="roofTile" block={R} at={[0, 5, 1]} to={[6, 5, 1]} facing="south" />
<ArchShape shape="roofTile" block={R} at={[0, 6, 2]} to={[6, 6, 2]} facing="south" />
<ArchShape shape="roofTile" block={R} at={[0, 4, 6]} to={[6, 4, 6]} facing="north" />
<ArchShape shape="roofTile" block={R} at={[0, 5, 5]} to={[6, 5, 5]} facing="north" />
<ArchShape shape="roofTile" block={R} at={[0, 6, 4]} to={[6, 6, 4]} facing="north" />
<ArchShape shape="roofRidge" block={R} at={[0, 7, 3]} to={[6, 7, 3]} facing="south" />
```

Fill the triangular gable ends with wall blocks. A window in a wall at z = 0: `<ArchShape shape="windowFrame" block="minecraft:planks@0" secondary="minecraft:glass_pane@0" at={[2, 1, 0]} to={[4, 2, 0]} facing="north" />`.

In game the player's Schematica build prints shapes with the right orientation, using the hammer and chisel for fix-ups, and adds window glass. Matter Manipulator pastes them too. The material list names each shape and its sawbench recipe.
