// Turns a BlueprintDump zip (unpacked) into the library's block catalog and
// texture atlas:
//   src/generated/catalog.json  key "registry:name@meta" -> block info
//   src/generated/atlas.png     every face texture, downscaled to 16x16
//
// Only blocks a building can use are kept: no tile entities, no fluids or
// plants or redstone parts, a known shape, and every face texture found.
//
// usage: node scripts/build-catalog.mjs ../data/dump-2.9.0-beta-3
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const dumpDir = process.argv[2] ?? join(here, "../../data/dump-2.9.0-beta-3");
const outDir = join(here, "../src/generated");
mkdirSync(outDir, { recursive: true });

const variants = JSON.parse(readFileSync(join(dumpDir, "blocks.json"), "utf8"));

const SHAPES = new Set(["cube", "slab", "stairs", "pillar", "pane", "wall", "fence", "fencegate",
  "door", "trapdoor", "carpet", "torch", "ladder"]);
const SKIP_MATERIAL = new Set(["water", "lava", "fire", "portal", "web", "cake", "plants", "vine",
  "tnt", "piston", "dragonEgg"]);
const MATERIAL_TAG = {
  rock: "stone", wood: "wood", iron: "metal", anvil: "metal", glass: "glass", ice: "ice",
  packedIce: "ice", ground: "earth", sand: "earth", clay: "earth", grass: "earth", cloth: "cloth",
  carpet: "cloth", leaves: "leaves", redstoneLight: "lamp", snow: "snow", craftedSnow: "snow",
};

function texturePath(icon) {
  const i = icon.indexOf(":");
  const [domain, path] = i < 0 ? ["minecraft", icon] : [icon.slice(0, i), icon.slice(i + 1)];
  for (const d of [domain, domain.toLowerCase()]) {
    const p = join(dumpDir, "textures", d, path + ".png");
    if (existsSync(p)) return p;
  }
  return null;
}

function shapeOf(v) {
  if (v.family === "cube" || v.family === "cube-transparent") return "cube";
  if (v.family === "other") {
    const b = v.bounds;
    return b && b.join() === "0,0,0,1,1,1" ? "cube" : null;
  }
  return SHAPES.has(v.family) ? v.family : null;
}

// ---- pick the blocks --------------------------------------------------

const picked = [];
for (const v of variants) {
  // Doors are the one family kept despite a tile entity: MalisisDoors adds
  // one for the swing animation and recreates it when the door is placed.
  if (v.hasTileEntity && v.family !== "door") continue;
  if (SKIP_MATERIAL.has(v.material)) continue;
  if (v.material === "circuits" && v.family !== "torch") continue;
  const shape = shapeOf(v);
  if (!shape) continue;
  if (!v.icons.every(Boolean)) continue;
  const paths = v.icons.map(texturePath);
  if (!paths.every(Boolean)) continue;
  // Door items only report the lower half's textures; find the upper half's.
  if (shape === "door") {
    const upper = paths.map(p => {
      for (const [a, b] of [["lower", "upper"], ["bottom", "top"]]) {
        const q = p.replace(new RegExp(a + "(?=[^/]*$)"), b);
        if (q !== p && existsSync(q)) return q;
      }
      return p;
    });
    paths.push(...upper);
  }
  picked.push({ v, shape, paths });
}

// ---- atlas -------------------------------------------------------------

const TILE = 16;
const tileIndex = new Map(); // texture path -> atlas index
const tiles = [];
for (const p of picked) for (const path of p.paths) {
  if (!tileIndex.has(path)) { tileIndex.set(path, tiles.length); tiles.push(path); }
}
const cols = Math.ceil(Math.sqrt(tiles.length));
const rows = Math.ceil(tiles.length / cols);
const atlas = new PNG({ width: cols * TILE, height: rows * TILE });
const avgColor = new Map(); // atlas index -> [r, g, b] of opaque pixels
const contrast = new Map(); // atlas index -> spread of pixel brightness (0 flat .. ~0.5 checkerboard)

tiles.forEach((path, idx) => {
  const src = PNG.sync.read(readFileSync(path));
  const size = Math.min(src.width, src.height);
  const step = size / TILE;
  const ox = (idx % cols) * TILE, oy = Math.floor(idx / cols) * TILE;
  let sr = 0, sg = 0, sb = 0, n = 0, sl = 0, sl2 = 0;
  for (let ty = 0; ty < TILE; ty++) for (let tx = 0; tx < TILE; tx++) {
    // Box-average the source pixels this tile pixel covers (HD packs).
    let r = 0, g = 0, b = 0, a = 0, c = 0;
    for (let y = Math.floor(ty * step); y < Math.floor((ty + 1) * step); y++)
      for (let x = Math.floor(tx * step); x < Math.floor((tx + 1) * step); x++) {
        const i = (y * src.width + x) * 4;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3]; c++;
      }
    const o = ((oy + ty) * atlas.width + ox + tx) * 4;
    atlas.data[o] = r / c; atlas.data[o + 1] = g / c; atlas.data[o + 2] = b / c; atlas.data[o + 3] = a / c;
    if (a / c > 128) {
      sr += r / c; sg += g / c; sb += b / c; n++;
      const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / c / 255;
      sl += l; sl2 += l * l;
    }
  }
  avgColor.set(idx, n ? [sr / n, sg / n, sb / n] : [128, 128, 128]);
  contrast.set(idx, n ? Math.sqrt(Math.max(0, sl2 / n - (sl / n) ** 2)) : 0);
});
writeFileSync(join(outDir, "atlas.png"), PNG.sync.write(atlas));

// ---- tags --------------------------------------------------------------

function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function colorTags(rgb) {
  const [h, s, l] = hsl(rgb);
  const tone = l > 0.62 ? "light" : l < 0.3 ? "dark" : "mid";
  let hue = "gray";
  if (s > 0.18) {
    hue = h < 15 || h >= 345 ? "red" : h < 40 ? "orange" : h < 65 ? "yellow" : h < 160 ? "green"
      : h < 200 ? "cyan" : h < 255 ? "blue" : h < 290 ? "purple" : "pink";
    if (hue === "orange" && l < 0.45 && s < 0.6) hue = "brown";
  }
  return [tone, hue];
}
const NAME_TAGS = [
  [/brick/i, "brick"], [/tile|tiles/i, "tile"], [/plank/i, "planks"], [/pillar|column/i, "pillar"],
  [/lamp|light|glow/i, "lamp"], [/glass/i, "glass"], [/marble/i, "marble"], [/concrete/i, "concrete"],
  [/smooth|polished/i, "smooth"], [/carved|ornate|engraved|decor/i, "ornate"], [/cobble|rough/i, "rough"],
];

// ---- catalog -----------------------------------------------------------

const catalog = {};
for (const { v, shape, paths } of picked) {
  const faces = paths.map(p => tileIndex.get(p));
  const side = avgColor.get(faces[2]);
  const tags = new Set(colorTags(side));
  const m = MATERIAL_TAG[v.material]; if (m) tags.add(m);
  for (const [re, t] of NAME_TAGS) if (re.test(v.display ?? "")) tags.add(t);
  if (v.light > 0) tags.add("light-source");
  const key = `${v.name}@${v.meta}`;
  catalog[key] = {
    name: v.name, meta: v.meta, display: v.display ?? v.name, shape,
    mod: v.name.split(":")[0],
    faces: faces.slice(0, 6), // atlas tile per side: down, up, north, south, west, east
    upperFaces: shape === "door" ? faces.slice(6) : undefined,
    alpha: v.renderPass === 1 ? "blend" : v.opaque ? "opaque" : "cutout",
    // The block colour multiplier: leaves and grass, and blocks that share one
    // texture across colours (Lapis Caelestis, Botania unstable blocks...).
    tint: v.color && v.color.toLowerCase() !== "#ffffff" ? v.color : undefined,
    light: v.light || undefined,
    tags: [...tags],
    color: "#" + side.map(c => Math.round(c).toString(16).padStart(2, "0")).join(""),
    // Standard deviation of the side texture's brightness: busy, speckled or
    // checkered textures read as noise in a gradient.
    contrast: Math.round(contrast.get(faces[2]) * 1000) / 1000,
  };
}
writeFileSync(join(outDir, "catalog.json"), JSON.stringify({ tile: TILE, cols, rows, blocks: catalog }));

const byShape = {};
for (const b of Object.values(catalog)) byShape[b.shape] = (byShape[b.shape] ?? 0) + 1;
console.log(`${Object.keys(catalog).length} blocks, ${tiles.length} textures, atlas ${atlas.width}x${atlas.height}`);
console.log(byShape);
