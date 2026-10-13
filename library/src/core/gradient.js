// Colour gradients between blocks: a strip of blocks whose colours step
// evenly from one waypoint block to the next, and a seeded noise field that
// lays that strip across a box as bands, dithered bands, noisy bands or a
// 2D/3D "map".
//
// Colours are compared in CIELAB (D65), where straight-line distance roughly
// matches how different two colours look, and the in-between colours are
// interpolated there too.

// ---- colour ------------------------------------------------------------

/** "#rrggbb" -> [r, g, b] in 0..255. */
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;

/** sRGB [0..255] -> CIELAB [L, a, b] (D65 white). */
export function rgbLab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047;
  const y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B;
  const z = (0.0193339 * R + 0.1191920 * G + 0.9503041 * B) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Squared CIE76 distance between two Lab colours. */
export const dist2 = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;

// ---- strip -------------------------------------------------------------

/**
 * A strip of `length` block keys from waypoint to waypoint. Waypoints sit at
 * evenly spaced slots (first and last at the ends); every slot between gets
 * the candidate whose colour is nearest the Lab interpolation of its two
 * waypoints.
 *
 * waypoints:  [{ key, lab }] (at least 1)
 * candidates: [{ key, lab }] blocks the in-between slots may use
 * unique:     no block twice in the strip (waypoints are reserved too), so a
 *             long strip doesn't collapse onto a few blocks; falls back to
 *             repeats once the candidates run out
 */
export function gradientStrip(waypoints, candidates, length, { unique = true } = {}) {
  if (!waypoints.length) return [];
  length = Math.max(length, waypoints.length);
  if (waypoints.length === 1) return Array(length).fill(waypoints[0].key);
  const at = waypoints.map((_, i) => Math.round(i * (length - 1) / (waypoints.length - 1)));
  const out = Array(length);
  const used = new Set(waypoints.map(w => w.key));
  waypoints.forEach((w, i) => { out[at[i]] = w.key; });
  for (let s = 0; s < waypoints.length - 1; s++) {
    const a = waypoints[s], b = waypoints[s + 1], i0 = at[s], i1 = at[s + 1];
    for (let i = i0 + 1; i < i1; i++) {
      const t = (i - i0) / (i1 - i0);
      const want = [0, 1, 2].map(k => a.lab[k] + (b.lab[k] - a.lab[k]) * t);
      let best = null, bestD = Infinity, any = null, anyD = Infinity;
      for (const c of candidates) {
        const d = dist2(c.lab, want);
        if (d < anyD) { anyD = d; any = c; }
        if (unique && used.has(c.key)) continue;
        if (d < bestD) { bestD = d; best = c; }
      }
      const pick = best ?? any ?? a;
      used.add(pick.key);
      out[i] = pick.key;
    }
  }
  return out;
}

// ---- noise -------------------------------------------------------------

// A 32-bit integer hash of (x, y, z, seed): repeatable, no state.
function hash(x, y, z, seed) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ Math.imul(seed, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** White noise in [-1, 1) for one integer cell. */
export const cellNoise = (x, y, z, seed) => hash(x, y, z, seed) / 2147483648 - 1;

const smooth = t => t * t * (3 - 2 * t);

// Value noise: random values at the integer lattice, blended smoothly between.
function valueNoise(x, y, z, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const tx = smooth(x - x0), ty = smooth(y - y0), tz = smooth(z - z0);
  const v = (i, j, k) => cellNoise(x0 + i, y0 + j, z0 + k, seed);
  const lerp = (p, q, t) => p + (q - p) * t;
  return lerp(
    lerp(lerp(v(0, 0, 0), v(1, 0, 0), tx), lerp(v(0, 1, 0), v(1, 1, 0), tx), ty),
    lerp(lerp(v(0, 0, 1), v(1, 0, 1), tx), lerp(v(0, 1, 1), v(1, 1, 1), tx), ty),
    tz);
}

/**
 * Coherent noise in about [-1, 1]: `octaves` layers of value noise, each at
 * twice the frequency and half the weight of the one before. `scale` is the
 * size of the largest features, in blocks.
 */
export function fractalNoise(x, y, z, { scale = 4, octaves = 2, seed = 1 } = {}) {
  let sum = 0, weight = 0, amp = 1, freq = 1 / Math.max(scale, 0.5);
  for (let o = 0; o < Math.max(1, octaves); o++) {
    sum += amp * valueNoise(x * freq, y * freq, z * freq, seed + o * 1013);
    weight += amp; amp /= 2; freq *= 2;
  }
  return sum / weight;
}

// ---- laying a strip across space ---------------------------------------

/**
 * Which slot of a strip of `n` blocks goes at a position. `t` is how far
 * along the gradient axis the position is (0 at the start, 1 at the end);
 * (x, y, z) are its block coordinates, for the noise.
 *
 * mode "bands":  even bands along the axis
 *      "dither": bands, each block pushed by white noise
 *      "noise":  bands, pushed by coherent noise (organic, interlocking edges)
 *      "map":    no axis: the slot comes from coherent noise alone
 * randomness 0..1: how far noise can push a block, up to 3 slots at 1.
 */
export function gradientSlot(t, x, y, z, n, { mode = "bands", randomness = 0.5, scale = 4, octaves = 2, seed = 1 } = {}) {
  const clamp = i => Math.min(n - 1, Math.max(0, i));
  if (mode === "map") {
    const v = fractalNoise(x, y, z, { scale, octaves, seed });
    // Value noise piles up near 0; stretch it so every slot is used.
    return clamp(Math.floor((Math.max(-1, Math.min(1, v * 1.8)) + 1) / 2 * n));
  }
  let pos = t * n;
  if (mode === "dither") pos += cellNoise(x, y, z, seed) * 3 * randomness;
  else if (mode === "noise") pos += fractalNoise(x, y, z, { scale, octaves, seed }) * 3 * randomness * 1.8;
  return clamp(Math.floor(pos));
}
