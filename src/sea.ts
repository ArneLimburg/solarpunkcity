import type { HexCoordinates } from "./board";
import { HEX_SIZE, TILE_TOP, WATER_DEPTH, hexToPixel } from "./hexGeometry";

export type Point = { x: number; z: number };
// a convex polygon in the xz plane
export type Polygon = Point[];

export const SEA_OUTER_DISTANCE = 100; // from the board centre (the skybox edge)
export const BEACH_WIDTH = 1.5; // width of the side beaches and the beach in front of the tiles
export const BEACH_Y = TILE_TOP - 0.01; // just below the top of the land tiles
export const SEA_Y = TILE_TOP - WATER_DEPTH; // the water surface of the river

export type SeaSector = {
  // unit directions of the sector boundaries from the board centre
  left: Point;
  right: Point;
};

// the 60° sector from the centre through the centres of the corner tiles (-R, R) and (0, R)
export function getSeaSector(radius: number): SeaSector {
  const unit = (coords: HexCoordinates): Point => {
    const { x, z } = hexToPixel(coords.q, coords.r);
    const length = Math.hypot(x, z);
    return { x: x / length, z: z / length };
  };
  return {
    left: unit({ q: -radius, r: radius }),
    right: unit({ q: 0, r: radius }),
  };
}

// z of the centres of the sea edge row
export const getEdgeRowZ = (radius: number) => hexToPixel(0, radius).z;

// z of the straight coastline, beyond the outermost tile corners
export const getCoastZ = (radius: number) =>
  getEdgeRowZ(radius) + HEX_SIZE + BEACH_WIDTH;

// z of the outer end of the sea (the boundary points lie at SEA_OUTER_DISTANCE)
export const getOuterZ = (radius: number) =>
  SEA_OUTER_DISTANCE * getSeaSector(radius).left.z;

// x of a sector boundary at the given z
const boundaryX = (direction: Point, z: number) =>
  (direction.x / direction.z) * z;

// width of the water channel of the river mouth
export const getChannelWidth = () => Math.sqrt(3) * HEX_SIZE;

// the last tile of the river course lies on the sea edge row
function getMouthX(course: HexCoordinates[]) {
  const last = course[course.length - 1];
  return hexToPixel(last.q, last.r).x;
}

// the beach: in front of the edge row (with a gap at the river mouth) and a strip along each
// sector boundary on the sea side
export function getBeachPolygons(
  radius: number,
  course: HexCoordinates[],
): Polygon[] {
  const { left, right } = getSeaSector(radius);
  const edge = getEdgeRowZ(radius);
  const coast = getCoastZ(radius);
  const outer = getOuterZ(radius);
  const mouth = getMouthX(course);
  const half = getChannelWidth() / 2;
  // horizontal width of a strip of BEACH_WIDTH measured across a boundary
  const offset = BEACH_WIDTH / left.z;
  return [
    [
      { x: boundaryX(left, edge), z: edge },
      { x: mouth - half, z: edge },
      { x: mouth - half, z: coast },
      { x: boundaryX(left, coast), z: coast },
    ],
    [
      { x: mouth + half, z: edge },
      { x: boundaryX(right, edge), z: edge },
      { x: boundaryX(right, coast), z: coast },
      { x: mouth + half, z: coast },
    ],
    [
      { x: boundaryX(left, coast), z: coast },
      { x: boundaryX(left, coast) + offset, z: coast },
      { x: boundaryX(left, outer) + offset, z: outer },
      { x: boundaryX(left, outer), z: outer },
    ],
    [
      { x: boundaryX(right, coast) - offset, z: coast },
      { x: boundaryX(right, coast), z: coast },
      { x: boundaryX(right, outer), z: outer },
      { x: boundaryX(right, outer) - offset, z: outer },
    ],
  ];
}

// the open water between the side beaches, from the coastline to the outer end
export function getSeaPolygon(radius: number): Polygon {
  const { left, right } = getSeaSector(radius);
  const coast = getCoastZ(radius);
  const outer = getOuterZ(radius);
  const offset = BEACH_WIDTH / left.z;
  return [
    { x: boundaryX(left, coast) + offset, z: coast },
    { x: boundaryX(right, coast) - offset, z: coast },
    { x: boundaryX(right, outer) - offset, z: outer },
    { x: boundaryX(left, outer) + offset, z: outer },
  ];
}

// the water channel of the river mouth, one tile wide, from the last river tile to the coastline
export function getMouthChannel(
  radius: number,
  course: HexCoordinates[],
): Polygon {
  const edge = getEdgeRowZ(radius);
  const coast = getCoastZ(radius);
  const mouth = getMouthX(course);
  const half = getChannelWidth() / 2;
  return [
    { x: mouth - half, z: edge },
    { x: mouth + half, z: edge },
    { x: mouth + half, z: coast },
    { x: mouth - half, z: coast },
  ];
}
