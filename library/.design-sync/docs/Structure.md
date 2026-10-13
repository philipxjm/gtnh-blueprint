---
category: Structure
---
Root of every build: a 3D view with a layer slider, the material list, and three buttons: Export .schematic (for Schematica), Export WorldEdit (the same build as a schematic worldedit-gtnh loads with `//schem load` and `//paste`, low north-west corner at the player's feet), and Copy blueprint. Every placement component (`Block`, `Fill`, `Hollow`, `Air`, `Stairs`, `Slab`, `Pillar`, `Door`, `Torch`, `Strip`, `Corner`, `ArchShape`, `Gradient`) must be a descendant of a `<Structure>` - outside one they throw.

- `size` is `[width, height, length]`: x runs west -> east, y up, z north -> south. Every coordinate a child uses must lie inside it (0-based).
- Children run in order and **later ones overwrite earlier ones**: big shapes first (foundation, walls), then openings (`Air`), windows, doors, trim, roof.
- Unknown block references render as a magenta cube and are listed in a yellow warning box.
- `viewHeight` sets the 3D view height in px (default 520); `hideMaterials` hides the material list.
- The footprint grid and bounding box are hidden by default; viewers toggle them with the **Grid** checkbox, and `showGrid` starts with them on.

```tsx
<Structure name="Stone hut" size={[7, 6, 7]}>
  <Fill block="minecraft:cobblestone@0" from={[0, 0, 0]} to={[6, 0, 6]} />
  <Hollow block="minecraft:stonebrick@0" from={[0, 1, 0]} to={[6, 3, 6]} noFloor noCeiling />
  <Door block="minecraft:wooden_door@0" at={[3, 1, 6]} facing="north" />
  <Slab block="minecraft:stone_slab@5" at={[0, 4, 0]} to={[6, 4, 6]} />
</Structure>
```
