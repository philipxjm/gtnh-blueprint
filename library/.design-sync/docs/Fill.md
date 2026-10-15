---
category: Placement
---
A solid box of one block between two corners (`from`, `to`, both inclusive) inside a `<Structure>`. Use it for foundations, floors, solid walls, window bands and gable-end infill. A later `Fill` over the same cells replaces them. Water and lava are blocks too (`"minecraft:water@0"`, `"minecraft:lava@0"`, still sources): fill a pool or moat after building its basin. These are the only liquids the catalog has.

```tsx
<Fill block="minecraft:cobblestone@0" from={[0, 0, 0]} to={[10, 0, 8]} />
<Fill block="minecraft:glass_pane@0" from={[2, 2, 0]} to={[8, 3, 0]} />
```
