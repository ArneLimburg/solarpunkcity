import { describe, expect, test } from "vitest";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import {
  HEX_SIZE,
  TILE_TOP,
  WATER_DEPTH,
  hexToPixel,
} from "../src/hexGeometry";
import {
  FLAT_DEPTH,
  FOOTHILL_DEPTH,
  INNER_HEIGHT,
  MAX_SNOW_SLOPE,
  RIVER_WATER_HEIGHT,
  ROCK_COLOR,
  SNOW_COLOR,
  SNOW_HEIGHT,
  VALLEY_END_HEIGHT,
  VALLEY_LENGTH,
  createMountainData,
  getMountainHeight,
  getMountainSlope,
  getRiverColor,
} from "../src/mountains";
import { FOREST_FLOOR_COLOR } from "../src/TileRenderer";

const R = GRID_RADIUS;
const course = getRiverCourse(R);
const valleyX = hexToPixel(course[0].q, course[0].r).x;
const edgeZ = -1.5 * R;
const height = (x: number, z: number) => getMountainHeight(x, z, R, course);
// z of a depth behind the tile corners
const zAt = (depth: number) => -(1.5 * R + HEX_SIZE + depth);
const data = createMountainData(R, course);
const vertices = Array.from({ length: data.positions.length / 3 }, (_, i) => {
  const x = data.positions[3 * i];
  const y = data.positions[3 * i + 1];
  const z = data.positions[3 * i + 2];
  return {
    x,
    y,
    z,
    depth: -z - (1.5 * R + HEX_SIZE),
    color: data.colors.slice(4 * i, 4 * i + 3),
  };
});
const close = (actual: number[], expected: readonly number[]) =>
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
// vertices on the valley line
const stream = vertices.filter((v) => v.x === valleyX);
// a sample of the sector in steps of 0.5
const samples: { x: number; z: number }[] = [];
for (let z = edgeZ; z > -100; z -= 0.5) {
  for (let x = -50; x <= 50; x += 0.5) {
    if (Math.hypot(x, z) <= 100) {
      samples.push({ x, z });
    }
  }
}
const inSector = (x: number, z: number) => Math.abs(x) <= -z / Math.sqrt(3);

describe("height", () => {
  test("is deterministic", () => {
    expect(height(3, zAt(40))).toBe(height(3, zAt(40)));
    expect(createMountainData(R, course)).toEqual(data);
  });

  test("is flat just below the tiles in the inner part", () => {
    expect(INNER_HEIGHT).toBeCloseTo(TILE_TOP - 0.01);
    for (const x of [-20, -5, 0, 14, 20]) {
      for (const depth of [-1, 0, 1, FLAT_DEPTH - 0.01]) {
        expect(height(x, zAt(depth))).toBeCloseTo(INNER_HEIGHT);
      }
    }
  });

  test("rises to about 10 in the foothills and stays below 40 everywhere", () => {
    for (const x of [-20, -5, 14, 20]) {
      for (let depth = FLAT_DEPTH; depth <= FOOTHILL_DEPTH; depth += 1) {
        expect(height(x, zAt(depth))).toBeLessThanOrEqual(10.01);
      }
    }
    expect(height(14, zAt(FOOTHILL_DEPTH))).toBeCloseTo(10);
    expect(height(14, zAt(15))).toBeGreaterThan(height(14, zAt(5)));
    const heights = samples.map(({ x, z }) => height(x, z));
    expect(Math.max(...heights)).toBeLessThanOrEqual(40);
    expect(Math.max(...heights)).toBeGreaterThanOrEqual(35);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
  });

  test("has several distinct peaks", () => {
    const peaks = samples.filter(({ x, z }) => height(x, z) > 30);
    const xs = new Set(peaks.map(({ x }) => Math.round(x / 10)));
    expect(xs.size).toBeGreaterThanOrEqual(3);
  });

  test("falls to 0 at the sector boundaries", () => {
    for (const depth of [5, 20, 40, 50]) {
      const z = zAt(depth);
      const edge = -z / Math.sqrt(3);
      expect(height(edge, z)).toBeCloseTo(0);
      expect(height(-edge, z)).toBeCloseTo(0);
      expect(height(edge + 5, z)).toBe(0);
      expect(height(edge - 4, z)).toBeGreaterThan(0);
    }
    expect(height(0, zAt(48))).toBeGreaterThan(35);
  });

  test("flat ground up to the boundary in the inner part", () => {
    const z = zAt(1);
    expect(inSector(25, z)).toBe(true);
    expect(height(25, z)).toBeCloseTo(INNER_HEIGHT);
  });
});

describe("valley", () => {
  test("the valley floor is lower than the relief on both sides", () => {
    for (let along = 4; along <= VALLEY_LENGTH - 1; along += 1) {
      const z = edgeZ - along;
      const floor = height(valleyX, z);
      expect(floor).toBeLessThan(height(valleyX - 10, z));
      expect(floor).toBeLessThan(height(valleyX + 10, z));
    }
  });

  test("the valley floor rises from the water height to about 8", () => {
    expect(RIVER_WATER_HEIGHT).toBeCloseTo(TILE_TOP - WATER_DEPTH);
    // at the board edge (the outer tile corners) the floor is just below the water surface
    expect(height(valleyX, zAt(0))).toBeCloseTo(RIVER_WATER_HEIGHT - 0.01);
    expect(height(valleyX, edgeZ - VALLEY_LENGTH)).toBeCloseTo(
      VALLEY_END_HEIGHT,
    );
    let previous = 0;
    for (let along = 5; along <= VALLEY_LENGTH; along += 5) {
      const floor = height(valleyX, edgeZ - along);
      expect(floor).toBeGreaterThan(previous);
      previous = floor;
    }
  });

  test("the valley floor is as wide as a tile at the edge and narrows", () => {
    const wide = Math.sqrt(3) * HEX_SIZE;
    const at = (along: number, dx: number) =>
      height(valleyX + dx, edgeZ - along);
    // flat floor within the tile width, rising slopes beside it
    expect(at(10, 0)).toBeLessThan(at(10, wide));
    expect(at(25, 0)).toBeLessThan(at(25, 3));
    expect(at(0, wide)).toBeLessThanOrEqual(at(0, 0) + 0.05);
  });

  test("the floor and the mesh stay below the water surface of the first river tile", () => {
    const halfTile = (Math.sqrt(3) / 2) * HEX_SIZE;
    for (let z = edgeZ; z >= edgeZ - HEX_SIZE; z -= 0.1) {
      for (let dx = -halfTile; dx <= halfTile; dx += 0.1) {
        expect(height(valleyX + dx, z)).toBeLessThan(RIVER_WATER_HEIGHT);
      }
    }
    // the grid vertices around the tile, so the interpolated triangles stay below as well
    const around = vertices.filter(
      (v) => Math.abs(v.x - valleyX) < 1.6 && v.z > edgeZ - 1.6,
    );
    expect(around.length).toBeGreaterThanOrEqual(6);
    for (const v of around) expect(v.y).toBeLessThan(RIVER_WATER_HEIGHT);
  });

  test("the valley ends behind its end", () => {
    const end = height(valleyX, edgeZ - VALLEY_LENGTH - 6);
    expect(end).toBeGreaterThan(VALLEY_END_HEIGHT + 1);
  });
});

describe("mesh data", () => {
  test("is a closed set of triangles below the budget", () => {
    expect(data.indices.length % 3).toBe(0);
    expect(data.indices.length / 3).toBeLessThan(4000);
    expect(data.positions.length).toBe(data.normals.length);
    expect(data.colors.length / 4).toBe(data.positions.length / 3);
    expect(Math.max(...data.indices)).toBe(vertices.length - 1);
    for (const v of vertices) expect(Math.hypot(v.x, v.z)).toBeLessThan(100.01);
  });

  test("no triangle lies flat at height 0 (it would fight with the ground)", () => {
    for (let i = 0; i < data.indices.length; i += 3) {
      const heights = data.indices.slice(i, i + 3).map((n) => vertices[n].y);
      expect(Math.max(...heights)).toBeGreaterThan(0);
    }
  });

  test("triangles face up", () => {
    // in a left-handed system the standard cross product of a front face points down
    for (let i = 0; i < data.indices.length; i += 3) {
      const [a, b, c] = data.indices.slice(i, i + 3).map((n) => vertices[n]);
      const normalY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      expect(normalY).toBeLessThan(0);
    }
  });

  test("normals have unit length and point up", () => {
    for (let i = 0; i < vertices.length; i++) {
      const [x, y, z] = data.normals.slice(3 * i, 3 * i + 3);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1);
      expect(y).toBeGreaterThan(0);
    }
  });

  test("the grid spacing is about 1.5 and starts at the edge row", () => {
    const rows = [...new Set(vertices.map((v) => v.z))].sort((a, b) => b - a);
    expect(rows[0]).toBeCloseTo(edgeZ);
    expect(rows[0] - rows[1]).toBeCloseTo(1.5);
  });

  test("the inner part is forest green", () => {
    const inner = vertices.filter(
      (v) => v.depth < FLAT_DEPTH && Math.abs(v.x - valleyX) > 8,
    );
    expect(inner.length).toBeGreaterThan(10);
    for (const v of inner) {
      expect(v.y).toBeCloseTo(INNER_HEIGHT);
      close(v.color, [
        FOREST_FLOOR_COLOR.r,
        FOREST_FLOOR_COLOR.g,
        FOREST_FLOOR_COLOR.b,
      ]);
    }
  });

  test("the foothills are green", () => {
    const foothills = vertices.filter(
      (v) =>
        v.depth > FLAT_DEPTH &&
        v.depth < FOOTHILL_DEPTH &&
        v.y <= 10 &&
        v.x !== valleyX,
    );
    expect(foothills.length).toBeGreaterThan(100);
    for (const v of foothills.filter((v) => v.y < 10.99)) {
      expect(v.color[1]).toBeGreaterThan(v.color[0]);
    }
  });

  test("vertices above 28 are white unless the slope is steep, steep ones are rock", () => {
    const high = vertices.filter((v) => v.y > SNOW_HEIGHT);
    expect(high.length).toBeGreaterThan(5);
    let snow = 0;
    let rock = 0;
    for (const v of high) {
      if (getMountainSlope(v.x, v.z, R, course) <= MAX_SNOW_SLOPE) {
        close(v.color, SNOW_COLOR);
        snow++;
      } else {
        close(v.color, ROCK_COLOR);
        rock++;
      }
    }
    expect(snow).toBeGreaterThan(0);
    expect(rock).toBeGreaterThan(0);
    for (const v of vertices.filter((v) => v.y <= SNOW_HEIGHT)) {
      expect(v.color).not.toEqual([...SNOW_COLOR]);
    }
  });

  test("rock lies between the foothills and the snow", () => {
    const rock = vertices.filter((v) => v.y > 16 && v.y < SNOW_HEIGHT);
    expect(rock.length).toBeGreaterThan(5);
    for (const v of rock) close(v.color, ROCK_COLOR);
  });

  test("the mountain stream along the valley floor has the river colour", () => {
    const course30 = stream.filter(
      (v) => v.depth + HEX_SIZE >= 0 && v.depth + HEX_SIZE <= 25,
    );
    expect(course30.length).toBeGreaterThanOrEqual(15);
    for (const v of course30) close(v.color, getRiverColor());
    // narrowing into the spring
    const spring = stream.find((v) => v.depth + HEX_SIZE > 28)!;
    expect(spring.color[0]).not.toBeCloseTo(getRiverColor()[0]);
    // the other columns are not coloured
    const beside = vertices.filter(
      (v) => v.x !== valleyX && Math.abs(v.x - valleyX) < 2 && v.depth < 20,
    );
    expect(beside.length).toBeGreaterThan(10);
    for (const v of beside) {
      expect(v.color[2]).toBeLessThan(getRiverColor()[2] - 0.2);
    }
  });
});
