import { expect, test, vi } from "vitest";

vi.mock("@babylonjs/core", () => ({ Vector3: class {} }));

import { buildGeometry } from "../src/farmGeometry";
import {
  HUB_HEIGHT,
  ROTOR_RADIUS,
  ROTOR_RPM,
  WIND_DIRECTION,
  getHubPosition,
  getRotorAngle,
  getRotorMatrix,
  getRotorStartAngle,
  getWindTurbineLayout,
  getWindTurbineRotorLayout,
} from "../src/windTurbine";

const A = { q: 0, r: 0 };
const B = { q: 3, r: -2 };

test("the layout has a foundation, a tapering wooden tower and a nacelle", () => {
  const parts = getWindTurbineLayout(1);
  expect(parts[0]).toMatchObject({ shape: "box", color: "concrete" });
  expect(parts[0].y).toBeGreaterThan(0);
  const tower = parts.filter((p) => p.color === "wood");
  expect(tower.length).toBeGreaterThan(1);
  for (let i = 1; i < tower.length; i++) {
    expect(tower[i].width).toBeLessThan(tower[i - 1].width);
  }
  const nacelle = parts.find((p) => p.color === "white")!;
  expect(nacelle.y).toBeCloseTo(HUB_HEIGHT);
  const top = Math.max(...tower.map((p) => p.y + p.height / 2));
  expect(top).toBeLessThanOrEqual(nacelle.y);
});

test("the hub is at about 1.7 times the hex size and the layout scales", () => {
  expect(getHubPosition(1).y).toBeCloseTo(1.7);
  expect(getHubPosition(2).y).toBeCloseTo(3.4);
  const [small, big] = [1, 2].map((size) => getWindTurbineLayout(size));
  expect(big[1].height).toBeCloseTo(small[1].height * 2);
  const nacelle = (parts: ReturnType<typeof getWindTurbineLayout>) =>
    parts.find((p) => p.color === "white")!;
  expect(nacelle(big).y).toBeCloseTo(nacelle(small).y * 2);
});

test("the rotor has a hub and three blades within the radius, in the plane across the wind", () => {
  for (const size of [1, 2]) {
    const parts = getWindTurbineRotorLayout(size);
    const blades = parts.filter((p) => p.shape === "box");
    expect(blades).toHaveLength(3);
    expect(parts.filter((p) => p.shape === "sphere")).toHaveLength(1);
    const hub = getHubPosition(size);
    for (const blade of blades) {
      // the blade is thin along X, its extent runs across the wind
      expect(blade.width).toBeLessThan(blade.depth);
      expect(blade.x).toBeCloseTo(hub.x);
      expect(blade.rotation).toBe(0);
      const tip = Math.hypot(
        Math.hypot(blade.y - hub.y, blade.z - hub.z) + blade.height / 2,
        blade.depth / 2,
      );
      expect(tip).toBeLessThanOrEqual(ROTOR_RADIUS * size);
    }
    // the blades are 120 degrees apart
    const angles = blades.map((blade) => blade.tilt);
    expect(angles[1] - angles[0]).toBeCloseTo((2 * Math.PI) / 3);
    expect(angles[2] - angles[1]).toBeCloseTo((2 * Math.PI) / 3);
  }
});

test("the wind blows along +X and the rotor axis follows it", () => {
  expect(WIND_DIRECTION).toEqual({ x: 1, z: 0 });
  // the matrix keeps the X axis: the rotor turns around X
  const matrix = getRotorMatrix({ x: 5, z: 7 }, 1, 1);
  expect(matrix.slice(0, 4)).toEqual([1, 0, 0, 0]);
  expect([matrix[4], matrix[8]]).toEqual([0, 0]);
});

test("rotors on different tiles start at different angles, deterministically", () => {
  expect(getRotorStartAngle(A)).toBe(getRotorStartAngle({ ...A }));
  expect(getRotorStartAngle(A)).not.toBe(getRotorStartAngle(B));
  for (const tile of [A, B, { q: -9, r: -8 }]) {
    const angle = getRotorStartAngle(tile);
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(2 * Math.PI);
  }
  expect(getRotorAngle(A, 0)).not.toBe(getRotorAngle(B, 0));
  expect(getRotorAngle(A, 10)).not.toBe(getRotorAngle(B, 10));
});

test("the rotor turns 30 rpm in real time", () => {
  expect(ROTOR_RPM).toBe(30);
  // a half turn takes a second
  const start = getRotorAngle(B, 0);
  const later = getRotorAngle(B, 1);
  expect((later - start + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(Math.PI);
  // a full turn takes two seconds
  expect(getRotorAngle(B, 2)).toBeCloseTo(start);
  // another speed
  const quarter = getRotorAngle(A, 1, 15);
  expect(quarter).toBeCloseTo(getRotorStartAngle(A) + Math.PI / 2);
  expect(getRotorAngle(A, 123.4)).toBeLessThan(2 * Math.PI);
});

test("the rotor matrix turns around the hub axis and moves to the tile", () => {
  const hub = getHubPosition(1);
  const apply = (matrix: number[], [x, y, z]: number[]) => [
    x * matrix[0] + y * matrix[4] + z * matrix[8] + matrix[12],
    x * matrix[1] + y * matrix[5] + z * matrix[9] + matrix[13],
    x * matrix[2] + y * matrix[6] + z * matrix[10] + matrix[14],
  ];
  for (const angle of [0, 0.7, 2.5]) {
    const matrix = getRotorMatrix({ x: 5, z: 7 }, angle, 1);
    expect(matrix).toHaveLength(16);
    // the hub stays on the axis above the tile
    const moved = apply(matrix, [hub.x, hub.y, hub.z]);
    expect(moved[0]).toBeCloseTo(5 + hub.x);
    expect(moved[1]).toBeCloseTo(0.1 + hub.y);
    expect(moved[2]).toBeCloseTo(7);
    // a blade tip stays at its distance from the axis
    const tip = apply(matrix, [hub.x, hub.y + 0.5, hub.z]);
    expect(Math.hypot(tip[1] - 0.1 - hub.y, tip[2] - 7)).toBeCloseTo(0.5);
  }
  // no rotation: only the move
  const rest = apply(getRotorMatrix({ x: 5, z: 7 }, 0, 1), [1, 2, 3]);
  expect(rest).toEqual([6, 2.1, 10]);
});

test("the model stays below the triangle budget", () => {
  const triangles =
    (buildGeometry(getWindTurbineLayout(1)).indices.length +
      buildGeometry(getWindTurbineRotorLayout(1)).indices.length) /
    3;
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(1000);
});
