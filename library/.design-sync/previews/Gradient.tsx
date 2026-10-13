import { Structure, Fill, Air, Gradient } from "gtnh-blueprint";

const DARK_TO_LIGHT = ["minecraft:obsidian@0", "minecraft:stonebrick@0", "chisel:marble@0"];

/** A square tower whose walls fade from obsidian at the base to marble at the top, with noisy edges. */
export function FadingTower() {
  return (
    <Structure name="Fading tower" size={[9, 16, 9]} viewHeight={340}>
      <Fill block="minecraft:stonebrick@0" from={[0, 0, 0]} to={[8, 0, 8]} />
      <Gradient blocks={DARK_TO_LIGHT} from={[0, 1, 0]} to={[8, 15, 8]} hollow noFloor noCeiling mode="noise" randomness={0.6} />
      <Air from={[4, 1, 0]} to={[4, 2, 0]} />
      <Air from={[2, 7, 0]} to={[2, 8, 0]} /><Air from={[6, 7, 0]} to={[6, 8, 0]} />
    </Structure>
  );
}

/** The four modes as panels of one wall: bands and dither on top, noise and map below. */
export function Modes() {
  return (
    <Structure name="Bands · dither / noise · map" size={[21, 21, 1]} viewHeight={320} hideMaterials>
      <Gradient blocks={DARK_TO_LIGHT} from={[0, 11, 0]} to={[9, 20, 0]} mode="bands" />
      <Gradient blocks={DARK_TO_LIGHT} from={[11, 11, 0]} to={[20, 20, 0]} mode="dither" randomness={0.7} />
      <Gradient blocks={DARK_TO_LIGHT} from={[0, 0, 0]} to={[9, 9, 0]} mode="noise" randomness={0.7} />
      <Gradient blocks={DARK_TO_LIGHT} from={[11, 0, 0]} to={[20, 9, 0]} mode="map" scale={3} />
    </Structure>
  );
}

/** A floor blending sandstone into terracotta along x. */
export function FloorBlend() {
  return (
    <Structure name="Floor blend" size={[16, 1, 8]} viewHeight={240}>
      <Gradient blocks={["minecraft:sandstone@2", "minecraft:hardened_clay@0", "minecraft:stained_hardened_clay@14"]} from={[0, 0, 0]} to={[15, 0, 7]} axis="x" mode="dither" />
    </Structure>
  );
}
