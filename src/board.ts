import { BuildingDefinition, type Building } from "./gameDefinitions";

export const GRID_RADIUS = 30; // how many rings around center of the field

export type HexCoordinates = {
  q: number;
  r: number;
};

const buildings = initBoard();
type HexLocation = string;

export function getBuildings(): Building[] {
  return [...buildings.values()];
}

export function getBuilding(location: HexCoordinates) {
  return buildings.get(toHexLocation(location));
}

export function setBuilding(location: HexCoordinates, building: Building) {
  buildings.set(toHexLocation(location), building);
}

function toHexLocation(coords: HexCoordinates): HexLocation {
  return `${coords.q},${coords.r}`;
}

function initBoard() {
  const board = new Map<HexLocation, Building>();
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (Math.abs(q + r) <= GRID_RADIUS) {
        board.set(toHexLocation({ q, r }), BuildingDefinition.Forest);
      }
    }
  }
  return board;
}
