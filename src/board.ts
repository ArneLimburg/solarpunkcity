import { BuildingDefinition, type Building } from "./gameDefinitions";

export const GRID_RADIUS = 30; // how many rings around center of the field

export type HexCoordinates = {
  q: number;
  r: number;
};

// a building that was placed on the board, shared by all tiles of its footprint;
// as long as remainingWork is set it is a construction site
export type PlacedBuilding = {
  building: Building;
  center: HexCoordinates;
  remainingWork?: number;
  sequence: number; // placement order, oldest first
};

let nextSequence = 0;
const tiles = initBoard();
type HexLocation = string;

function uniquePlaced(): PlacedBuilding[] {
  return [...new Set(tiles.values())];
}

// every finished building once, as placed (for production and housing)
export function getPlacedBuildings(): PlacedBuilding[] {
  return uniquePlaced().filter((placed) => placed.remainingWork === undefined);
}

// every finished building once (for production and housing)
export function getBuildings(): Building[] {
  return getPlacedBuildings().map((placed) => placed.building);
}

// the placed building (with its center) that covers a tile
export function getPlacedBuilding(
  location: HexCoordinates,
): PlacedBuilding | undefined {
  return tiles.get(toHexLocation(location));
}

// the construction sites in placement order (oldest first)
export function getConstructionSites(): PlacedBuilding[] {
  return uniquePlaced()
    .filter((placed) => placed.remainingWork !== undefined)
    .sort((a, b) => a.sequence - b.sequence);
}

// reduces the remaining work of a site; it stays a site until completeSites
export function workOnSite(site: PlacedBuilding, workers: number) {
  site.remainingWork = site.remainingWork! - workers;
}

// turns the sites without remaining work into finished buildings
export function completeSites(): PlacedBuilding[] {
  const completed = getConstructionSites().filter(
    (site) => site.remainingWork! <= 0,
  );
  for (const site of completed) {
    delete site.remainingWork;
  }
  return completed;
}

// the building of every tile (for per-tile values such as ecology); the tiles
// of a construction site count with ecology 0
export function getTileBuildings(): Building[] {
  return [...tiles.values()].map((placed) =>
    placed.remainingWork === undefined
      ? placed.building
      : { ...placed.building, ecology: 0 },
  );
}

export function getBuilding(location: HexCoordinates) {
  return tiles.get(toHexLocation(location))?.building;
}

export function isUnderConstruction(location: HexCoordinates): boolean {
  return tiles.get(toHexLocation(location))?.remainingWork !== undefined;
}

// places a building on a single tile
export function setBuilding(location: HexCoordinates, building: Building) {
  tiles.set(toHexLocation(location), {
    building,
    center: location,
    sequence: nextSequence++,
  });
}

// places a building on its whole footprint around the center; with
// remainingWork > 0 it is a construction site
export function placeBuilding(
  center: HexCoordinates,
  building: Building,
  remainingWork = 0,
) {
  const placed: PlacedBuilding = {
    building,
    center,
    sequence: nextSequence++,
    ...(remainingWork > 0 && { remainingWork }),
  };
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
          sequence: nextSequence++,
        });
      }
    }
  }
  return board;
}
