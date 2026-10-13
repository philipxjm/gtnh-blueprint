// The block catalog generated from a BlueprintDump of GTNH 2.9.0-beta-3
// (scripts/build-catalog.mjs), plus the texture atlas it indexes into.
import catalogData from "./generated/catalog.json";
import atlasUrl from "./generated/atlas.png";

export type Shape =
  | "cube" | "slab" | "stairs" | "pillar" | "pane" | "wall" | "fence" | "fencegate"
  | "door" | "trapdoor" | "carpet" | "torch" | "ladder";

export interface CatalogBlock {
  /** Registry name, e.g. "minecraft:stonebrick". */
  name: string;
  /** Metadata of the item variant (direction bits are added on placement). */
  meta: number;
  display: string;
  shape: Shape;
  mod: string;
  /** Atlas tile per side: down, up, north, south, west, east. */
  faces: number[];
  upperFaces?: number[];
  alpha: "opaque" | "cutout" | "blend";
  tint?: string;
  light?: number;
  tags: string[];
  /** Average side colour, for swatches. */
  color: string;
  /** Spread of the side texture's brightness: 0 flat, ~0.1 typical stone, 0.3+ checkered. */
  contrast?: number;
}

interface CatalogFile {
  tile: number;
  cols: number;
  rows: number;
  blocks: Record<string, CatalogBlock>;
}

const data = catalogData as unknown as CatalogFile;

export const ATLAS = { url: atlasUrl as string, tile: data.tile, cols: data.cols, rows: data.rows };
export const BLOCKS: Record<string, CatalogBlock> = data.blocks;

export const AIR = "minecraft:air";

/**
 * Normalise a block reference to a catalog key. Accepts "name@meta",
 * "name" (meta 0), and a bare vanilla id ("stonebrick" -> "minecraft:stonebrick@0").
 */
export function blockKey(ref: string): string {
  let r = ref.trim();
  if (r === "air" || r === AIR || r === AIR + "@0") return AIR;
  const at = r.lastIndexOf("@");
  let name = at < 0 ? r : r.slice(0, at);
  const meta = at < 0 ? "0" : r.slice(at + 1);
  if (!name.includes(":")) name = "minecraft:" + name;
  return `${name}@${meta}`;
}

export function lookup(ref: string): CatalogBlock | undefined {
  return BLOCKS[blockKey(ref)];
}

/** Catalog entries matching every given tag (and optional text), for pickers. */
export function search(opts: { tags?: string[]; text?: string; shape?: Shape; limit?: number } = {}) {
  const text = opts.text?.toLowerCase();
  const out: [string, CatalogBlock][] = [];
  for (const [key, b] of Object.entries(BLOCKS)) {
    if (opts.shape && b.shape !== opts.shape) continue;
    if (opts.tags && !opts.tags.every(t => b.tags.includes(t))) continue;
    if (text && !(b.display.toLowerCase().includes(text) || key.toLowerCase().includes(text))) continue;
    out.push([key, b]);
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}
