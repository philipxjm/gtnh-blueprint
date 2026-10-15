// Builds three.js geometry for a Grid: textured boxes per block shape, with
// Minecraft-style flat face shading and hidden-face culling between solid cubes.
import * as THREE from "three";
import { ATLAS } from "./catalog";
import type { Cell, Grid, Vec3, Facing } from "./model";
// @ts-ignore - plain JS shared with the Node tools
import { edgeBox, cornerBox } from "./core/microblocks.js";
// @ts-ignore - plain JS shared with the Node tools
import { shapeTriangles } from "./core/architecture.js";

// Face order matches the catalog: down, up, north, south, west, east.
const DOWN = 0, UP = 1, NORTH = 2, SOUTH = 3, WEST = 4, EAST = 5;
const SHADE = [0.5, 1, 0.8, 0.8, 0.6, 0.6];
const NEIGHBOUR: Vec3[] = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

type Box = [number, number, number, number, number, number]; // x0 y0 z0 x1 y1 z1 in 0..1

class Buffers {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  rect: number[] = [];
  idx: number[] = [];

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uvRect", new THREE.Float32BufferAttribute(this.rect, 4));
    g.setIndex(this.idx);
    return g;
  }
}

// A face's tile in the atlas, plus the rectangle the shader clamps its lookups to (half a texel inside the tile).
// Without the clamp, sampling at a face's edge can pick up the neighbouring tile and draw a coloured seam along
// block edges; antialiasing samples slightly outside the face, which at grazing angles reaches far past any margin.
function tileUV(tile: number) {
  const W = ATLAS.cols * ATLAS.tile, H = ATLAS.rows * ATLAS.tile;
  const x = (tile % ATLAS.cols) * ATLAS.tile, y = Math.floor(tile / ATLAS.cols) * ATLAS.tile;
  return {
    u0: x / W, v0: y / H, du: ATLAS.tile / W, dv: ATLAS.tile / H,
    rect: [(x + 0.5) / W, (y + 0.5) / H, (x + ATLAS.tile - 0.5) / W, (y + ATLAS.tile - 0.5) / H],
  };
}

function tintRGB(hex?: string): [number, number, number] {
  if (!hex) return [1, 1, 1];
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Emit one face of a box. Corners and UVs follow Minecraft's convention:
// texture coordinates are the face's own sub-rectangle of the block.
function face(buf: Buffers, origin: Vec3, b: Box, side: number, tile: number, tint: [number, number, number]) {
  const [x0, y0, z0, x1, y1, z1] = b;
  const [ox, oy, oz] = origin;
  let quad: [number, number, number][];
  let uv: [number, number][];
  switch (side) {
    case DOWN: quad = [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]]; uv = [[x0, z1], [x0, z0], [x1, z0], [x1, z1]]; break;
    case UP: quad = [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]; uv = [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]; break;
    case NORTH: quad = [[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]]; uv = [[1 - x1, 1 - y1], [1 - x1, 1 - y0], [1 - x0, 1 - y0], [1 - x0, 1 - y1]]; break;
    case SOUTH: quad = [[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]]; uv = [[x0, 1 - y1], [x0, 1 - y0], [x1, 1 - y0], [x1, 1 - y1]]; break;
    case WEST: quad = [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]]; uv = [[z0, 1 - y1], [z0, 1 - y0], [z1, 1 - y0], [z1, 1 - y1]]; break;
    default: quad = [[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]]; uv = [[1 - z1, 1 - y1], [1 - z1, 1 - y0], [1 - z0, 1 - y0], [1 - z0, 1 - y1]]; break;
  }
  const { u0, v0, du, dv, rect } = tileUV(tile);
  const start = buf.pos.length / 3;
  const s = SHADE[side];
  for (let i = 0; i < 4; i++) {
    buf.pos.push(ox + quad[i][0], oy + quad[i][1], oz + quad[i][2]);
    buf.uv.push(u0 + uv[i][0] * du, v0 + uv[i][1] * dv);
    buf.col.push(s * tint[0], s * tint[1], s * tint[2]);
    buf.rect.push(...rect);
  }
  buf.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
}

function box(buf: Buffers, origin: Vec3, b: Box, tiles: number[], tint: [number, number, number], skip?: (side: number) => boolean) {
  for (let side = 0; side < 6; side++) {
    if (skip?.(side)) continue;
    face(buf, origin, b, side, tiles[side], tint);
  }
}

const P = 1 / 16;

function isSolidCube(c?: Cell) {
  return !!c?.block && !c.shape && c.block.shape === "cube" && c.block.alpha === "opaque";
}

function connects(c: Cell | undefined, to: "pane" | "fence" | "wall") {
  if (!c?.block || c.shape) return false;
  const s = c.block.shape;
  if (s === "cube") return to === "pane" || c.block.alpha === "opaque";
  if (to === "pane") return s === "pane";
  if (to === "fence") return s === "fence" || s === "fencegate";
  return s === "wall" || s === "fencegate";
}

// Side textures for a pillar laid along an axis: the end texture goes on the
// two faces the axis passes through.
function pillarTiles(t: number[], axis: "x" | "y" | "z" = "y") {
  if (axis === "y") return t;
  const end = t[UP], side = t[NORTH];
  return axis === "x" ? [side, side, side, side, end, end] : [side, side, end, end, side, side];
}

const STAIR_BACK: Record<Facing, Box> = {
  east: [0.5, 0, 0, 1, 1, 1], west: [0, 0, 0, 0.5, 1, 1], south: [0, 0, 0.5, 1, 1, 1], north: [0, 0, 0, 1, 1, 0.5],
};
const DOOR_PANEL: Record<Facing, Box> = {
  east: [0, 0, 0, 3 * P, 1, 1], south: [0, 0, 0, 1, 1, 3 * P], west: [13 * P, 0, 0, 1, 1, 1], north: [0, 0, 13 * P, 1, 1, 1],
};
const TORCH_AT: Record<string, Box> = {
  floor: [7 * P, 0, 7 * P, 9 * P, 10 * P, 9 * P],
  west: [0, 3 * P, 7 * P, 2 * P, 13 * P, 9 * P], east: [14 * P, 3 * P, 7 * P, 1, 13 * P, 9 * P],
  north: [7 * P, 3 * P, 0, 9 * P, 13 * P, 2 * P], south: [7 * P, 3 * P, 14 * P, 9 * P, 13 * P, 1],
};

function postAndArms(buf: Buffers, o: Vec3, grid: Grid, at: Vec3, tiles: number[], tint: [number, number, number],
  kind: "pane" | "fence" | "wall") {
  const [x, y, z] = at;
  const n = connects(grid.get([x, y, z - 1]), kind), s = connects(grid.get([x, y, z + 1]), kind);
  const w = connects(grid.get([x - 1, y, z]), kind), e = connects(grid.get([x + 1, y, z]), kind);
  if (kind === "pane") {
    const lone = !n && !s && !w && !e;
    const a = 7 * P, b = 9 * P;
    box(buf, o, [a, 0, a, b, 1, b], tiles, tint);
    if (n || lone) box(buf, o, [a, 0, 0, b, 1, a], tiles, tint);
    if (s || lone) box(buf, o, [a, 0, b, b, 1, 1], tiles, tint);
    if (w || lone) box(buf, o, [0, 0, a, a, 1, b], tiles, tint);
    if (e || lone) box(buf, o, [b, 0, a, 1, 1, b], tiles, tint);
    return;
  }
  if (kind === "fence") {
    box(buf, o, [6 * P, 0, 6 * P, 10 * P, 1, 10 * P], tiles, tint);
    for (const [y0, y1] of [[6 * P, 9 * P], [12 * P, 15 * P]]) {
      if (n) box(buf, o, [7 * P, y0, 0, 9 * P, y1, 6 * P], tiles, tint);
      if (s) box(buf, o, [7 * P, y0, 10 * P, 9 * P, y1, 1], tiles, tint);
      if (w) box(buf, o, [0, y0, 7 * P, 6 * P, y1, 9 * P], tiles, tint);
      if (e) box(buf, o, [10 * P, y0, 7 * P, 1, y1, 9 * P], tiles, tint);
    }
    return;
  }
  box(buf, o, [4 * P, 0, 4 * P, 12 * P, 1, 12 * P], tiles, tint);
  const h = 13 * P;
  if (n) box(buf, o, [5 * P, 0, 0, 11 * P, h, 4 * P], tiles, tint);
  if (s) box(buf, o, [5 * P, 0, 12 * P, 11 * P, h, 1], tiles, tint);
  if (w) box(buf, o, [0, 0, 5 * P, 4 * P, h, 11 * P], tiles, tint);
  if (e) box(buf, o, [12 * P, 0, 5 * P, 1, h, 11 * P], tiles, tint);
}

const MISSING_TILE = -1;

// Shading for a sloped face, from its normal: Minecraft's per-axis factors blended by the normal's direction.
function shadeFor([x, y, z]: number[]) {
  const ax = x * x, ay = y * y, az = z * z;
  return ax * 0.6 + az * 0.8 + ay * (y > 0 ? 1 : 0.5);
}

interface ShapeTri { p: number[][]; uv: number[][]; tex: number; n: number[] }

// An ArchitectureCraft shape: triangles from core/architecture.js, textured with the material's north side as the mod does.
function shapeMesh(bufs: { solid: Buffers; blend: Buffers }, grid: Grid, at: Vec3, c: Cell) {
  const s = c.shape!;
  const teOf = (cell?: Cell) => cell?.shape
    ? { shape: cell.shape.id, side: cell.shape.side, turn: cell.shape.turn, offsetX: cell.shape.offsetX, secondary: !!cell.shape.secondaryKey, disconnected: cell.shape.disconnected }
    : isSolidCube(cell) ? { solid: true } : null;
  const tris: ShapeTri[] = shapeTriangles(teOf(c), (dx: number, dy: number, dz: number) => teOf(grid.get([at[0] + dx, at[1] + dy, at[2] + dz])));
  for (const t of tris) {
    const mat = t.tex >= 2 && s.secondary ? s.secondary : c.block!;
    const buf = mat.alpha === "blend" ? bufs.blend : bufs.solid;
    const { u0, v0, du, dv, rect } = tileUV(mat.faces[NORTH]);
    const tint = tintRGB(mat.tint), sh = shadeFor(t.n);
    const start = buf.pos.length / 3;
    for (let i = 0; i < 3; i++) {
      buf.pos.push(at[0] + t.p[i][0], at[1] + t.p[i][1], at[2] + t.p[i][2]);
      buf.uv.push(u0 + t.uv[i][0] * du, v0 + t.uv[i][1] * dv);
      buf.col.push(sh * tint[0], sh * tint[1], sh * tint[2]);
      buf.rect.push(...rect);
    }
    buf.idx.push(start, start + 1, start + 2);
  }
}

/** Geometry for every block at or below `maxY`, split by render pass. */
export function buildMeshes(grid: Grid, maxY = Infinity) {
  const solid = new Buffers(), blend = new Buffers(), missing = new Buffers();
  for (const [at, c] of grid.entries()) {
    if (at[1] > maxY) continue;
    const o = at;
    if (!c.block) {
      box(missing, o, [0, 0, 0, 1, 1, 1], [0, 0, 0, 0, 0, 0].map(() => MISSING_TILE), [1, 0, 1]);
      continue;
    }
    if (c.shape) { shapeMesh({ solid, blend }, grid, at, c); continue; }
    const b = c.block;
    const buf = b.alpha === "blend" ? blend : solid;
    const tint = tintRGB(b.tint);
    const t = c.doorHalf === "upper" && b.upperFaces ? b.upperFaces : b.faces;
    switch (b.shape) {
      case "cube": {
        // Hide faces against solid cubes, and between identical see-through
        // cubes (glass walls), but not against anything above the cut layer.
        box(buf, o, [0, 0, 0, 1, 1, 1], t, tint, side => {
          const d = NEIGHBOUR[side];
          const np: Vec3 = [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
          if (np[1] > maxY) return false;
          const nc = grid.get(np);
          return isSolidCube(nc) || (b.alpha !== "opaque" && nc?.key === c.key);
        });
        break;
      }
      case "slab": box(buf, o, c.top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1], t, tint); break;
      case "stairs":
        box(buf, o, c.upsideDown ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1], t, tint);
        {
          const back = STAIR_BACK[c.facing ?? "north"];
          box(buf, o, c.upsideDown ? [back[0], 0, back[2], back[3], 0.5, back[5]] : [back[0], 0.5, back[2], back[3], 1, back[5]], t, tint);
        }
        break;
      case "pillar": box(buf, o, [0, 0, 0, 1, 1, 1], pillarTiles(t, c.axis), tint); break;
      case "pane": postAndArms(buf, o, grid, at, t, tint, "pane"); break;
      case "fence": postAndArms(buf, o, grid, at, t, tint, "fence"); break;
      case "wall": postAndArms(buf, o, grid, at, t, tint, "wall"); break;
      case "fencegate": box(buf, o, [0, 5 * P, 7 * P, 1, 15 * P, 9 * P], t, tint); break;
      case "door": box(buf, o, DOOR_PANEL[c.facing ?? "north"], t, tint); break;
      case "trapdoor": box(buf, o, [0, 0, 0, 1, 3 * P, 1], t, tint); break;
      case "carpet": box(buf, o, [0, 0, 0, 1, P, 1], t, tint); break;
      case "liquid": {
        // Still water / lava: the surface sits at 14/16 unless the same liquid is above; faces between
        // liquid blocks and against solid cubes are hidden.
        const above = grid.get([at[0], at[1] + 1, at[2]]);
        const top = above?.key === c.key && at[1] + 1 <= maxY ? 1 : 14 * P;
        box(buf, o, [0, 0, 0, 1, top, 1], t, tint, side => {
          const d = NEIGHBOUR[side];
          const np: Vec3 = [at[0] + d[0], at[1] + d[1], at[2] + d[2]];
          if (np[1] > maxY) return false;
          const nc = grid.get(np);
          return nc?.key === c.key || (side !== UP && isSolidCube(nc));
        });
        break;
      }
      case "ladder": box(buf, o, [0, 0, 15 * P, 1, 1, 1], t, tint); break;
      case "torch": box(buf, o, TORCH_AT[c.on ?? "floor"], t, tint); break;
    }
  }
  // Microblocks: each part is a textured box cut from its material block.
  for (const [at, list] of grid.partEntries()) {
    if (at[1] > maxY) continue;
    for (const p of list) {
      const b = (p.kind === "edge" ? edgeBox(p.slot, p.size) : cornerBox(p.slot, p.size)) as Box;
      if (!p.block) { box(missing, at, b, [0, 0, 0, 0, 0, 0].map(() => MISSING_TILE), [1, 0, 1]); continue; }
      box(p.block.alpha === "blend" ? blend : solid, at, b, p.block.faces, tintRGB(p.block.tint));
    }
  }
  return { solid: solid.geometry(), blend: blend.geometry(), missing: missing.geometry() };
}
