import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildGrid, cellsFor, partFor, shapeCellFor, type ShapeOptions, type Grid, type Op, type Part, type PlaceOptions, type Vec3 } from "./model";
import { Viewer } from "./Viewer";
import { ATLAS, lookup } from "./catalog";

interface Collector {
  ops: Op[];
  problems: string[];
}

const StructureContext = createContext<Collector | null>(null);

/** Used by the placement components: records blocks during render. */
export function usePlace() {
  const c = useContext(StructureContext);
  if (!c) throw new Error("Block components must be inside a <Structure>");
  return (at: Vec3, ref: string, opts?: PlaceOptions) => {
    const { cells, problem } = cellsFor(ref, opts);
    if (problem) c.problems.push(problem);
    cells.forEach((cell, i) => c.ops.push({ at: [at[0], at[1] + i, at[2]], cell }));
  };
}

/** Lets a component add a line to the Structure's warning box. */
export function useReportProblem() {
  const c = useContext(StructureContext);
  if (!c) throw new Error("Block components must be inside a <Structure>");
  return (message: string) => { c.problems.push(message); };
}

/** Used by <Shape>: records ArchitectureCraft shape blocks during render. */
export function usePlaceShape() {
  const c = useContext(StructureContext);
  if (!c) throw new Error("Block components must be inside a <Structure>");
  return {
    place(at: Vec3, ref: string, opts: ShapeOptions) {
      const { cell, problem } = shapeCellFor(ref, opts);
      if (problem) c.problems.push(problem);
      c.ops.push({ at, cell });
    },
    problem(message: string) {
      c.problems.push(message);
    },
  };
}

/** Used by the microblock components: records parts during render. */
export function usePlacePart() {
  const c = useContext(StructureContext);
  if (!c) throw new Error("Block components must be inside a <Structure>");
  return {
    place(at: Vec3, ref: string, kind: Part["kind"], slot: number, size: number) {
      const { part, problem } = partFor(ref, kind, slot, size);
      if (problem) c.problems.push(problem);
      c.ops.push({ at, part });
    },
    problem(message: string) {
      c.problems.push(message);
    },
  };
}

const opSig = (o: Op) => "part" in o
  ? `${o.at}:p${o.part.kind}${o.part.slot}/${o.part.size}:${o.part.key}`
  : `${o.at}:${o.cell.key}:${o.cell.meta}:${o.cell.doorHalf ?? ""}:${o.cell.on ?? ""}${o.cell.shape ? ":" + JSON.stringify({ ...o.cell.shape, secondary: undefined }) : ""}`;

export interface StructureProps {
  /** Shown in the header and used as the .schematic file name. */
  name: string;
  /** [width (x, west→east), height (y, up), length (z, north→south)]. */
  size: Vec3;
  /** Height of the 3D view in px. Default 520. */
  viewHeight?: number;
  /** Hide the material list. */
  hideMaterials?: boolean;
  /** Start with the footprint grid and bounding box shown (the Grid checkbox toggles it). Default off. */
  showGrid?: boolean;
  children?: ReactNode;
}

const css = {
  root: { fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#e6e8eb", background: "#15171c", borderRadius: 10, padding: 14, maxWidth: 1100 } as const,
  head: { display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" } as const,
  title: { fontSize: 18, fontWeight: 650 } as const,
  dim: { color: "#8b93a1", fontSize: 13 } as const,
  bar: { display: "flex", alignItems: "center", gap: 10, margin: "10px 0", flexWrap: "wrap" } as const,
  btn: { background: "#2d6cdf", color: "white", border: 0, borderRadius: 6, padding: "7px 12px", fontSize: 13, cursor: "pointer" } as const,
  btn2: { background: "#2a2f39", color: "#e6e8eb", border: 0, borderRadius: 6, padding: "7px 12px", fontSize: 13, cursor: "pointer" } as const,
  warn: { background: "#3a2a12", color: "#f3c46b", borderRadius: 6, padding: "8px 10px", fontSize: 13, margin: "8px 0" } as const,
  mats: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "4px 14px", fontSize: 13 } as const,
};

/** 16px swatch of a block's side texture, cut from the atlas. */
export function BlockIcon({ block, size = 16 }: { block: string; size?: number }) {
  const b = lookup(block);
  if (!b) return <span style={{ display: "inline-block", width: size, height: size, background: "#f0f" }} />;
  const tile = b.faces[2];
  const scale = size / ATLAS.tile;
  return (
    <span
      title={b.display}
      style={{
        display: "inline-block", width: size, height: size, flex: "none", imageRendering: "pixelated",
        backgroundImage: `url(${ATLAS.url})`,
        // Blocks coloured by a multiplier (leaves, Lapis Caelestis...) share a grey or white texture.
        ...(b.tint ? { backgroundColor: b.tint, backgroundBlendMode: "multiply" } : {}),
        backgroundSize: `${ATLAS.cols * ATLAS.tile * scale}px ${ATLAS.rows * ATLAS.tile * scale}px`,
        backgroundPosition: `-${(tile % ATLAS.cols) * ATLAS.tile * scale}px -${Math.floor(tile / ATLAS.cols) * ATLAS.tile * scale}px`,
      }}
    />
  );
}

function download(bytes: Uint8Array, file: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Root of a build. Children place blocks; the Structure shows them in 3D with
 * a layer slider, lists the materials, and exports a .schematic for
 * Schematica (GTNH 2.9).
 */
export function Structure({ name, size, viewHeight = 520, hideMaterials, showGrid = false, children }: StructureProps) {
  // Children record their blocks into this collector while they render; it
  // is reset at the start of every Structure render so it never goes stale.
  const collector = useRef<Collector>({ ops: [], problems: [] });
  collector.current = { ops: [], problems: [] };
  const [grid, setGrid] = useState<Grid | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [maxY, setMaxY] = useState(size[1] - 1);
  const [gridShown, setGridShown] = useState(showGrid);
  const [note, setNote] = useState("");

  // Children have rendered by the time this runs. A fresh collector object
  // is passed as the context value on every render, so every placing
  // component re-renders (and re-records) even when React would otherwise
  // reuse the unchanged children elements. Only rebuild when the ops change.
  const signature = useRef("");
  useLayoutEffect(() => {
    const c = collector.current;
    const sig = size.join() + "|" + c.problems.join(";") + "|" + c.ops.map(opSig).join(";");
    if (sig === signature.current) return;
    signature.current = sig;
    const g = buildGrid(size, c.ops);
    setGrid(g);
    setProblems([...new Set([...c.problems, ...g.problems.map(p => p.message)])]);
  });

  const mats = useMemo(() => grid?.materials() ?? [], [grid]);
  const file = name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "blueprint";

  const exportSchematic = async (worldedit: boolean) => {
    if (!grid) return;
    const bytes = await grid.toSchematic({ worldedit });
    const out = worldedit ? `${file}_worldedit.schematic` : `${file}.schematic`;
    try {
      download(bytes, out);
      setNote(worldedit
        ? `Saved ${out} — put it in config/worldedit/schematics/, then //schem load ${file}_worldedit and //paste`
        : `Saved ${out} — put it in .minecraft/schematics/`);
    } catch {
      setNote("Download blocked here — use Copy blueprint instead.");
    }
  };
  const copyBlueprint = async () => {
    if (!grid) return;
    const text = JSON.stringify(grid.toBlueprint(name));
    try {
      await navigator.clipboard.writeText(text);
      setNote(`Copied blueprint (${grid.count} blocks)`);
    } catch {
      setNote("Clipboard blocked here.");
    }
  };

  return (
    <div style={css.root}>
      <div style={css.head}>
        <span style={css.title}>{name}</span>
        <span style={css.dim}>
          {size[0]} × {size[1]} × {size[2]} (W × H × L) · {grid?.count ?? 0} blocks
          {grid?.partCount ? ` · ${grid.partCount} microblocks` : ""}
        </span>
      </div>
      <StructureContext.Provider value={collector.current}>{children}</StructureContext.Provider>
      {grid && <Viewer grid={grid} maxY={maxY} height={viewHeight} showGrid={gridShown} />}
      <div style={css.bar}>
        <label style={css.dim}>
          Layers 0–{maxY}{" "}
          <input type="range" min={0} max={size[1] - 1} value={maxY} onChange={e => setMaxY(+e.target.value)} />
        </label>
        <label style={{ ...css.dim, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={gridShown} onChange={e => setGridShown(e.target.checked)} />
          Grid
        </label>
        <button style={css.btn} onClick={() => exportSchematic(false)} title="For Schematica">Export .schematic</button>
        <button style={css.btn2} onClick={() => exportSchematic(true)} title="For WorldEdit: //schem load, //paste (low north-west corner at your feet)">Export WorldEdit</button>
        <button style={css.btn2} onClick={copyBlueprint}>Copy blueprint</button>
        {note && <span style={css.dim}>{note}</span>}
      </div>
      {problems.length > 0 && (
        <div style={css.warn}>
          {problems.slice(0, 12).map(p => <div key={p}>⚠ {p}</div>)}
          {problems.length > 12 && <div>…and {problems.length - 12} more</div>}
        </div>
      )}
      {!hideMaterials && mats.length > 0 && (
        <div style={css.mats}>
          {mats.map(m => (
            <div key={m.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <BlockIcon block={m.icon} />
              <span style={{ minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.count}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={m.shape ? `${m.key} (${m.sawbench ?? "cut at the ArchitectureCraft sawbench"})` : m.microblock ? `${m.key} (Forge Multipart microblock)` : m.key}>{m.display}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
