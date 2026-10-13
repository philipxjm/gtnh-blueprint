---
category: Catalog
---
Shows the blocks a gradient steps through, as swatches with names and references. It works on its own, outside a `<Structure>`. With the same `blocks` (waypoints, in order), `steps`, `pool`, `unique` and `busy` as a `<Gradient>`, it shows exactly the strip that `<Gradient>` builds from. Waypoints are shown in bold. Use it to present or compare palettes before building with them.

```tsx
<GradientStrip blocks={["minecraft:wool@14", "minecraft:wool@4", "minecraft:wool@11"]} steps={12} />
```
