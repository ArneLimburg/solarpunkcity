import { expect, test } from "vitest";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import { HEX_SIZE, hexToPixel } from "../src/hexGeometry";
import {
  BEACH_WIDTH,
  SEA_OUTER_DISTANCE,
  getBeachPolygons,
  getChannelWidth,
  getCoastZ,
  getEdgeRowZ,
  getMouthChannel,
  getOuterZ,
  getSeaPolygon,
  getSeaSector,
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

test("the sea ends at a distance of 100 from the centre", () => {
  const { left, right } = getSeaSector(R);
  const outer = getOuterZ(R);
  expect(outer).toBeCloseTo(SEA_OUTER_DISTANCE * left.z);
  const sea = getSeaPolygon(R);
  expect(zs(sea)).toEqual([getCoastZ(R), getCoastZ(R), outer, outer]);
  // the boundary points of the outer end are 100 away
  const strips = getBeachPolygons(R, course).slice(2);
  expect(Math.hypot(strips[0][3].x, strips[0][3].z)).toBeCloseTo(100);
  expect(Math.hypot(strips[1][2].x, strips[1][2].z)).toBeCloseTo(100);
  expect(strips[0][3].x).toBeCloseTo(SEA_OUTER_DISTANCE * left.x);
  expect(strips[1][2].x).toBeCloseTo(SEA_OUTER_DISTANCE * right.x);
});

test("the side beaches are 1.5 wide on the sea side of the boundaries", () => {
  const { left, right } = getSeaSector(R);
  const [leftStrip, rightStrip] = getBeachPolygons(R, course).slice(2);
  // perpendicular distance of the inner edge from the boundary line
  const distance = (
    point: { x: number; z: number },
    direction: { x: number; z: number },
  ) => Math.abs(point.x * direction.z - point.z * direction.x);
  expect(distance(leftStrip[1], left)).toBeCloseTo(BEACH_WIDTH);
  expect(distance(leftStrip[2], left)).toBeCloseTo(BEACH_WIDTH);
  expect(distance(rightStrip[0], right)).toBeCloseTo(BEACH_WIDTH);
  expect(distance(rightStrip[3], right)).toBeCloseTo(BEACH_WIDTH);
  expect(distance(leftStrip[0], left)).toBeCloseTo(0);
  // the strips start at the coastline
  expect(leftStrip[0].z).toBeCloseTo(getCoastZ(R));
  expect(rightStrip[1].z).toBeCloseTo(getCoastZ(R));
  // the water lies between them
  const sea = getSeaPolygon(R);
  expect(sea[0].x).toBeCloseTo(leftStrip[1].x);
  expect(sea[1].x).toBeCloseTo(rightStrip[0].x);
  expect(sea[2].x).toBeCloseTo(rightStrip[3].x);
  expect(sea[3].x).toBeCloseTo(leftStrip[2].x);
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
  const channel = getMouthChannel(R, course);
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
  expect(Math.max(...zs(channel))).toBeCloseTo(getCoastZ(R));
});
