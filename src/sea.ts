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

// z of the outer end of the sea: the skybox wall
export const getOuterZ = () => SEA_OUTER_DISTANCE;

// the sea is a semicircle on the skybox wall, tangent to both side beaches
export const SEA_CENTER: Point = { x: 0, z: SEA_OUTER_DISTANCE };
export const SEA_RADIUS =
  SEA_OUTER_DISTANCE * Math.sin(Math.PI / 6) - BEACH_WIDTH;
export const SEA_SEGMENTS = 64;
export const SEA_RINGS = 8;

// x of a sector boundary at the given z
const boundaryX = (direction: Point, z: number) =>
  (direction.x / direction.z) * z;

// point of the semicircle at the given fraction of the radius and segment index
const seaPoint = (fraction: number, segment: number): Point => {
  const angle = (Math.PI * segment) / SEA_SEGMENTS;
  return {
    x: SEA_RADIUS * fraction * Math.cos(angle),
    z: SEA_CENTER.z - SEA_RADIUS * fraction * Math.sin(angle),
  };
};

// the round shore, from x = +radius to x = -radius
const shore = Array.from({ length: SEA_SEGMENTS + 1 }, (_, i) =>
  seaPoint(1, i),
).reverse();

// z of the (polygonal) shore at the given x, -radius <= x <= radius
function shoreZ(x: number) {
  const i = Math.max(
    shore.findIndex((point, index) => index > 0 && point.x >= x),
    1,
  );
  const [a, b] = [shore[i - 1], shore[i]];
  return a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x);
}

// the semicircle as rings of quads (the innermost ring as triangles)
export function getSeaRings(): Polygon[] {
  const polygons: Polygon[] = [];
  for (let ring = 1; ring <= SEA_RINGS; ring++) {
    for (let segment = 0; segment < SEA_SEGMENTS; segment++) {
      const inner = ring - 1;
      const quad = [
        seaPoint(ring / SEA_RINGS, segment),
        seaPoint(ring / SEA_RINGS, segment + 1),
        seaPoint(inner / SEA_RINGS, segment + 1),
        seaPoint(inner / SEA_RINGS, segment),
      ];
      polygons.push(ring === 1 ? quad.slice(0, 3) : quad);
    }
  }
  return polygons;
}

// width of the water channel of the river mouth
export const getChannelWidth = () => Math.sqrt(3) * HEX_SIZE;

// the last tile of the river course lies on the sea edge row
function getMouthX(course: HexCoordinates[]) {
  const last = course[course.length - 1];
  return hexToPixel(last.q, last.r).x;
}

// x range of the water channel of the river mouth
function getChannelRange(course: HexCoordinates[]) {
  const mouth = getMouthX(course);
  const half = getChannelWidth() / 2;
  return { from: mouth - half, to: mouth + half };
}

// x values at which the shore changes direction, plus the extra x values, ascending
const shoreBreaks = (extra: number[]) =>
  [...shore.map((point) => point.x), ...extra].sort((a, b) => a - b);

// the beach: in front of the edge row (with a gap at the river mouth), and everything between the
// coastline, the semicircle and the skybox wall inside the sea sector (without the river mouth)
export function getBeachPolygons(
  radius: number,
  course: HexCoordinates[],
): Polygon[] {
  const { left, right } = getSeaSector(radius);
  const edge = getEdgeRowZ(radius);
  const coast = getCoastZ(radius);
  const outer = getOuterZ();
  const { from, to } = getChannelRange(course);
  const coastLeft = boundaryX(left, coast);
  const coastRight = boundaryX(right, coast);
  // lower end of the beach at x: the coastline, or the sector boundary further out
  const bottom = (x: number) => {
    const side = x < 0 ? left : right;
    return Math.max(coast, x / (side.x / side.z));
  };
  const polygons: Polygon[] = [
    [
      { x: boundaryX(left, edge), z: edge },
      { x: from, z: edge },
      { x: from, z: coast },
      { x: coastLeft, z: coast },
    ],
    [
      { x: to, z: edge },
      { x: boundaryX(right, edge), z: edge },
      { x: coastRight, z: coast },
      { x: to, z: coast },
    ],
  ];
  // vertical slabs between the coastline/sector boundary and the shore, without the channel
  const breaks = shoreBreaks([from, to, coastLeft, coastRight]);
  for (let i = 1; i < breaks.length; i++) {
    const [x0, x1] = [breaks[i - 1], breaks[i]];
    const middle = (x0 + x1) / 2;
    if (middle > from && middle < to) continue;
    polygons.push([
      { x: x0, z: bottom(x0) },
      { x: x1, z: bottom(x1) },
      { x: x1, z: shoreZ(x1) },
      { x: x0, z: shoreZ(x0) },
    ]);
  }
  // the corners between the shore end, the skybox wall and the sector boundaries
  polygons.push(
    [
      { x: -SEA_RADIUS, z: bottom(-SEA_RADIUS) },
      { x: -SEA_RADIUS, z: outer },
      { x: boundaryX(left, outer), z: outer },
    ],
    [
      { x: SEA_RADIUS, z: bottom(SEA_RADIUS) },
      { x: boundaryX(right, outer), z: outer },
      { x: SEA_RADIUS, z: outer },
    ],
  );
  return polygons;
}

// the water channel of the river mouth, one tile wide, from the last river tile to the shore of
// the semicircle
export function getMouthChannel(
  radius: number,
  course: HexCoordinates[],
): Polygon[] {
  const edge = getEdgeRowZ(radius);
  const { from, to } = getChannelRange(course);
  const breaks = [
    from,
    ...shore.map((point) => point.x).filter((x) => x > from && x < to),
    to,
  ].sort((a, b) => a - b);
  const low = Math.min(...breaks.map(shoreZ));
  const polygons: Polygon[] = [
    [
      { x: from, z: edge },
      { x: to, z: edge },
      { x: to, z: low },
      { x: from, z: low },
    ],
  ];
  for (let i = 1; i < breaks.length; i++) {
    const [x0, x1] = [breaks[i - 1], breaks[i]];
    polygons.push([
      { x: x0, z: low },
      { x: x1, z: low },
      { x: x1, z: shoreZ(x1) },
      { x: x0, z: shoreZ(x0) },
    ]);
  }
  return polygons;
}
