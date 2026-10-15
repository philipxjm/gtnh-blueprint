// Turns the placement ops the components emit into a block grid, applying
// each shape's direction rules (vanilla 1.7.10 placement code; see
// core/blocks.js), and converts the grid into a .schematic.
import { AIR, blockKey, lookup, type CatalogBlock } from "./catalog";
// @ts-ignore - plain JS shared with the Node tools
import { Structure as SchematicWriter } from "./core/schematic.js";
// @ts-ignore - plain JS shared with the Node tools
import { part as savedPart } from "./core/microblocks.js";
// @ts-ignore - plain JS shared with the Node tools
import { shapeTile, SHAPE_BLOCK, SHAPE_BLOCK_GLOW } from "./core/architecture-nbt.js";
// @ts-ignore - plain JS shared with the Node tools
import { shapeById, shapeByKey, orientShape } from "./core/architecture.js";

export type Vec3 = [number, number, number];
export type Facing = "north" | "south" | "east" | "west";

/** One placed block. `key` is the catalog key of the item variant. */
export interface Cell {
  key: string;
  block?: CatalogBlock;
  /** Metadata actually written to the world (direction bits included). */
  meta: number;
  /** Render hints derived from the placement. */
  facing?: Facing;
  upsideDown?: boolean;
  top?: boolean;
  axis?: "x" | "y" | "z";
  doorHalf?: "lower" | "upper";
  on?: "floor" | Facing;
  /** An ArchitectureCraft shape; `key`/`block` are then its material. */
  shape?: ShapeState;
}

/** An ArchitectureCraft shape block's tile entity state (core/architecture-nbt.js). */
export interface ShapeState {
  /** Shape id (core/architecture.js SHAPES). */
  id: number;
  side: number;
  turn: number;
  /** Shift along the shape's own x axis, in blocks (banisters: ±0.25 and similar). */
  offsetX: number;
  /** Second material: the glass of a window, cladding on a model. */
  secondaryKey?: string;
  secondary?: CatalogBlock;
  /** On ArchitectureCraft:shapeSE (glow page shapes, or glow brush). */
  glow?: boolean;
  /** Connections turned off with the chisel, bit per EnumFacing ordinal (down, up, north, south, west, east). */
  disconnected: number;
}

/** A Forge Multipart microblock: several can share one block space. */
export interface Part {
  kind: "edge" | "corner";
  /** Forge Multipart slot (core/microblocks.js). */
  slot: number;
  /** Thickness in eighths of a block: 1, 2 or 4. */
  size: number;
  /** Catalog key of the material block. */
  key: string;
  block?: CatalogBlock;
}

export type Op = { at: Vec3; cell: Cell } | { at: Vec3; part: Part };

const PART_NAME: Record<Part["kind"], Record<number, string>> = {
  edge: { 1: "strip", 2: "post", 4: "pillar" },
  corner: { 1: "nook", 2: "corner", 4: "notch" },
};
const partName = (p: Part) => PART_NAME[p.kind][p.size] ?? `${p.kind} ${p.size}/8`;

/** A microblock part of `ref`; microblocks are cut from full blocks only. */
export function partFor(ref: string, kind: Part["kind"], slot: number, size: number): { part: Part; problem?: string } {
  const key = blockKey(ref);
  const block = lookup(key);
  if (!block) return { part: { kind, slot, size, key }, problem: `unknown block "${ref}"` };
  const problem = block.shape === "cube" ? undefined : `${ref} is a ${block.shape}; microblocks are cut from full blocks`;
  return { part: { kind, slot, size, key, block }, problem };
}

export interface Problem {
  message: string;
}

const STAIR: Record<Facing, number> = { east: 0, west: 1, south: 2, north: 3 };
const AXIS = { y: 0, x: 4, z: 8 } as const;
const DOOR: Record<Facing, number> = { east: 0, south: 1, west: 2, north: 3 };
const TORCH = { west: 1, east: 2, north: 3, south: 4, floor: 5 } as const;

export interface PlaceOptions {
  facing?: Facing;
  upsideDown?: boolean;
  top?: boolean;
  axis?: "x" | "y" | "z";
  hingeRight?: boolean;
  on?: "floor" | Facing;
  meta?: number;
}

/** Cells for one placement of `ref` (two for a door: lower then upper). */
export function cellsFor(ref: string, opts: PlaceOptions = {}): { cells: Cell[]; problem?: string } {
  const key = blockKey(ref);
  if (key === AIR) return { cells: [{ key, meta: 0 }] };
  const block = lookup(key);
  if (!block) return { cells: [{ key, meta: 0 }], problem: `unknown block "${ref}"` };
  const base = block.meta;
  if (opts.meta !== undefined) return { cells: [{ key, block, meta: opts.meta }] };
  switch (block.shape) {
    case "stairs": {
      // Bits 0-2 are direction; Chisel keeps a second texture variant in bit 8.
      const facing = opts.facing ?? "north";
      return { cells: [{ key, block, facing, upsideDown: !!opts.upsideDown, meta: (base & 8) | STAIR[facing] | (opts.upsideDown ? 4 : 0) }] };
    }
    case "slab":
      return { cells: [{ key, block, top: !!opts.top, meta: (base & 7) | (opts.top ? 8 : 0) }] };
    case "pillar": {
      const axis = opts.axis ?? "y";
      return { cells: [{ key, block, axis, meta: (base & 3) | AXIS[axis] }] };
    }
    case "door": {
      const facing = opts.facing ?? "north";
      return {
        cells: [
          { key, block, facing, doorHalf: "lower", meta: DOOR[facing] },
          { key, block, facing, doorHalf: "upper", meta: 8 | (opts.hingeRight ? 1 : 0) },
        ],
      };
    }
    case "torch": {
      const on = opts.on ?? "floor";
      return { cells: [{ key, block, on, meta: TORCH[on] }] };
    }
    default:
      return { cells: [{ key, block, meta: base }] };
  }
}

export interface Material {
  key: string;
  icon: string;
  display: string;
  count: number;
  microblock?: boolean;
  /** An ArchitectureCraft shape (cut at the sawbench). */
  shape?: boolean;
  /** For shapes: what to put in the sawbench, e.g. "sawbench: 3 × Oak Wood Planks → 6". */
  sawbench?: string;
}

const nameMeta = (key: string, block?: CatalogBlock) => {
  const at = key.lastIndexOf("@");
  return { name: block?.name ?? key.slice(0, at), meta: block?.meta ?? Number(key.slice(at + 1)) };
};

export interface ShapeOptions {
  /** Shape key from core/architecture.js, e.g. "roofTile". */
  shape: string;
  facing?: Facing;
  upsideDown?: boolean;
  /** Raw orientation, overriding facing/upsideDown. */
  side?: number;
  turn?: number;
  /** Banister-style shift along the shape's own x axis, in blocks. */
  offsetX?: number;
  /** Second material (window glass, cladding). */
  secondary?: string;
  /** On the glowing block (ArchitectureCraft:shapeSE). */
  glow?: boolean;
  disconnected?: number;
}

// Blocks the sawbench takes besides normal opaque full blocks, logs included (TileSawbench.isAcceptableMaterial:
// renderAsNormalBlock and no tile entity, or glass, stained glass and slabs).
const SAWBENCH_EXTRA = new Set(["minecraft:glass", "minecraft:stained_glass"]);

/** One ArchitectureCraft shape block of material `ref`. */
export function shapeCellFor(ref: string, opts: ShapeOptions): { cell: Cell; problem?: string } {
  const key = blockKey(ref);
  const block = lookup(key);
  const sh = shapeByKey(opts.shape);
  const problems: string[] = [];
  if (!sh) problems.push(`unknown ArchitectureCraft shape "${opts.shape}"`);
  else if (sh.placeable === false) problems.push(`${sh.title} is an item, not a block (apply cladding with secondary)`);
  if (!block) problems.push(`unknown block "${ref}"`);
  else if (!(block.shape === "slab" || SAWBENCH_EXTRA.has(block.name)
    || ((block.shape === "cube" || block.shape === "pillar") && block.alpha === "opaque")))
    problems.push(`${ref} is not a sawbench material (full opaque blocks including logs, glass and slabs)`);
  const { side, turn } = opts.side !== undefined || opts.turn !== undefined
    ? { side: opts.side ?? 0, turn: opts.turn ?? 0 }
    : sh ? orientShape(sh, opts.facing ?? "north", !!opts.upsideDown) : { side: 0, turn: 0 };
  let secondaryKey: string | undefined, secondary: CatalogBlock | undefined;
  if (opts.secondary) {
    secondaryKey = blockKey(opts.secondary);
    secondary = lookup(secondaryKey);
    if (!secondary) problems.push(`unknown block "${opts.secondary}"`);
    if (sh && !sh.secondary) problems.push(`${sh.title} takes no second material`);
  }
  const cell: Cell = {
    key, block, meta: 0,
    shape: { id: sh?.id ?? 0, side, turn, offsetX: opts.offsetX ?? 0, secondaryKey, secondary, disconnected: opts.disconnected ?? 0,
      glow: !!(opts.glow || sh?.glow) },
  };
  return { cell, problem: problems.length ? problems.join("; ") : undefined };
}

export class Grid {
  readonly size: Vec3;
  private cells = new Map<number, Cell>();
  private parts = new Map<number, Part[]>();
  problems: Problem[] = [];

  constructor(size: Vec3) {
    this.size = size;
  }

  private idx([x, y, z]: Vec3) {
    return (y * this.size[2] + z) * this.size[0] + x;
  }

  inBounds([x, y, z]: Vec3) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.size[0] && y < this.size[1] && z < this.size[2];
  }

  set(at: Vec3, cell: Cell) {
    if (!this.inBounds(at)) {
      this.problems.push({ message: `${cell.key} at [${at}] is outside the ${this.size.join("x")} structure` });
      return;
    }
    const i = this.idx(at);
    this.parts.delete(i);
    if (cell.key === AIR) this.cells.delete(i);
    else this.cells.set(i, cell);
  }

  /** Add a microblock part; it replaces a full block there, or a part in the same slot. */
  addPart(at: Vec3, part: Part) {
    if (!this.inBounds(at)) {
      this.problems.push({ message: `${part.key} ${partName(part)} at [${at}] is outside the ${this.size.join("x")} structure` });
      return;
    }
    const i = this.idx(at);
    this.cells.delete(i);
    const list = (this.parts.get(i) ?? []).filter(p => !(p.kind === part.kind && p.slot === part.slot));
    list.push(part);
    this.parts.set(i, list);
  }

  partsAt(at: Vec3): Part[] {
    return this.inBounds(at) ? this.parts.get(this.idx(at)) ?? [] : [];
  }

  private pos(i: number): Vec3 {
    const [w, , l] = this.size;
    return [i % w, Math.floor(i / (w * l)), Math.floor(i / w) % l];
  }

  /** Every block space holding microblock parts. */
  *partEntries(): Generator<[Vec3, Part[]]> {
    for (const [i, list] of this.parts) yield [this.pos(i), list];
  }

  get(at: Vec3): Cell | undefined {
    return this.inBounds(at) ? this.cells.get(this.idx(at)) : undefined;
  }

  *entries(): Generator<[Vec3, Cell]> {
    for (const [i, cell] of this.cells) yield [this.pos(i), cell];
  }

  /** Full blocks placed (block spaces holding microblocks not included). */
  get count() {
    return this.cells.size;
  }

  /** Microblock parts placed. */
  get partCount() {
    let n = 0;
    for (const list of this.parts.values()) n += list.length;
    return n;
  }

  /**
   * Item counts for the build, doors counted once. Microblocks are listed
   * per material and shape ("White Lapis Caelestis strip"), ArchitectureCraft
   * shapes per material, shape and second material; `icon` is the catalog key
   * to draw a swatch from.
   */
  materials(): Material[] {
    const counts = new Map<string, Material>();
    for (const [, c] of this.entries()) {
      if (c.doorHalf === "upper") continue;
      if (c.shape) {
        const sh = shapeById(c.shape.id);
        const glass = c.shape.secondaryKey ? ` + ${c.shape.secondary?.display ?? c.shape.secondaryKey}` : "";
        const key = `${c.key} ${sh?.name ?? c.shape.id}${c.shape.secondaryKey ? " " + c.shape.secondaryKey : ""}`;
        const e = counts.get(key) ?? { key, icon: c.key, display: `${c.block?.display ?? c.key} ${sh?.title ?? "shape " + c.shape.id}${glass}`, count: 0, shape: true };
        e.count++;
        if (sh) {
          // The sawbench cuts materialUsed blocks (twice that in slabs) into itemsProduced shapes.
          const runs = Math.ceil(e.count / sh.itemsProduced);
          const used = runs * sh.materialUsed * (c.block?.shape === "slab" ? 2 : 1);
          e.sawbench = `sawbench: ${used} × ${c.block?.display ?? c.key} → ${runs * sh.itemsProduced}${glass ? `; then 1 ${glass.slice(3)} into each` : ""}`;
        }
        counts.set(key, e);
        continue;
      }
      const e = counts.get(c.key) ?? { key: c.key, icon: c.key, display: c.block?.display ?? c.key, count: 0 };
      e.count++;
      counts.set(c.key, e);
    }
    for (const list of this.parts.values()) for (const p of list) {
      const key = `${p.key} ${partName(p)}`;
      const e = counts.get(key) ?? { key, icon: p.key, display: `${p.block?.display ?? p.key} ${partName(p)}`, count: 0, microblock: true };
      e.count++;
      counts.set(key, e);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }

  /**
   * Gzipped .schematic bytes (Schematica "Alpha" format). `worldedit` also
   * makes it load in worldedit-gtnh (//schem load, //paste).
   */
  async toSchematic({ worldedit = false }: { worldedit?: boolean } = {}): Promise<Uint8Array> {
    const w = new SchematicWriter(this.size[0], this.size[1], this.size[2]);
    for (const [[x, y, z], c] of this.entries()) {
      if (c.shape) { w.setTile(x, y, z, { name: shapeBlockName(c.shape), meta: 0 }, shapeTileOf(c)); continue; }
      const name = c.block?.name ?? c.key.replace(/@\d+$/, "");
      w.set(x, y, z, { name, meta: c.meta });
    }
    for (const [[x, y, z], list] of this.partEntries()) w.setParts(x, y, z, list.map(savedPartOf));
    const raw: Uint8Array = w.toNBT({ worldedit });
    const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /**
   * Compact JSON blueprint: [x, y, z, registry name, meta] per block, and
   * [x, y, z, [[part id, material, shape], ...]] per microblock space, and
   * [x, y, z, tile entity] per ArchitectureCraft shape (plain values).
   */
  toBlueprint(name: string) {
    const blocks: [number, number, number, string, number][] = [];
    const shapes: [number, number, number, Record<string, unknown>][] = [];
    for (const [[x, y, z], c] of this.entries()) {
      if (c.shape) {
        blocks.push([x, y, z, shapeBlockName(c.shape), 0]);
        const t = shapeTileOf(c);
        shapes.push([x, y, z, Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === "object" && v ? (v as { value: unknown }).value : v]))]);
        continue;
      }
      blocks.push([x, y, z, c.block?.name ?? c.key.replace(/@\d+$/, ""), c.meta]);
    }
    const parts: [number, number, number, [string, string, number][]][] = [];
    for (const [[x, y, z], list] of this.partEntries())
      parts.push([x, y, z, list.map(savedPartOf).map((p: { id: string; material: string; shape: number }) => [p.id, p.material, p.shape])]);
    return { format: "gtnh-blueprint/1", name, size: this.size, blocks, ...(parts.length ? { parts } : {}), ...(shapes.length ? { shapes } : {}) };
  }
}

function shapeBlockName(s: ShapeState) {
  return s.glow || shapeById(s.id)?.glow ? SHAPE_BLOCK_GLOW : SHAPE_BLOCK;
}

function shapeTileOf(c: Cell) {
  const s = c.shape!;
  return shapeTile({
    shape: s.id, side: s.side, turn: s.turn, offsetX: s.offsetX, disconnected: s.disconnected,
    base: nameMeta(c.key, c.block), secondary: s.secondaryKey ? nameMeta(s.secondaryKey, s.secondary) : undefined,
  });
}

function savedPartOf(p: Part) {
  const at = p.key.lastIndexOf("@");
  const name = p.block?.name ?? p.key.slice(0, at);
  const meta = p.block?.meta ?? Number(p.key.slice(at + 1));
  return savedPart(p.kind, p.slot, p.size, name, meta);
}

export function buildGrid(size: Vec3, ops: Op[]): Grid {
  const g = new Grid(size);
  for (const op of ops) {
    if ("part" in op) g.addPart(op.at, op.part);
    else g.set(op.at, op.cell);
  }
  return g;
}
