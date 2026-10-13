// Gradient strips over the catalog: which blocks a gradient may use, and the
// strip itself (core/gradient.js does the colour maths).
import { BLOCKS, blockKey, lookup, type CatalogBlock } from "./catalog";
// @ts-ignore - plain JS shared with the Node tools
import { gradientStrip, hexRgb, rgbLab } from "./core/gradient.js";

/**
 * Blocks an in-between slot may use:
 * - "opaque": full opaque cubes with the same texture on every side (default),
 * - "glass": see-through full cubes (stained glass and the like),
 * - "cubes": any full cube.
 * Ores, beehives, light sources and busy textures (see `busy`) are left out
 * unless named as waypoints.
 */
export type GradientPool = "opaque" | "glass" | "cubes";

type Lab = [number, number, number];

/** The colour a block shows on its side, tint included (Lapis Caelestis, leaves...). */
export function blockLab(b: CatalogBlock): Lab {
  const rgb = hexRgb(b.color) as number[];
  const tint = b.tint ? (hexRgb(b.tint) as number[]) : [255, 255, 255];
  return rgbLab(rgb.map((c, i) => (c * tint[i]) / 255) as [number, number, number]) as Lab;
}

// Ores (speckles on a base texture) and beehives aren't building blocks, whatever their average colour.
const SKIP = /\bores?\b|hive/i;
/** Textures busier than this (brightness spread) read as noise in a gradient. */
export const CALM_CONTRAST = 0.12;
const pools = new Map<string, { key: string; lab: Lab }[]>();

function pool(kind: GradientPool, busy: boolean) {
  const id = kind + (busy ? "+busy" : "");
  let list = pools.get(id);
  if (list) return list;
  list = [];
  for (const [key, b] of Object.entries(BLOCKS)) {
    if (b.shape !== "cube" || SKIP.test(b.display) || SKIP.test(key) || b.light || b.tags.includes("lamp")) continue;
    if (!busy && (b.contrast ?? 0) > CALM_CONTRAST) continue;
    if (kind === "opaque" && (b.alpha !== "opaque" || new Set(b.faces).size !== 1)) continue;
    if (kind === "glass" && b.alpha === "opaque") continue;
    list.push({ key, lab: blockLab(b) });
  }
  pools.set(id, list);
  return list;
}

export interface StripOptions {
  pool?: GradientPool;
  /** No block twice in the strip. Default true. */
  unique?: boolean;
  /** Let the steps use busy, speckled or checkered textures too. Default false. */
  busy?: boolean;
}

/**
 * A strip of `length` block keys stepping in colour through `waypoints` (block
 * references, in order). Unknown waypoints are reported in `problems` and skipped.
 */
export function gradientBlocks(waypoints: string[], length: number, opts: StripOptions = {}) {
  const problems: string[] = [];
  const points: { key: string; lab: Lab }[] = [];
  for (const ref of waypoints) {
    const b = lookup(ref);
    if (!b) problems.push(`unknown block "${ref}"`);
    else points.push({ key: blockKey(ref), lab: blockLab(b) });
  }
  const strip: string[] = gradientStrip(points, pool(opts.pool ?? "opaque", !!opts.busy), length, { unique: opts.unique ?? true });
  return { strip, problems };
}
