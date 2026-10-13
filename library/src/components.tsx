// Placement components. Each one records blocks into the enclosing
// <Structure> and renders nothing itself. Later components overwrite earlier
// ones, so a <Fill> followed by <Air> carves a hole, and a <Window> placed
// after a wall replaces the wall blocks it covers.
import { BlockIcon, usePlace, usePlacePart, usePlaceShape, useReportProblem } from "./Structure";
import { gradientBlocks, type GradientPool } from "./gradient";
// @ts-ignore - plain JS shared with the Node tools
import { gradientSlot } from "./core/gradient.js";
import { lookup } from "./catalog";
import type { Facing, Vec3 } from "./model";
// @ts-ignore - plain JS shared with the Node tools
import { edgeSlot, cornerSlot } from "./core/microblocks.js";

/** A block reference: "registry:name@meta", e.g. "minecraft:stonebrick@0" or "chisel:marble@3". */
export type BlockRef = string;

function* range(from: Vec3, to: Vec3): Generator<Vec3> {
  const [x0, x1] = [Math.min(from[0], to[0]), Math.max(from[0], to[0])];
  const [y0, y1] = [Math.min(from[1], to[1]), Math.max(from[1], to[1])];
  const [z0, z1] = [Math.min(from[2], to[2]), Math.max(from[2], to[2])];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) yield [x, y, z];
}

export interface BlockProps {
  block: BlockRef;
  at: Vec3;
  /** Raw world metadata, overriding the shape's direction rules. Rarely needed. */
  meta?: number;
}

/** One block at `at` ([x, y, z]; x west→east, y up, z north→south). */
export function Block({ block, at, meta }: BlockProps) {
  usePlace()(at, block, { meta });
  return null;
}

export interface FillProps {
  block: BlockRef;
  /** One corner, inclusive. */
  from: Vec3;
  /** Opposite corner, inclusive. */
  to: Vec3;
}

/** A solid box of one block, corners inclusive. */
export function Fill({ block, from, to }: FillProps) {
  const place = usePlace();
  for (const p of range(from, to)) place(p, block);
  return null;
}

/** Clears a box back to air (corners inclusive). */
export function Air({ from, to = from }: { from: Vec3; to?: Vec3 }) {
  const place = usePlace();
  for (const p of range(from, to)) place(p, "minecraft:air");
  return null;
}

export interface HollowProps extends FillProps {
  /** Leave the floor layer out. */
  noFloor?: boolean;
  /** Leave the ceiling layer out. */
  noCeiling?: boolean;
}

/** The shell of a box: four walls plus floor and ceiling unless turned off. */
export function Hollow({ block, from, to, noFloor, noCeiling }: HollowProps) {
  const place = usePlace();
  const lo: Vec3 = [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.min(from[2], to[2])];
  const hi: Vec3 = [Math.max(from[0], to[0]), Math.max(from[1], to[1]), Math.max(from[2], to[2])];
  for (const [x, y, z] of range(lo, hi)) {
    const wall = x === lo[0] || x === hi[0] || z === lo[2] || z === hi[2];
    const floor = y === lo[1] && !noFloor, ceil = y === hi[1] && !noCeiling;
    if (wall || floor || ceil) place([x, y, z], block);
  }
  return null;
}

export interface StairsProps {
  block: BlockRef;
  at: Vec3;
  /** End of a straight run (inclusive), all with the same facing. */
  to?: Vec3;
  /** The side the tall back of the step is on — the direction you walk to go up. */
  facing: Facing;
  /** Hang the step from the ceiling (tall part at the bottom). */
  upsideDown?: boolean;
}

/** Stairs, one or a straight run. For roofs, `facing` points toward the ridge. */
export function Stairs({ block, at, to = at, facing, upsideDown }: StairsProps) {
  const place = usePlace();
  for (const p of range(at, to)) place(p, block, { facing, upsideDown });
  return null;
}

export interface SlabProps {
  block: BlockRef;
  at: Vec3;
  to?: Vec3;
  /** Upper half of the block space instead of the lower half. */
  top?: boolean;
}

/** Half-height slabs, one or a box of them. */
export function Slab({ block, at, to = at, top }: SlabProps) {
  const place = usePlace();
  for (const p of range(at, to)) place(p, block, { top });
  return null;
}

export interface PillarProps {
  block: BlockRef;
  at: Vec3;
  to?: Vec3;
  /** Direction the log/pillar runs. Default "y" (upright). */
  axis?: "x" | "y" | "z";
}

/** Logs and pillar blocks along an axis: posts, beams, lintels. */
export function Pillar({ block, at, to = at, axis = "y" }: PillarProps) {
  const place = usePlace();
  for (const p of range(at, to)) place(p, block, { axis });
  return null;
}

export interface DoorProps {
  block: BlockRef;
  /** Position of the lower half; the upper half goes directly above. */
  at: Vec3;
  /** Direction you face walking in through the door. */
  facing: Facing;
  hingeRight?: boolean;
}

/** A two-block-tall door. */
export function Door({ block, at, facing, hingeRight }: DoorProps) {
  usePlace()(at, block, { facing, hingeRight });
  return null;
}

export interface TorchProps {
  block?: BlockRef;
  at: Vec3;
  /** Where the supporting block is: "floor" or the wall's direction from the torch. */
  on?: "floor" | Facing;
}

/** A torch (or any torch-shaped light) on the floor or a wall. */
export function Torch({ block = "minecraft:torch@0", at, on = "floor" }: TorchProps) {
  usePlace()(at, block, { on });
  return null;
}

type Horizontal = "north" | "south" | "east" | "west";
/**
 * One of a block's 12 edges, named by the two faces that meet there:
 * "bottom-south" runs east-west along the bottom of the south face,
 * "north-west" is the vertical edge where the north and west faces meet.
 */
export type Edge =
  | `${"bottom" | "top"}-${Horizontal}`
  | `${"north" | "south"}-${"west" | "east"}`;
/** One of a block's 8 corners, e.g. "bottom-north-west". */
export type CornerName = `${"bottom" | "top"}-${"north" | "south"}-${"west" | "east"}`;

export interface StripProps {
  /** Material: a full block, e.g. "ExtraUtilities:greenscreen@0" (white Lapis Caelestis). */
  block: BlockRef;
  at: Vec3;
  /** End of a run (inclusive); every block space in the box gets the same strip. */
  to?: Vec3;
  /** Which edge of each block space the strip sits on. */
  edge: Edge;
  /** Thickness in eighths: 1 strip (default), 2 post, 4 pillar. */
  size?: 1 | 2 | 4;
}

/**
 * Forge Multipart strips along a block edge, e.g. outlining the inside
 * edges of a glass wall. Several strips can share one block space; a strip
 * replaces a full block in its space. The player's Schematica build prints
 * them; stock Schematica only shows them in the hologram.
 */
export function Strip({ block, at, to = at, edge, size = 1 }: StripProps) {
  const p = usePlacePart();
  let slot: number;
  try { slot = edgeSlot(edge); } catch (e) { p.problem(`Strip: ${(e as Error).message}`); return null; }
  for (const q of range(at, to)) p.place(q, block, "edge", slot, size);
  return null;
}

export interface CornerProps {
  block: BlockRef;
  at: Vec3;
  to?: Vec3;
  /** Which corner of each block space. */
  corner: CornerName;
  /** Size in eighths: 1 nook (default), 2 corner, 4 notch. */
  size?: 1 | 2 | 4;
}

/** Forge Multipart corner pieces (nook, corner, notch), e.g. to cap where strips meet. Printed like strips. */
export function Corner({ block, at, to = at, corner, size = 1 }: CornerProps) {
  const p = usePlacePart();
  let slot: number;
  try { slot = cornerSlot(corner); } catch (e) { p.problem(`Corner: ${(e as Error).message}`); return null; }
  for (const q of range(at, to)) p.place(q, block, "corner", slot, size);
  return null;
}

/** An ArchitectureCraft shape (core/architecture.js SHAPES), lowerCamel. */
export type ShapeKey =
  | "roofTile"
  | "roofOuterCorner"
  | "roofInnerCorner"
  | "roofRidge"
  | "roofSmartRidge"
  | "roofValley"
  | "roofSmartValley"
  | "roofOverhang"
  | "roofOverhangOuterCorner"
  | "roofOverhangInnerCorner"
  | "cylinder"
  | "cylinderHalf"
  | "cylinderQuarter"
  | "cylinderLargeQuarter"
  | "anticylinderLargeQuarter"
  | "pillar"
  | "post"
  | "pole"
  | "bevelledOuterCorner"
  | "bevelledInnerCorner"
  | "pillarBase"
  | "doricCapital"
  | "ionicCapital"
  | "corinthianCapital"
  | "doricTriglyph"
  | "doricTriglyphCorner"
  | "doricMetope"
  | "architrave"
  | "architraveCorner"
  | "windowFrame"
  | "windowCorner"
  | "windowMullion"
  | "sphereFull"
  | "sphereHalf"
  | "sphereQuarter"
  | "sphereEighth"
  | "sphereEighthLarge"
  | "sphereEighthLargeRev"
  | "roofOverhangGableLH"
  | "roofOverhangGableRH"
  | "roofOverhangGableEndLH"
  | "roofOverhangGableEndRH"
  | "roofOverhangRidge"
  | "roofOverhangValley"
  | "corniceLH"
  | "corniceRH"
  | "corniceEndLH"
  | "corniceEndRH"
  | "corniceRidge"
  | "corniceValley"
  | "corniceBottom"
  | "archD1"
  | "archD2"
  | "archD3A"
  | "archD3B"
  | "archD3C"
  | "archD4A"
  | "archD4B"
  | "archD4C"
  | "banisterPlainBottom"
  | "banisterPlain"
  | "banisterPlainTop"
  | "balustradeFancy"
  | "balustradeFancyCorner"
  | "balustradeFancyWithNewel"
  | "balustradeFancyNewel"
  | "balustradePlain"
  | "balustradePlainOuterCorner"
  | "balustradePlainWithNewel"
  | "banisterPlainEnd"
  | "banisterFancyNewelTall"
  | "balustradePlainInnerCorner"
  | "balustradePlainEnd"
  | "banisterFancyBottom"
  | "banisterFancy"
  | "banisterFancyTop"
  | "banisterFancyEnd"
  | "banisterPlainInnerCorner"
  | "slab"
  | "stairs"
  | "stairsOuterCorner"
  | "stairsInnerCorner"
  | "slopeTileA1"
  | "slopeTileA2"
  | "slopeTileB1"
  | "slopeTileB2"
  | "slopeTileB3"
  | "slopeTileC1"
  | "slopeTileC2"
  | "slopeTileC3"
  | "slopeTileC4"
  | "slopeTileA1SE"
  | "slopeTileA2SE"
  | "slopeTileB1SE"
  | "slopeTileB2SE"
  | "slopeTileB3SE"
  | "slopeTileC1SE"
  | "slopeTileC2SE"
  | "slopeTileC3SE"
  | "slopeTileC4SE"
  | "roofTileSE"
  | "squareSE"
  | "slabSE"
  | "angledRoofRidge"
  | "doubleRoofTile";

export interface ArchShapeProps {
  /** Which shape, e.g. "roofTile", "roofOuterCorner", "roofRidge", "stairs", "windowFrame", "archD2", "cylinder". */
  shape: ShapeKey;
  /** Material: a normal opaque block, glass or a slab, e.g. "minecraft:planks@1". The sawbench cuts shapes from it. */
  block: BlockRef;
  at: Vec3;
  /** End of a run (inclusive); every block space in the box gets the same shape. */
  to?: Vec3;
  /**
   * Two-sided shapes: the side the back is on (uphill for roof tiles, slopes,
   * stairs and banisters; the wall for cornices and overhangs). Corner shapes:
   * the corner between facing and the next direction clockwise (north = the
   * north-east corner). Ridges and valleys: either side across the ridge line
   * (a ridge running east-west takes "north" or "south"). Windows: the glass
   * lies across facing. Round and four-way shapes ignore it. Default "north".
   */
  facing?: Facing;
  /** Turn the shape over (hanging eaves, ceiling corners). Not windows. */
  upsideDown?: boolean;
  /** Window glass: a glass pane, e.g. "minecraft:glass_pane@0" or "minecraft:stained_glass_pane@15". Roofs and some models take cladding: any block. */
  secondary?: BlockRef;
  /** Banisters and balustrade ends: shift sideways, in blocks (the mod uses ±0.375). */
  offsetX?: number;
  /** Put the shape on the glowing block (Glow brush / sawbench glow page). */
  glow?: boolean;
  /** Connections cut with the chisel: bits 1 down, 2 up, 4 north, 8 south, 16 west, 32 east. */
  disconnected?: number;
  /** Raw tile entity orientation, overriding facing / upsideDown. */
  side?: number;
  turn?: number;
}

/**
 * ArchitectureCraft shapes: roofs, slopes, cornices, columns, arches,
 * windows, banisters and more, each cut at the sawbench from one material.
 * Roof shapes join their neighbours like in game (ridges and valleys sit a
 * level above the tiles they meet).
 */
export function ArchShape({ shape, block, at, to = at, facing, upsideDown, secondary, offsetX, glow, disconnected, side, turn }: ArchShapeProps) {
  const p = usePlaceShape();
  for (const q of range(at, to)) p.place(q, block, { shape, facing, upsideDown, secondary, offsetX, glow, disconnected, side, turn });
  return null;
}

export type GradientMode = "bands" | "dither" | "noise" | "map";

export interface GradientProps {
  /**
   * Waypoint blocks, in order from the low end of `axis` (bottom, west or
   * north) to the high end, e.g. ["minecraft:stonebrick@0", "chisel:marble@0"].
   * The steps between are filled with the blocks nearest in colour.
   */
  blocks: BlockRef[];
  /** One corner, inclusive. */
  from: Vec3;
  /** Opposite corner, inclusive. */
  to: Vec3;
  /** Direction the colour changes along: "y" (default; bottom to top), "x" (west to east) or "z" (north to south). */
  axis?: "x" | "y" | "z";
  /** Blocks in the strip (waypoints included). Default: one per block along the axis. */
  steps?: number;
  /**
   * "bands" (default): even bands. "dither": bands with scattered edges.
   * "noise": bands with organic, interlocking edges. "map": patches from
   * noise alone, no axis, like a biome map.
   */
  mode?: GradientMode;
  /** How far noise can push a block across bands, 0..1 (1 = up to 3 steps). Default 0.5. */
  randomness?: number;
  /** Size of the noise shapes in blocks ("noise" and "map"). Default 4. */
  scale?: number;
  /** Finer noise detail on top, 1..5. Default 2. */
  octaves?: number;
  /** Change for a different random arrangement with the same settings. Default 1. */
  seed?: number;
  /** Blocks the steps may use: "opaque" full cubes with one texture on every side (default), "glass", or any "cubes". */
  pool?: GradientPool;
  /** No block used twice in the strip. Default true. */
  unique?: boolean;
  /** Let the steps use busy, speckled or checkered textures too. Default false. */
  busy?: boolean;
  /** Only the box's shell, like <Hollow>. */
  hollow?: boolean;
  /** With hollow: leave the floor layer out. */
  noFloor?: boolean;
  /** With hollow: leave the ceiling layer out. */
  noCeiling?: boolean;
}

/**
 * A box (or hollow shell) filled with a colour gradient between waypoint
 * blocks: walls that fade from dark stone at the base to pale marble at the
 * top, a floor that blends grass into gravel, a noisy weathered facade. The
 * same props always give the same blocks.
 */
export function Gradient({ blocks, from, to, axis = "y", steps, mode = "bands", randomness = 0.5, scale = 4, octaves = 2, seed = 1,
  pool, unique = true, busy, hollow, noFloor, noCeiling }: GradientProps) {
  const place = usePlace();
  const report = useReportProblem();
  const lo = [0, 1, 2].map(i => Math.min(from[i], to[i])), hi = [0, 1, 2].map(i => Math.max(from[i], to[i]));
  const ax = { x: 0, y: 1, z: 2 }[axis];
  const len = hi[ax] - lo[ax] + 1;
  const { strip, problems } = gradientBlocks(blocks, Math.max(2, steps ?? len), { pool, unique, busy });
  problems.forEach(report);
  if (!strip.length) return null;
  for (const ref of blocks) {
    const b = lookup(ref);
    if (b && b.shape !== "cube") report(`Gradient: ${ref} is a ${b.shape}; gradients are made of full blocks`);
  }
  for (const p of range(from, to)) {
    if (hollow) {
      const wall = p[0] === lo[0] || p[0] === hi[0] || p[2] === lo[2] || p[2] === hi[2];
      const floor = p[1] === lo[1] && !noFloor, ceil = p[1] === hi[1] && !noCeiling;
      if (!(wall || floor || ceil)) continue;
    }
    const t = (p[ax] - lo[ax] + 0.5) / len;
    place(p, strip[gradientSlot(t, p[0], p[1], p[2], strip.length, { mode, randomness, scale, octaves, seed })]);
  }
  return null;
}

export interface GradientStripProps {
  /** Waypoint blocks, in order. */
  blocks: BlockRef[];
  /** Blocks in the strip. Default 9. */
  steps?: number;
  pool?: GradientPool;
  /** No block used twice. Default true. */
  unique?: boolean;
  /** Allow busy, speckled or checkered textures. Default false. */
  busy?: boolean;
}

/**
 * Shows the blocks a gradient steps through (the same strip <Gradient> uses
 * for these waypoints and steps), with names and references. Works on its
 * own, outside a <Structure>.
 */
export function GradientStrip({ blocks, steps = 9, pool, unique = true, busy }: GradientStripProps) {
  const { strip, problems } = gradientBlocks(blocks, steps, { pool, unique, busy });
  const waypoints = new Set(blocks.map(b => b.trim()));
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#15171c", color: "#e6e8eb", padding: 14, borderRadius: 10 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {strip.map((k, i) => <div key={i} style={{ flex: 1, minWidth: 0 }}><BlockIcon block={k} size={40} /></div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "4px 14px", fontSize: 12 }}>
        {strip.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            <span style={{ color: "#8b93a1", width: 18, textAlign: "right" }}>{i + 1}</span>
            <BlockIcon block={k} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: waypoints.has(k) ? 650 : 400 }} title={k}>
              {lookup(k)?.display ?? k}
            </span>
          </div>
        ))}
      </div>
      {problems.map(p => <div key={p} style={{ color: "#f3c46b", fontSize: 12, marginTop: 6 }}>⚠ {p}</div>)}
    </div>
  );
}
