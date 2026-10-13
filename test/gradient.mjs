// Gradient strips and noise placement (library/src/core/gradient.js).
import { rgbLab, hexRgb, dist2, gradientStrip, gradientSlot, fractalNoise, cellNoise } from "../library/src/core/gradient.js";

let fail = 0;
const check = (label, cond) => { console.log(`${cond ? "OK  " : "FAIL"} ${label}`); if (!cond) fail++; };
const near = (a, b, e = 0.05) => Math.abs(a - b) < e;

{
  const white = rgbLab([255, 255, 255]), black = rgbLab([0, 0, 0]), red = rgbLab(hexRgb("#ff0000"));
  check("lab: white is L 100, a = b = 0", near(white[0], 100) && near(white[1], 0) && near(white[2], 0));
  check("lab: black is L 0", near(black[0], 0));
  check("lab: sRGB red matches the reference (53.24, 80.09, 67.20)", near(red[0], 53.24) && near(red[1], 80.09, 0.1) && near(red[2], 67.2, 0.1));
}

{
  const grey = v => ({ key: `g${v}`, lab: rgbLab([v, v, v]) });
  const cands = [0, 32, 64, 96, 128, 160, 192, 224, 255].map(grey);
  const strip = gradientStrip([grey(0), grey(255)], cands, 9);
  check("strip: waypoints at the ends", strip[0] === "g0" && strip[8] === "g255");
  check("strip: 9 steps of greys in order", strip.join() === cands.map(c => c.key).join());
  const three = gradientStrip([grey(0), grey(128), grey(255)], cands, 5);
  check("strip: middle waypoint sits in the middle slot", three[2] === "g128" && three.length === 5);
  const dupes = gradientStrip([grey(0), grey(255)], [grey(128)], 6, { unique: true });
  check("strip: falls back to repeats when unique candidates run out", dupes.length === 6 && dupes.slice(1, 5).every(k => k === "g128"));
  const uniq = gradientStrip([grey(0), grey(255)], cands, 9, { unique: true });
  check("strip: unique strips never repeat a block", new Set(uniq).size === uniq.length);
  check("strip: one waypoint fills the strip", gradientStrip([grey(10)], cands, 4).every(k => k === "g10"));
}

{
  const n = 6, slots = [];
  for (let y = 0; y < 12; y++) slots.push(gradientSlot((y + 0.5) / 12, 0, y, 0, n, { mode: "bands" }));
  check("bands: even bands, two layers each, bottom to top", slots.join() === "0,0,1,1,2,2,3,3,4,4,5,5");
  const a = [], b = [];
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) {
    a.push(gradientSlot(y / 20, x, y, 0, n, { mode: "noise", seed: 7 }));
    b.push(gradientSlot(y / 20, x, y, 0, n, { mode: "noise", seed: 7 }));
  }
  check("noise: same seed, same blocks", a.join() === b.join());
  const c = [];
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) c.push(gradientSlot(y / 20, x, y, 0, n, { mode: "noise", seed: 8 }));
  check("noise: another seed, another arrangement", a.join() !== c.join());
  check("noise: slots stay in range", a.every(s => s >= 0 && s < n));
  const map = new Set();
  for (let x = 0; x < 64; x++) for (let z = 0; z < 64; z++) map.add(gradientSlot(0, x, 0, z, n, { mode: "map", scale: 6 }));
  check("map: uses every slot over a large area", map.size === n);
  let lo = 1, hi = -1;
  for (let i = 0; i < 2000; i++) { const v = fractalNoise(i * 0.37, i * 0.11, 0); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check("noise: fractal noise stays within [-1, 1]", lo >= -1 && hi <= 1);
  check("noise: cell noise is repeatable", cellNoise(3, 4, 5, 1) === cellNoise(3, 4, 5, 1) && cellNoise(3, 4, 5, 1) !== cellNoise(3, 4, 6, 1));
}

console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
