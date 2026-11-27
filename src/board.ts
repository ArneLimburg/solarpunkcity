import {
  BuildingDefinition,
  BuildingTypes,
  type Building,
} from "./gameDefinitions";

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
  // construction sites only: construction material (wood, or planks for
  // buildings with a plank cost) in the site's own supply and material that is
  // still to be used up (the cost minus the material already used)
  siteWood?: number;
  remainingWood?: number;
  // finished sawmills: own wood supply (missing means empty), at most one
  // week's consumption, lost when the sawmill is replaced
  sawmillWood?: number;
  sequence: number; // placement order, oldest first
};

let nextSequence = 0;
let boardVersion = 0;
const tiles = initBoard();
type HexLocation = string;

// increases whenever buildings are placed or completed (for caches)
export function getBoardVersion(): number {
  return boardVersion;
}

// every tile that holds anything other than forest or water: the camp, buildings
// and construction sites
export function getBuiltTiles(): HexCoordinates[] {
  const built: HexCoordinates[] = [];
  for (const [location, placed] of tiles) {
    const category = BuildingTypes[placed.building.type].category;
    if (category !== "FOREST" && category !== "WATER") {
      const [q, r] = location.split(",").map(Number);
      built.push({ q, r });
    }
  }
  return built;
}

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
    delete site.siteWood;
    delete site.remainingWood;
  }
  boardVersion++;
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
  boardVersion++;
  tiles.set(toHexLocation(location), {
    building,
    center: location,
    sequence: nextSequence++,
  });
}

// places a building on its whole footprint around the center; with
// remainingWork > 0 it is a construction site, which starts with siteWood in
// its supply
export function placeBuilding(
  center: HexCoordinates,
  building: Building,
  remainingWork = 0,
  siteWood = 0,
) {
  boardVersion++;
  const placed: PlacedBuilding = {
    building,
    center,
    sequence: nextSequence++,
    ...(remainingWork > 0 && {
      remainingWork,
      siteWood,
      // no building costs both wood and planks
      remainingWood: building.cost.wood + building.cost.planks,
    }),
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

// the river from the mountain edge (r = -radius) to the sea edge (r = radius): exactly one tile
// per row, each adjacent to the previous one, following a gentle S-curve
export function getRiverCourse(radius: number): HexCoordinates[] {
  const target = (r: number) =>
    4 + 4 * Math.sin((Math.PI * (r + radius)) / radius);
  const u = (tile: HexCoordinates) => tile.q + tile.r / 2;
  let tile: HexCoordinates = {
    q: Math.round(target(-radius) + radius / 2),
    r: -radius,
  };
  const course = [tile];
  for (let r = -radius + 1; r <= radius; r++) {
    const straight = { q: tile.q, r };
    const west = { q: tile.q - 1, r };
    const distance = (candidate: HexCoordinates) =>
      Math.abs(u(candidate) - target(r));
    tile = distance(west) < distance(straight) ? west : straight;
    course.push(tile);
  }
  return course;
}

function initBoard() {
  const board = new Map<HexLocation, PlacedBuilding>();
  const river = new Set(getRiverCourse(GRID_RADIUS).map(toHexLocation));
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r })) {
        board.set(toHexLocation({ q, r }), {
          building: river.has(toHexLocation({ q, r }))
            ? BuildingDefinition.River
            : q === 0 && r === 0
              ? BuildingDefinition.SettlersCamp
              : BuildingDefinition.Forest,
          center: { q, r },
          sequence: nextSequence++,
        });
      }
    }
  }
  return board;
}
