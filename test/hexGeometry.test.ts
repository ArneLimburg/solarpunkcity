import { expect, test, vi } from "vitest";

vi.mock("@babylonjs/core", () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { Vector3 };
});

import { GRID_RADIUS, isOnBoard } from "../src/board";
import {
  HEX_SIZE,
  createHexCorners,
  hexToPixel,
  pixelToHex,
  tileKey,
} from "../src/hexGeometry";

test("tileKey joins q and r", () => {
  expect(tileKey({ q: -2, r: 3 })).toBe("-2,3");
});

test("the hex corners form a flat-top hexagon", () => {
  const corners = createHexCorners();
  expect(corners).toHaveLength(6);
  for (const corner of corners) {
    expect(Math.hypot(corner.x, corner.z)).toBeCloseTo(HEX_SIZE);
    expect(corner.y).toBe(0);
  }
  expect(corners[0].x).toBeCloseTo(Math.cos(Math.PI / 6));
});

test("pixelToHex inverts hexToPixel for all board tiles", () => {
  let count = 0;
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (!isOnBoard({ q, r })) continue;
      count++;
      const position = hexToPixel(q, r);
      expect(pixelToHex(position)).toEqual({ q, r });
    }
  }
  expect(count).toBeGreaterThan(0);
});

// pixel position of a fractional cube coordinate (x = q, z = r)
const fromCube = (xCube: number, zCube: number) => ({
  x: (xCube + zCube / 3) * Math.sqrt(3) * HEX_SIZE,
  z: 1.5 * zCube * HEX_SIZE,
});

// "+ 0" turns -0 into 0
const hexAt = (xCube: number, zCube: number) => {
  const { q, r } = pixelToHex(fromCube(xCube, zCube));
  return { q: q + 0, r: r + 0 };
};

test("cube rounding corrects the coordinate with the largest rounding error", () => {
  // x has the largest error: x is recomputed from y and z
  expect(hexAt(0.45, -0.4)).toEqual({ q: 0, r: 0 });
  // y has the largest error: y is recomputed from x and z
  expect(hexAt(0.1, 0.1)).toEqual({ q: 0, r: 0 });
  // z has the largest error: z is recomputed from x and y
  expect(hexAt(0.1, 0.45)).toEqual({ q: 0, r: 0 });
});

test("hexToPixel places neighbors one hex apart", () => {
  const origin = hexToPixel(0, 0);
  const east = hexToPixel(1, 0);
  expect(origin.x).toBe(0);
  expect(Math.hypot(east.x, east.z)).toBeCloseTo(Math.sqrt(3) * HEX_SIZE);
});
