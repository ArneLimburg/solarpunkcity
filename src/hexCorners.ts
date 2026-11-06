import { isOnBoard, type HexCoordinates } from "./board";

// share of the hex size that is used as the radius of the rounded corners
export const CORNER_RADIUS_FACTOR = 0.15;
// line segments per rounded corner
export const CORNER_SEGMENTS = 4;

export type Point = { x: number; z: number };

// a corner of a tile; the corners of up to 3 tiles meet at one hex vertex
export type TileCorner = { tile: HexCoordinates; corner: number };

// neighbor tiles in the directions 0°, 60°, … 300° (seen from the tile center)
const NEIGHBORS = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const DEGREE = Math.PI / 180;

// angle of corner i (pointy top), in radians
const cornerAngle = (corner: number) => (60 * corner + 30) * DEGREE;

// the points of the rounded arc that replaces corner i of a hexagon
function roundedCorner(corner: number, size: number): Point[] {
  const radius = CORNER_RADIUS_FACTOR * size;
  const angle = cornerAngle(corner);
  // the arc center lies on the line from the tile center to the corner
  const distance = size - radius / Math.sin(60 * DEGREE);
  const center = {
    x: distance * Math.cos(angle),
    z: distance * Math.sin(angle),
  };
  const points: Point[] = [];
  for (let s = 0; s <= CORNER_SEGMENTS; s++) {
    // the arc turns by 60° and starts perpendicular to the edge of the previous corner
    const arc = angle - 30 * DEGREE + (60 * DEGREE * s) / CORNER_SEGMENTS;
    points.push({
      x: center.x + radius * Math.cos(arc),
      z: center.z + radius * Math.sin(arc),
    });
  }
  return points;
}

// outline of a hex tile with rounded corners, around the tile center
export function createRoundedHexOutline(size: number): Point[] {
  return [0, 1, 2, 3, 4, 5].flatMap((corner) => roundedCorner(corner, size));
}

// The area of a tile between its sharp corner 0 and the rounded corner 0, around the tile center.
// The pieces of the other corners are this piece rotated by getCornerRotation.
export function createCornerPiece(size: number): Point[] {
  const sharp = {
    x: size * Math.cos(cornerAngle(0)),
    z: size * Math.sin(cornerAngle(0)),
  };
  return [...roundedCorner(0, size), sharp];
}

// rotation around the Y axis (Babylon convention) that turns the piece of corner 0 into corner i
export const getCornerRotation = (corner: number) => (-corner * Math.PI) / 3;

// the 6 corners of a tile
export function getTileCorners(tile: HexCoordinates): TileCorner[] {
  return [0, 1, 2, 3, 4, 5].map((corner) => ({ tile, corner }));
}

// All on-board tile corners that meet at the vertex of the given tile corner (including itself
// if the tile is on the board). Corner i of a tile is shared with the neighbors i and i + 1.
export function getVertexCorners({ tile, corner }: TileCorner): TileCorner[] {
  const next = (corner + 1) % 6;
  return [
    { tile, corner },
    {
      tile: {
        q: tile.q + NEIGHBORS[corner].q,
        r: tile.r + NEIGHBORS[corner].r,
      },
      corner: (corner + 2) % 6,
    },
    {
      tile: { q: tile.q + NEIGHBORS[next].q, r: tile.r + NEIGHBORS[next].r },
      corner: (corner + 4) % 6,
    },
  ].filter((shared) => isOnBoard(shared.tile));
}

// The fill of a vertex from the grounds of the on-board tiles that share it (2 or 3 tiles):
// the ground of at least two equal tiles, `mixed` for three different ones, nothing otherwise.
export function getVertexFill<T>(grounds: T[], mixed: T): T | undefined {
  if (grounds.length < 2) return undefined;
  const [a, b, c] = grounds;
  if (a === b) return a;
  if (grounds.length === 2) return undefined;
  if (a === c || b === c) return c;
  return mixed;
}
