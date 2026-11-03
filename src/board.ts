import { BuildingDefinition, type Building } from "./gameDefinitions";

export const GRID_RADIUS = 30; // how many rings around center of the field

export type HexCoordinates = {
  q: number;
  r: number;
};

// a building that was placed on the board, shared by all tiles of its footprint
type PlacedBuilding = { building: Building; center: HexCoordinates };

const tiles = initBoard();
type HexLocation = string;

// every placed building once (for production and housing)
export function getBuildings(): Building[] {
  return [...new Set(tiles.values())].map((placed) => placed.building);
}

// the building of every tile (for per-tile values such as ecology)
export function getTileBuildings(): Building[] {
  return [...tiles.values()].map((placed) => placed.building);
}

export function getBuilding(location: HexCoordinates) {
  return tiles.get(toHexLocation(location))?.building;
}

// places a building on a single tile
export function setBuilding(location: HexCoordinates, building: Building) {
  tiles.set(toHexLocation(location), { building, center: location });
}

// places a building on its whole footprint around the center
export function placeBuilding(center: HexCoordinates, building: Building) {
  const placed = { building, center };
  for (const tile of getFootprint(center, getFootprintRadius(building.size))) {
    tiles.set(toHexLocation(tile), placed);
  }
}

// footprint radius of the allowed building sizes 1, 7 and 19
export function getFootprintRadius(size: number): number {
  return { 1: 0, 7: 1, 19: 2 }[size]!;
}

// all tiles with a hex distance <= radius from the center (may be off the board)
export function getFootprint(
  center: HexCoordinates,
  radius: number,
): HexCoordinates[] {
  const footprint: HexCoordinates[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = -radius; dr <= radius; dr++) {
      if (Math.abs(dq + dr) <= radius) {
        footprint.push({ q: center.q + dq, r: center.r + dr });
      }
    }
  }
  return footprint;
}

export function isOnBoard(coords: HexCoordinates): boolean {
  return (
    Math.max(
      Math.abs(coords.q),
      Math.abs(coords.r),
      Math.abs(coords.q + coords.r),
    ) <= GRID_RADIUS
  );
}

function toHexLocation(coords: HexCoordinates): HexLocation {
  return `${coords.q},${coords.r}`;
}

function initBoard() {
  const board = new Map<HexLocation, PlacedBuilding>();
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) {
        board.set(toHexLocation({ q, r }), {
          building: BuildingDefinition.Forest,
          center: { q, r },
        });
      }
    }
  }
  return board;
}
