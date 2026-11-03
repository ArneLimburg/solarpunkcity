import type { HexCoordinates } from "./board";

export const TREES_PER_TILE = 3;
export const TREE_RADIUS_FACTOR = 0.7; // share of the hex radius that trees may use

export type TreeKind = "conifer" | "deciduous";

export type TreePlacement = {
  // offset from the tile center in scene units
  x: number;
  z: number;
  rotation: number; // around the Y axis, in radians
  scale: number; // uniform, 0.8 .. 1.2
  kind: TreeKind;
};

// small seeded PRNG (mulberry32)
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// deterministic tree placements of a tile, hexRadius is the hex side length
export function getTreePlacements(
  { q, r }: HexCoordinates,
  hexRadius: number,
): TreePlacement[] {
  const random = createRandom(
    (Math.imul(q, 73856093) ^ Math.imul(r, 19349663)) >>> 0,
  );
  const trees: TreePlacement[] = [];
  for (let i = 0; i < TREES_PER_TILE; i++) {
    // sqrt for a uniform distribution over the disc
    const distance = Math.sqrt(random()) * TREE_RADIUS_FACTOR * hexRadius;
    const angle = random() * 2 * Math.PI;
    trees.push({
      x: Math.cos(angle) * distance,
      z: Math.sin(angle) * distance,
      rotation: random() * 2 * Math.PI,
      scale: 0.8 + random() * 0.4,
      kind: random() < 0.5 ? "conifer" : "deciduous",
    });
  }
  return trees;
}
