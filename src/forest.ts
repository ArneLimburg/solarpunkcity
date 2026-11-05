import type { HexCoordinates } from "./board";

export const TREES_PER_TILE = 5;
export const TREE_RADIUS_FACTOR = 0.7; // share of the hex radius that trees may use
export const MIN_TREE_DISTANCE_FACTOR = 0.3; // share of the hex radius between tree centers
const MAX_ATTEMPTS = 30; // per tree

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
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tileSeed({ q, r }: HexCoordinates): number {
  return (Math.imul(q, 73856093) ^ Math.imul(r, 19349663)) >>> 0;
}

// rotation of a hex tile around the Y axis: a multiple of 60 degrees, so the tile looks the same
export function getTileRotation(coords: HexCoordinates): number {
  return (tileSeed(coords) % 6) * (Math.PI / 3);
}

// random position within the tree area; rejection sampling keeps the distance to the others,
// the last candidate is used if no attempt satisfies it
export function pickTreePosition(
  random: () => number,
  hexRadius: number,
  others: { x: number; z: number }[],
): { x: number; z: number } {
  const minDistance = MIN_TREE_DISTANCE_FACTOR * hexRadius;
  let x = 0;
  let z = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // sqrt for a uniform distribution over the disc
    const distance = Math.sqrt(random()) * TREE_RADIUS_FACTOR * hexRadius;
    const angle = random() * 2 * Math.PI;
    x = Math.cos(angle) * distance;
    z = Math.sin(angle) * distance;
    if (others.every((o) => Math.hypot(o.x - x, o.z - z) >= minDistance)) {
      break;
    }
  }
  return { x, z };
}

// deterministic tree placements of a tile, hexRadius is the hex side length
export function getTreePlacements(
  coords: HexCoordinates,
  hexRadius: number,
): TreePlacement[] {
  const random = createRandom(tileSeed(coords));
  const trees: TreePlacement[] = [];
  for (let i = 0; i < TREES_PER_TILE; i++) {
    const { x, z } = pickTreePosition(random, hexRadius, trees);
    trees.push({
      x,
      z,
      rotation: random() * 2 * Math.PI,
      scale: 0.8 + random() * 0.4,
      kind: random() < 0.5 ? "conifer" : "deciduous",
    });
  }
  return trees;
}
