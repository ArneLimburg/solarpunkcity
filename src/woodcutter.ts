import { getBuilding, type HexCoordinates, type PlacedBuilding } from "./board";
import { hexDistance } from "./settlers";

// how far a woodcutter reaches, in hexes from its center
export const HARVEST_RADIUS = 3;
// wood per week and worker, per eligible tile and at most per woodcutter
export const WOOD_PER_WORKER = 2;
export const WOOD_PER_TILE = 0.5;
export const MAX_WOOD = 4;

const key = ({ q, r }: HexCoordinates) => `${q},${r}`;

// the forest tiles each woodcutter harvests: forest tiles within reach, never
// its own tile; a tile in reach of several woodcutters belongs to the nearest
// one, the older one (placement order) on a tie; the result is in placement
// order
export function assignHarvestTiles(
  woodcutters: PlacedBuilding[],
): Map<PlacedBuilding, HexCoordinates[]> {
  const owners = new Map<
    string,
    { woodcutter: PlacedBuilding; distance: number; tile: HexCoordinates }
  >();
  const ordered = [...woodcutters].sort((a, b) => a.sequence - b.sequence);
  for (const woodcutter of ordered) {
    const { q, r } = woodcutter.center;
    for (let dq = -HARVEST_RADIUS; dq <= HARVEST_RADIUS; dq++) {
      for (let dr = -HARVEST_RADIUS; dr <= HARVEST_RADIUS; dr++) {
        const tile = { q: q + dq, r: r + dr };
        const distance = hexDistance(tile, woodcutter.center);
        if (
          distance === 0 ||
          distance > HARVEST_RADIUS ||
          getBuilding(tile)?.type !== "Forest"
        ) {
          continue;
        }
        const owner = owners.get(key(tile));
        if (!owner || distance < owner.distance) {
          owners.set(key(tile), { woodcutter, distance, tile });
        }
      }
    }
  }
  const assigned = new Map<PlacedBuilding, HexCoordinates[]>(
    ordered.map((woodcutter) => [woodcutter, []]),
  );
  for (const { woodcutter, tile } of owners.values()) {
    assigned.get(woodcutter)!.push(tile);
  }
  return assigned;
}

// the wood a woodcutter harvests in a week
export function getWoodOutput(
  tiles: number,
  freeWorkers: number,
  freeCapacity: number,
): number {
  return Math.max(
    0,
    Math.min(
      MAX_WOOD,
      WOOD_PER_WORKER * freeWorkers,
      WOOD_PER_TILE * tiles,
      freeCapacity,
    ),
  );
}
