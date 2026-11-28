import { describe, expect, test } from "vitest";
import {
  PREVIEW_DISTANCE,
  PREVIEW_MIN_Z,
  createFollow,
  getCameraPosition,
  getPreviewSize,
  normalizeAngle,
  smoothYaw,
} from "../src/settlerPreview";

const target = { x: 1, y: 0.2, z: -3 };

describe("getCameraPosition", () => {
  test("sits behind the target at the fixed distance and 45° above", () => {
    for (const yaw of [0, 1, -2, Math.PI / 2]) {
      const p = getCameraPosition(target, yaw);
      const dx = p.x - target.x;
      const dy = p.y - target.y;
      const dz = p.z - target.z;
      expect(Math.hypot(dx, dy, dz)).toBeCloseTo(PREVIEW_DISTANCE);
      expect(dy).toBeCloseTo(Math.hypot(dx, dz));
      // behind: against the direction the heading looks to
      expect(dx * Math.sin(yaw) + dz * Math.cos(yaw)).toBeLessThan(0);
    }
  });

  test("a heading of 0 looks to +z, so the camera is at smaller z", () => {
    const p = getCameraPosition(target, 0);
    expect(p.x).toBeCloseTo(target.x);
    expect(p.z).toBeCloseTo(target.z - PREVIEW_DISTANCE * Math.SQRT1_2);
  });

  test("the near plane lies 0.25 in front of the figure", () => {
    expect(PREVIEW_MIN_Z).toBeCloseTo(1.75);
  });
});

describe("normalizeAngle", () => {
  test("wraps into (-π, π]", () => {
    expect(normalizeAngle(0.5)).toBeCloseTo(0.5);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(2 * Math.PI + 0.25)).toBeCloseTo(0.25);
    expect(normalizeAngle(-2 * Math.PI - 0.25)).toBeCloseTo(-0.25);
  });
});

describe("smoothYaw", () => {
  test("covers 1 - 1/e of the way in one time constant", () => {
    expect(smoothYaw(0, 1, 0.5)).toBeCloseTo(1 - Math.exp(-1));
  });

  test("stays unchanged when the heading is unchanged", () => {
    expect(smoothYaw(0.7, 0.7, 0.016)).toBeCloseTo(0.7);
  });

  test("takes the shorter way across ±π", () => {
    const next = smoothYaw(Math.PI - 0.1, -Math.PI + 0.1, 0.1);
    expect(Math.abs(next)).toBeGreaterThan(Math.PI - 0.1);
    const back = smoothYaw(-Math.PI + 0.1, Math.PI - 0.1, 0.1);
    expect(Math.abs(back)).toBeGreaterThan(Math.PI - 0.1);
  });

  test("never overshoots, not even after a long frame", () => {
    expect(smoothYaw(0, 1, 100)).toBeCloseTo(1);
    expect(smoothYaw(0, 1, 100)).toBeLessThanOrEqual(1);
    expect(smoothYaw(0, 1, -1)).toBe(0);
  });
});

describe("createFollow", () => {
  test("reset puts the camera directly behind the settler", () => {
    const follow = createFollow();
    follow.reset(2);
    expect(follow.update(2, 0.016, false)).toBeCloseTo(2);
    follow.reset(-1);
    expect(follow.update(-1, 0.016, false)).toBeCloseTo(-1);
  });

  test("trails the heading while walking", () => {
    const follow = createFollow();
    follow.reset(0);
    const yaw = follow.update(1, 0.5, false);
    expect(yaw).toBeCloseTo(1 - Math.exp(-1));
  });

  test("stays where it is while the settler pauses", () => {
    const follow = createFollow();
    follow.reset(0);
    expect(follow.update(1, 0.5, true)).toBe(0);
  });
});

describe("getPreviewSize", () => {
  test("keeps small canvases as they are", () => {
    expect(getPreviewSize(240, 180)).toEqual({ width: 240, height: 180 });
  });

  test("scales big canvases down to 320 × 240 keeping the ratio", () => {
    expect(getPreviewSize(640, 480)).toEqual({ width: 320, height: 240 });
    expect(getPreviewSize(640, 240)).toEqual({ width: 320, height: 120 });
  });

  test("never returns an empty size", () => {
    expect(getPreviewSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});
