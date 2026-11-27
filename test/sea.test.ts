import { expect, test } from "vitest";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import { HEX_SIZE, hexToPixel } from "../src/hexGeometry";
import {
  BEACH_WIDTH,
  SEA_CENTER,
  SEA_OUTER_DISTANCE,
  SEA_RADIUS,
  SEA_RINGS,
  SEA_SEGMENTS,
  getBeachPolygons,
  getChannelWidth,
  getCoastZ,
  getEdgeRowZ,
  getMouthChannel,
  getOuterZ,
  getSeaRings,
  getSeaSector,
  type Point,
} from "../src/sea";

const R = GRID_RADIUS;
const course = getRiverCourse(R);
const last = course[course.length - 1];
const xs = (points: { x: number }[]) => points.map((p) => p.x);
const zs = (points: { z: number }[]) => points.map((p) => p.z);

test("the sector boundaries run through the corner tiles of the sea edge", () => {
  const { left, right } = getSeaSector(R);
  const corners = [
    { direction: left, tile: hexToPixel(-R, R) },
    { direction: right, tile: hexToPixel(0, R) },
  ];
  for (const { direction, tile } of corners) {
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
    expect(direction.x * tile.z - direction.z * tile.x).toBeCloseTo(0);
    expect(direction.z).toBeGreaterThan(0);
  }
  // 60° apart
  expect(left.x * right.x + left.z * right.z).toBeCloseTo(
    Math.cos(Math.PI / 3),
  );
});

test("the coastline lies beyond the outermost tile corners", () => {
  expect(getEdgeRowZ(R)).toBeCloseTo(1.5 * R);
  expect(getCoastZ(R)).toBeCloseTo(1.5 * R + HEX_SIZE + 1.5);
});

const seaPoints = getSeaRings().flat();

test("the sea ends at the skybox wall", () => {
  expect(getOuterZ()).toBe(SEA_OUTER_DISTANCE);
  expect(Math.max(...zs(seaPoints))).toBeCloseTo(SEA_OUTER_DISTANCE);
});

test("the sea is a semicircle on the wall that bulges towards the board", () => {
  expect(SEA_RADIUS).toBeCloseTo(48.5);
  for (const { x, z } of seaPoints) {
    expect(Math.hypot(x - SEA_CENTER.x, z - SEA_CENTER.z)).toBeLessThanOrEqual(
      SEA_RADIUS + 1e-9,
    );
    expect(z).toBeLessThanOrEqual(SEA_OUTER_DISTANCE + 1e-9);
  }
  const has = (x: number, z: number) =>
    seaPoints.some((p) => Math.hypot(p.x - x, p.z - z) < 1e-9);
  expect(has(48.5, 100)).toBe(true);
  expect(has(-48.5, 100)).toBe(true);
  expect(has(0, 51.5)).toBe(true);
  expect(getSeaRings()).toHaveLength(SEA_SEGMENTS * SEA_RINGS);
});

test("the semicircle keeps the width of a side beach to the sector boundaries", () => {
  const { left, right } = getSeaSector(R);
  const distance = (p: Point, d: Point) => Math.abs(p.x * d.z - p.z * d.x);
  for (const point of seaPoints) {
    expect(distance(point, left)).toBeGreaterThanOrEqual(BEACH_WIDTH - 1e-9);
    expect(distance(point, right)).toBeGreaterThanOrEqual(BEACH_WIDTH - 1e-9);
  }
});

// whether the point lies inside the convex polygon
function inside(point: Point, polygon: Point[]) {
  const signs = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
  });
  return signs.every((s) => s >= 0) || signs.every((s) => s <= 0);
}

test("beach and water cover the sea sector exactly once", () => {
  const { left, right } = getSeaSector(R);
  const water = [...getSeaRings(), ...getMouthChannel(R, course)];
  const beach = getBeachPolygons(R, course);
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const edge = getEdgeRowZ(R);
  let inWater = 0;
  let inBeach = 0;
  for (let i = 0; i < 3000; i++) {
    const z = edge + random() * (SEA_OUTER_DISTANCE - edge);
    const x =
      left.x * (z / left.z) + random() * (right.x - left.x) * (z / left.z);
    const point = { x, z };
    const w = water.filter((polygon) => inside(point, polygon)).length;
    const b = beach.filter((polygon) => inside(point, polygon)).length;
    expect(w + b).toBe(1);
    inWater += w;
    inBeach += b;
  }
  expect(inWater).toBeGreaterThan(0);
  expect(inBeach).toBeGreaterThan(0);
});

test("the mouth channel ends on the semicircle", () => {
  const channel = getMouthChannel(R, course);
  const mouth = hexToPixel(last.q, last.r).x;
  const half = getChannelWidth() / 2;
  // the far end of every channel polygon lies on the shore or touches the water
  const shoreTop = channel.slice(1).flatMap((p) => [p[2], p[3]]);
  for (const { x, z } of shoreTop) {
    expect(x).toBeGreaterThanOrEqual(mouth - half - 1e-9);
    expect(x).toBeLessThanOrEqual(mouth + half + 1e-9);
    // on the circle or on the chord between two shore points
    expect(Math.hypot(x, z - SEA_CENTER.z)).toBeLessThanOrEqual(
      SEA_RADIUS + 1e-9,
    );
    expect(Math.hypot(x, z - SEA_CENTER.z)).toBeGreaterThan(SEA_RADIUS - 0.05);
  }
});

test("the front beach spans from the edge row to the coastline except the river mouth", () => {
  const [frontLeft, frontRight] = getBeachPolygons(R, course);
  const mouth = hexToPixel(last.q, last.r).x;
  const half = getChannelWidth() / 2;
  for (const polygon of [frontLeft, frontRight]) {
    expect(Math.min(...zs(polygon))).toBeCloseTo(1.5 * R);
    expect(Math.max(...zs(polygon))).toBeCloseTo(getCoastZ(R));
  }
  expect(Math.max(...xs(frontLeft))).toBeCloseTo(mouth - half);
  expect(Math.min(...xs(frontRight))).toBeCloseTo(mouth + half);
  // across the whole sector width
  const { left, right } = getSeaSector(R);
  expect(Math.min(...xs(frontLeft))).toBeCloseTo(
    (left.x / left.z) * getCoastZ(R),
  );
  expect(Math.max(...xs(frontRight))).toBeCloseTo(
    (right.x / right.z) * getCoastZ(R),
  );
});

test("the mouth channel is one tile wide and centred on the last river tile", () => {
  const channel = getMouthChannel(R, course).flat();
  const mouth = hexToPixel(last.q, last.r);
  expect(last.r).toBe(R);
  expect(getChannelWidth()).toBeCloseTo(Math.sqrt(3) * HEX_SIZE);
  expect(Math.max(...xs(channel)) - Math.min(...xs(channel))).toBeCloseTo(
    getChannelWidth(),
  );
  expect((Math.max(...xs(channel)) + Math.min(...xs(channel))) / 2).toBeCloseTo(
    mouth.x,
  );
  expect(Math.min(...zs(channel))).toBeCloseTo(mouth.z);
  // it passes the coastline and ends on the semicircle
  expect(Math.max(...zs(channel))).toBeGreaterThan(getCoastZ(R));
  expect(Math.max(...zs(channel))).toBeLessThan(SEA_OUTER_DISTANCE - 40);
});
