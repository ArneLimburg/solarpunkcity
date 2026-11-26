import type { HexCoordinates } from "./board";
import { HEX_SIZE, TILE_TOP, WATER_DEPTH, hexToPixel } from "./hexGeometry";
import { FOREST_FLOOR_COLOR, WATER_COLOR } from "./TileRenderer";

// Pure geometry of the mountains beyond the mountain edge (r = -radius) of the board: one
// heightfield over a 60° sector with vertex colours.

export const MOUNTAIN_SPACING = 1.5; // grid spacing in scene units
export const MOUNTAIN_RANGE = 100; // distance from the board center (the skybox edge)
export const FLAT_DEPTH = 2; // the inner part reaches this far behind the tile corners
export const FOOTHILL_DEPTH = 30; // the foothills end here, the high mountains start
export const FOOTHILL_HEIGHT = 10; // height at the end of the foothills
export const SNOW_HEIGHT = 28; // above this height the peaks are white
export const MAX_SNOW_SLOPE = 1.2; // steeper slopes (height per unit) stay rock
export const VALLEY_LENGTH = 30; // length of the river valley behind the board edge
export const VALLEY_END_HEIGHT = 8; // height of the valley floor at its end
// the surface of the river on the board
export const RIVER_WATER_HEIGHT = TILE_TOP - WATER_DEPTH;
export const INNER_HEIGHT = TILE_TOP - 0.01; // just below the land tiles
export const ROCK_COLOR = [0.45, 0.4, 0.35] as const;
export const SNOW_COLOR = [1, 1, 1] as const;

const SLOPE_FADE = 10; // the height falls to 0 over this distance to the sector boundaries
const VALLEY_BLEND = 6; // width of the valley slopes
const STREAM_FADE = 5; // the stream fades into the spring over this length
const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

// peaks of the high mountains: position (x, depth behind the tile corners), height above the
// foothills and width
const PEAKS = [
  { x: 0, d: 48, height: 28, width: 13 },
  { x: -22, d: 44, height: 26, width: 12 },
  { x: 24, d: 46, height: 24, width: 12 },
  { x: -9, d: 38, height: 22, width: 10 },
  { x: 11, d: 37, height: 20, width: 10 },
];

export type MountainData = {
  positions: number[];
  normals: number[];
  colors: number[]; // RGBA per vertex
  indices: number[];
};

type RiverCourse = HexCoordinates[];

function smoothstep(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

// distance behind the outermost tile corners of the mountain edge
function getDepth(z: number, radius: number) {
  return -z - (1.5 * radius + HEX_SIZE);
}

// distance to the nearer sector boundary; negative outside of the sector
function getBoundaryDistance(x: number, z: number) {
  return Math.min(-COS_30 * x - SIN_30 * z, COS_30 * x - SIN_30 * z);
}

// the relief of the unfaded mountains at a depth behind the tile corners
function getRelief(x: number, depth: number) {
  if (depth <= FLAT_DEPTH) return INNER_HEIGHT;
  if (depth <= FOOTHILL_DEPTH) {
    const t = (depth - FLAT_DEPTH) / (FOOTHILL_DEPTH - FLAT_DEPTH);
    return INNER_HEIGHT + (FOOTHILL_HEIGHT - INNER_HEIGHT) * t ** 1.3;
  }
  const ridge = 8 + 4 * Math.sin(0.21 * x + 1) * Math.sin(0.17 * depth);
  const mountain = PEAKS.reduce(
    (highest, peak) =>
      Math.max(
        highest,
        peak.height *
          Math.exp(
            -((x - peak.x) ** 2 + (depth - peak.d) ** 2) / peak.width ** 2,
          ),
      ),
    ridge,
  );
  return FOOTHILL_HEIGHT + smoothstep(FOOTHILL_DEPTH, 42, depth) * mountain;
}

// x of the valley: the first tile of the river course, on the mountain edge
function getValleyX(course: RiverCourse) {
  return hexToPixel(course[0].q, course[0].r).x;
}

// Height of the mountains at a point: deterministic, flat in the inner part, falling to 0 at
// the sector boundaries and lowered into the valley of the river.
export function getMountainHeight(
  x: number,
  z: number,
  radius: number,
  course: RiverCourse,
): number {
  const depth = getDepth(z, radius);
  const fade = smoothstep(0, SLOPE_FADE, getBoundaryDistance(x, z));
  const raised = smoothstep(FLAT_DEPTH, FLAT_DEPTH + 2, depth);
  const height = getRelief(x, depth) * (1 - raised * (1 - fade));

  // the valley starts at the line through the centres of the edge row
  const along = Math.max(0, depth + HEX_SIZE);
  const half =
    ((Math.sqrt(3) / 2) * HEX_SIZE * (VALLEY_LENGTH - along)) / VALLEY_LENGTH;
  const across = Math.abs(x - getValleyX(course));
  const carve =
    (1 -
      smoothstep(Math.max(0, half), Math.max(0, half) + VALLEY_BLEND, across)) *
    (1 - smoothstep(VALLEY_LENGTH, VALLEY_LENGTH + 4, along));
  const floor =
    RIVER_WATER_HEIGHT +
    (VALLEY_END_HEIGHT - RIVER_WATER_HEIGHT) *
      (Math.min(along, VALLEY_LENGTH) / VALLEY_LENGTH) ** 2;
  return Math.min(height, height + (floor - height) * carve);
}

// steepness (height per unit) at a point
export function getMountainSlope(
  x: number,
  z: number,
  radius: number,
  course: RiverCourse,
): number {
  const e = MOUNTAIN_SPACING / 3;
  const gradient = getGradient(x, z, e, radius, course);
  return Math.hypot(gradient.x, gradient.z);
}

function getGradient(
  x: number,
  z: number,
  e: number,
  radius: number,
  course: RiverCourse,
) {
  const h = (dx: number, dz: number) =>
    getMountainHeight(x + dx, z + dz, radius, course);
  return {
    x: (h(e, 0) - h(-e, 0)) / (2 * e),
    z: (h(0, e) - h(0, -e)) / (2 * e),
  };
}

function mix(a: readonly number[], b: readonly number[], t: number) {
  return a.map((value, i) => value + (b[i] - value) * t);
}

// the colour of a point: green foothills, rock above, snow on the peaks unless it is steep
function getTerrainColor(height: number, slope: number) {
  const green = [
    FOREST_FLOOR_COLOR.r,
    FOREST_FLOOR_COLOR.g,
    FOREST_FLOOR_COLOR.b,
  ];
  if (height > SNOW_HEIGHT && slope <= MAX_SNOW_SLOPE) return [...SNOW_COLOR];
  return mix(green, ROCK_COLOR, smoothstep(11, 15, height));
}

export function getRiverColor() {
  return [WATER_COLOR.r, WATER_COLOR.g, WATER_COLOR.b];
}

// Builds the heightfield: a grid aligned to the valley, every cell of which touches the sector
// and lies within range of the board center.
export function createMountainData(
  radius: number,
  course: RiverCourse,
): MountainData {
  const valleyX = getValleyX(course);
  const edgeZ = -1.5 * radius;
  const columns = Math.ceil(MOUNTAIN_RANGE / MOUNTAIN_SPACING) + 1;
  const rows = Math.ceil((MOUNTAIN_RANGE - 1.5 * radius) / MOUNTAIN_SPACING);
  const point = (column: number, row: number) => ({
    x: valleyX + column * MOUNTAIN_SPACING,
    z: edgeZ - row * MOUNTAIN_SPACING,
  });

  const data: MountainData = {
    positions: [],
    normals: [],
    colors: [],
    indices: [],
  };
  const vertices = new Map<string, number>();
  const vertexOf = (column: number, row: number) => {
    const key = `${column},${row}`;
    let index = vertices.get(key);
    if (index === undefined) {
      index = vertices.size;
      vertices.set(key, index);
      const { x, z } = point(column, row);
      const height = getMountainHeight(x, z, radius, course);
      const gradient = getGradient(x, z, MOUNTAIN_SPACING / 3, radius, course);
      const length = Math.hypot(gradient.x, gradient.z, 1);
      data.positions.push(x, height, z);
      data.normals.push(-gradient.x / length, 1 / length, -gradient.z / length);
      let color = getTerrainColor(height, Math.hypot(gradient.x, gradient.z));
      if (column === 0) {
        // the mountain stream follows the valley floor and ends in a spring
        const along = -z - 1.5 * radius;
        const stream = Math.min(1, (VALLEY_LENGTH - along) / STREAM_FADE);
        if (stream > 0) color = mix(color, getRiverColor(), stream);
      }
      data.colors.push(...color, 1);
    }
    return index;
  };

  for (let column = -columns; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const corners = [
        point(column, row),
        point(column + 1, row),
        point(column, row + 1),
        point(column + 1, row + 1),
      ];
      const touchesSector = corners.some(
        ({ x, z }) => getBoundaryDistance(x, z) >= 0,
      );
      const inRange = corners.every(
        ({ x, z }) => Math.hypot(x, z) <= MOUNTAIN_RANGE,
      );
      if (touchesSector && inRange) {
        const a = vertexOf(column, row);
        const b = vertexOf(column + 1, row);
        const c = vertexOf(column, row + 1);
        const d = vertexOf(column + 1, row + 1);
        data.indices.push(a, c, b, b, c, d);
      }
    }
  }
  return data;
}
