# gtnh-blueprint

React components for designing **buildings** for GT New Horizons 2.9 and
exporting them as Schematica `.schematic` files. Every block is a real GTNH
2.9.0-beta-3 block (6,360 building variants dumped from the pack), drawn with
the pack's own textures.

```tsx
import { Structure, Fill, Hollow, Pillar, Stairs, Slab, Block, Door, Torch } from "gtnh-blueprint";

<Structure name="Spruce cottage" size={[11, 10, 9]}>
  <Fill block="minecraft:cobblestone@0" from={[0, 0, 0]} to={[10, 0, 8]} />
  <Hollow block="minecraft:planks@1" from={[0, 1, 0]} to={[10, 4, 8]} noFloor noCeiling />
  <Pillar block="minecraft:log@1" at={[0, 1, 0]} to={[0, 4, 0]} />
  <Block block="minecraft:glass_pane@0" at={[3, 2, 0]} />
  <Door block="minecraft:wooden_door@0" at={[5, 1, 8]} facing="north" />
  <Stairs block="minecraft:stone_brick_stairs@0" at={[0, 5, 0]} to={[10, 5, 0]} facing="south" />
</Structure>
```

## Coordinates

- `[x, y, z]`, integers, all inside `size` (`[width, height, length]`).
- **x** runs west → east, **y** runs up, **z** runs north → south.
- `y = 0` is the bottom layer (usually the foundation or floor).
- The `.schematic` origin is the north-west bottom corner, `[0, 0, 0]`.

## Components

| Component | Use |
|---|---|
| `<Structure name size viewHeight? hideMaterials? showGrid?>` | Root. 3D view, layer slider, Grid toggle, material list, **Export .schematic** (Schematica), **Export WorldEdit** (`//schem load` + `//paste`), **Copy blueprint**. Every other component goes inside it. |
| `<Block block at>` | One block. |
| `<Fill block from to>` | Solid box, corners inclusive. |
| `<Hollow block from to noFloor? noCeiling?>` | Box shell: walls, plus floor and ceiling unless turned off. |
| `<Air from to?>` | Clear blocks (doorways, window holes). |
| `<Stairs block at to? facing upsideDown?>` | Stairs or a straight run. `facing` = the side the tall back is on. |
| `<Slab block at to? top?>` | Half slabs; `top` puts them in the upper half. |
| `<Pillar block at to? axis?>` | Logs and pillar blocks; `axis` "y" (posts), "x" or "z" (beams). |
| `<Door block at facing hingeRight?>` | Two-tall door; `at` is the lower half; `facing` = direction you walk in. |
| `<Torch at on?>` | Torch on the "floor" or on a wall ("north" = wall is north of the torch). |
| `<Strip block at to? edge size?>` | Forge Multipart strips along one edge of each block space (see Microblocks). |
| `<Corner block at to? corner size?>` | Forge Multipart corner pieces (nooks). |
| `<ArchShape shape block at to? facing? upsideDown? secondary? offsetX?>` | ArchitectureCraft shapes (roofs, cornices, columns, arches, windows, banisters...); see `.design-sync/docs/ArchShape.md`. |
| `<Gradient blocks from to axis? steps? mode? randomness? scale? octaves? seed? hollow?>` | A box or shell filled with a colour gradient between waypoint blocks; see `.design-sync/docs/Gradient.md`. |
| `<GradientStrip blocks steps?>` | Shows the blocks a gradient steps through. |
| `<Palette tags? shape? query?>` | Searchable block picker (for people choosing blocks). |

**Later components overwrite earlier ones.** Build big shapes first, then
details: walls, then windows and doors, then trim.

## Block references

`block` is `"registry:name@meta"`, e.g. `"minecraft:stonebrick@0"`,
`"chisel:marble@1"`. Meta is the item variant (wood type, colour, Chisel
pattern). Do not add direction bits yourself: `Stairs`, `Slab`, `Pillar`,
`Door` and `Torch` work them out. An unknown reference renders as a magenta
cube and is listed in the warning box.

Use the right component for the block's shape: stairs blocks with `<Stairs>`,
slab blocks with `<Slab>`, logs with `<Pillar>`. Panes, fences and walls are
placed with `<Block>`/`<Fill>` and connect to their neighbours on their own.

## Recipes

**Gable roof, ridge along x** (building `W` wide, `L` long, walls up to
`y = top`): for each step `k = 0, 1, 2…` while `k < L/2`:

```tsx
<Stairs block={roof} at={[0, top + 1 + k, k]} to={[W - 1, top + 1 + k, k]} facing="south" />
<Stairs block={roof} at={[0, top + 1 + k, L - 1 - k]} to={[W - 1, top + 1 + k, L - 1 - k]} facing="north" />
```

Fill the triangular gable ends (x = 0 and x = W - 1) between the two rows with
wall blocks, and cap an odd-length roof with a `<Slab>` run along the ridge.
For a ridge along z, swap: rows along z, `facing="east"` on the west slope and
`facing="west"` on the east slope.

**Overhang:** make `size` one bigger on each side and start the roof rows at
x = 0 / z = 0 while the walls start at 1.

**Window band:** after the walls, `<Fill block="minecraft:glass_pane@0" from={[2, 2, 0]} to={[8, 3, 0]} />`.

**Upside-down stairs** make eaves, arches and window hoods; top slabs make
thin ceilings and floor trims.

## Suggested palette

Stone: `minecraft:stonebrick@0` (stone bricks), `@1` mossy, `@2` cracked,
`@3` chiseled; `minecraft:stone_brick_stairs@0`; `minecraft:stone_slab@5`
(stone brick slab); `minecraft:cobblestone@0`, `minecraft:stone_stairs@0`,
`minecraft:cobblestone_wall@0`; `minecraft:stone@0`.

Brick and sandstone: `minecraft:brick_block@0`, `minecraft:brick_stairs@0`,
`minecraft:stone_slab@4`; `minecraft:sandstone@0` / `@1` chiseled / `@2`
smooth, `minecraft:sandstone_stairs@0`, `minecraft:stone_slab@1`.

Light stone: `minecraft:quartz_block@0` / `@1` chiseled / `@2` pillar,
`minecraft:quartz_stairs@0`, `minecraft:stone_slab@7`; `chisel:marble@0`,
`chisel:marble_pillar@0`, `chisel:marble_stairs.0@0`; `chisel:limestone@0`,
`chisel:limestone_stairs.0@0`; `chisel:diorite@0`, `chisel:andesite@0`,
`chisel:granite@0`.

Dark stone: `etfuturum:cobbled_deepslate@0`,
`etfuturum:cobbled_deepslate_stairs@0`, `etfuturum:deepslate_brick_slab@0`;
`minecraft:nether_brick@0`, `minecraft:nether_brick_stairs@0`,
`minecraft:nether_brick_fence@0`; `minecraft:obsidian@0`.

Wood (meta 0 oak, 1 spruce, 2 birch, 3 jungle, 4 acacia, 5 dark oak):
`minecraft:planks@N`, `minecraft:wooden_slab@N`, `minecraft:oak_stairs@0`,
`minecraft:spruce_stairs@0`, `minecraft:birch_stairs@0`,
`minecraft:jungle_stairs@0`, `minecraft:acacia_stairs@0`,
`minecraft:dark_oak_stairs@0`, logs `minecraft:log@0..3`,
`minecraft:log2@0..1`, `minecraft:fence@0`.

Glass and light: `minecraft:glass@0`, `minecraft:glass_pane@0`,
`minecraft:stained_glass@0..15`, `minecraft:stained_glass_pane@0..15`;
`minecraft:glowstone@0`, `minecraft:redstone_lamp@0`, `chisel:lantern@0..`,
`minecraft:torch@0` (via `<Torch>`).

Colour and fabric: `minecraft:hardened_clay@0`,
`minecraft:stained_hardened_clay@0..15`, `minecraft:wool@0..15`,
`minecraft:carpet@0..15`. Modern: `chisel:concrete@0`,
`chisel:factoryblock@0`, `chisel:laboratoryblock@0`.

Doors: `minecraft:wooden_door@0`, `minecraft:iron_door@0`.

The full catalog (`BLOCKS`, or the `<Palette>` component) has every Chisel,
Et Futurum, Botania, Ztones, GT stone and other building block in the pack.

## Microblocks

`<Strip>` and `<Corner>` place Forge Multipart microblocks: thin parts cut
from a full block (`block` is the material, any full block). Several can share
one block space, so put them in the air next to what they trim, not inside it.

`edge` names the block edge by the two faces that meet there:
`"bottom-north"`, `"top-south"`, `"bottom-west"`... run horizontally;
`"north-west"`, `"south-east"`... are vertical. `size` is 1 (strip, default),
2 (post) or 4 (pillar) eighths of a block. `<Corner corner="bottom-north-west">`
places a nook (size 1), corner (2) or notch (4).

**Window outline:** black glass wall at `z = 11`, white Lapis Caelestis strips
on the inside edges (the room is at `z <= 10`):

```tsx
const LAPIS = "ExtraUtilities:greenscreen@0"; // white; @15 black
<Fill block="minecraft:stained_glass@15" from={[0, 0, 11]} to={[4, 6, 11]} />
<Strip block={LAPIS} at={[0, 0, 10]} to={[4, 0, 10]} edge="bottom-south" />
<Strip block={LAPIS} at={[0, 6, 10]} to={[4, 6, 10]} edge="top-south" />
<Strip block={LAPIS} at={[0, 0, 10]} to={[0, 6, 10]} edge="south-west" />
<Strip block={LAPIS} at={[4, 0, 10]} to={[4, 6, 10]} edge="south-east" />
```

In game, Schematica shows microblocks in the hologram, but its printer does
not place them and its material list leaves them out: the Structure's own
material list counts them ("… strip"); place them by hand along the hologram.
Material names: Lapis Caelestis is checked against Extra Utilities; other
blocks use Forge Multipart's default naming (registry name, `_meta` suffix),
which is right for vanilla and config-registered blocks but unchecked per mod.

## Printing

Click **Export .schematic**, put the file in `.minecraft/schematics/`, load it
with Schematica, and build along the hologram (or use its printer). If the
download is blocked, **Copy blueprint** copies a JSON version.
