import { expect, test } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { rotateY } from "../src/farms";
import {
  PANEL_TILT,
  SOLAR_FIELD_FACING,
  getSolarFieldLayout,
} from "../src/solarField";

type Point = { x: number; z: number };

// top view corners of a part
function corners(p: ReturnType<typeof getSolarFieldLayout>[number]): Point[] {
  const depth = p.depth * Math.cos(p.tilt);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sz]) => {
    const turned = rotateY(
      { x: (sx * p.width) / 2, z: (sz * depth) / 2 },
      p.rotation,
    );
    return { x: p.x + turned.x, z: p.z + turned.z };
  });
}

// pointy-top hex with side length 1
const inHex = ({ x, z }: Point) =>
  Math.abs(x) <= Math.sqrt(3) / 2 + 1e-9 &&
  Math.abs(x) / Math.sqrt(3) + Math.abs(z) <= 1 + 1e-9;

const panels = () => getSolarFieldLayout(1).filter((p) => p.color === "solar");

test("three panel rows are tilted by 25 degrees and face -Z", () => {
  expect(panels()).toHaveLength(3);
  for (const panel of panels()) {
    expect(Math.abs(PANEL_TILT)).toBeCloseTo((25 * Math.PI) / 180);
    expect(panel.tilt).toBe(PANEL_TILT);
    // the normal of the panel surface points towards -Z and upwards
    const normal = {
      y: Math.cos(panel.tilt),
      z: Math.sin(panel.tilt),
    };
    expect(normal.y).toBeGreaterThan(0);
    expect(Math.sign(normal.z)).toBe(SOLAR_FIELD_FACING.z);
    // lower edge ~0.06, upper edge ~0.15 above the ground
    const half = (panel.depth / 2) * Math.sin(-panel.tilt);
    expect(panel.y - half).toBeCloseTo(0.06, 1);
    expect(panel.y + half).toBeCloseTo(0.15, 1);
  }
});

test("posts stand at both ends and in the middle of every row", () => {
  const posts = getSolarFieldLayout(1).filter((p) => p.color === "wood");
  expect(posts).toHaveLength(9);
  for (const panel of panels()) {
    const own = posts.filter((p) => p.z === panel.z);
    expect(own.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...own.map((p) => p.x))).toBeLessThan(0);
    expect(Math.max(...own.map((p) => p.x))).toBeGreaterThan(0);
    expect(own.some((p) => p.x === 0)).toBe(true);
  }
});

test("there is a light grey inverter box at the end of one row", () => {
  const inverters = getSolarFieldLayout(1).filter(
    (p) => p.color === "concrete",
  );
  expect(inverters).toHaveLength(1);
  expect(inverters[0].width).toBeLessThan(0.2);
});

test("every part lies within the hex in top view", () => {
  for (const p of getSolarFieldLayout(1)) {
    for (const corner of corners(p)) {
      expect(inHex(corner)).toBe(true);
    }
  }
});

test("the rows do not overlap in top view and leave a gap of at least a row", () => {
  const rows = panels()
    .map((p) => ({ z: p.z, depth: p.depth * Math.cos(p.tilt) }))
    .sort((a, b) => a.z - b.z);
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].z - rows[i - 1].z - rows[i].depth;
    expect(gap).toBeGreaterThanOrEqual(rows[i].depth);
  }
});

test("the model is within the triangle budget and uses one opaque mesh", () => {
  const parts = getSolarFieldLayout(1);
  expect(parts.map((p) => p.color)).not.toContain("glass");
  const triangles = buildGeometry(parts).indices.length / 3;
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(1000);
});

test("the layout scales with the hex size", () => {
  const small = getSolarFieldLayout(1);
  const large = getSolarFieldLayout(2);
  expect(large[0].width).toBe(small[0].width * 2);
  expect(large[0].z).toBe(small[0].z * 2);
});
