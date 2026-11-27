import { expect, test } from "vitest";
import {
  BOARD_EDGE,
  CAMERA_MAX_DISTANCE,
  clampCameraTarget,
  MAX_CAMERA_BETA,
  maxCameraBeta,
  MIN_CAMERA_HEIGHT,
} from "../src/cameraLimits";
import { TILE_TOP } from "../src/hexGeometry";

test("the board edge is about 52", () => {
  expect(BOARD_EDGE).toBeCloseTo(51.96, 2);
});

test("a target inside the limit is unchanged", () => {
  expect(clampCameraTarget({ x: 10, y: 0, z: -20 }, 30)).toEqual({
    x: 10,
    y: TILE_TOP,
    z: -20,
  });
});

test("a target beyond the board edge is clamped keeping its direction", () => {
  const result = clampCameraTarget({ x: 300, y: 0, z: 400 }, 10);
  expect(Math.hypot(result.x, result.z)).toBeCloseTo(BOARD_EDGE);
  expect(result.x / result.z).toBeCloseTo(0.75);
});

test("at radius 90 the distance is clamped to 5", () => {
  const result = clampCameraTarget({ x: 40, y: 0, z: 0 }, 90);
  expect(result).toEqual({ x: 5, y: TILE_TOP, z: 0 });
});

test("the target y is set to the tile top", () => {
  expect(clampCameraTarget({ x: 1, y: 7, z: 1 }, 30).y).toBe(TILE_TOP);
});

test("the target at the center stays at the center", () => {
  expect(clampCameraTarget({ x: 0, y: TILE_TOP, z: 0 }, 90)).toEqual({
    x: 0,
    y: TILE_TOP,
    z: 0,
  });
});

test("the maximum beta at the closest zoom is acos(0.25)", () => {
  expect(maxCameraBeta(2)).toBeCloseTo(Math.acos(0.25));
});

test("the maximum beta at radius 30 is the global limit", () => {
  expect(maxCameraBeta(30)).toBe(MAX_CAMERA_BETA);
});

test("the camera stays at least MIN_CAMERA_HEIGHT above its target", () => {
  for (let radius = 2; radius <= 90; radius += 0.5) {
    expect(radius * Math.cos(maxCameraBeta(radius))).toBeGreaterThanOrEqual(
      MIN_CAMERA_HEIGHT - 1e-9,
    );
  }
});

test("the camera position is at most 95 units from the center", () => {
  const targets = [
    { x: 0, y: 0, z: 0 },
    { x: 500, y: 0, z: 0 },
    { x: -300, y: 4, z: 300 },
    { x: 20, y: 0, z: -30 },
  ];
  for (const radius of [2, 30, 60, 90]) {
    for (const target of targets) {
      const t = clampCameraTarget(target, radius);
      // worst case: the camera sits at distance `radius` horizontally away from the center
      const distance = Math.hypot(Math.hypot(t.x, t.z) + radius, 0);
      expect(distance).toBeLessThanOrEqual(CAMERA_MAX_DISTANCE + 1e-9);
    }
  }
});
