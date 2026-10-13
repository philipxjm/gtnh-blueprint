import { GradientStrip } from "gtnh-blueprint";

/** Obsidian to stone bricks to marble in 12 steps. */
export function StoneToMarble() {
  return <GradientStrip blocks={["minecraft:obsidian@0", "minecraft:stonebrick@0", "chisel:marble@0"]} steps={12} />;
}

/** Red to yellow to blue wool in 12 steps. */
export function WarmToCool() {
  return <GradientStrip blocks={["minecraft:wool@14", "minecraft:wool@4", "minecraft:wool@11"]} steps={12} />;
}
