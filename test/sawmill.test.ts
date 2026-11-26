import { expect, test } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";
import { getSawmillLayout } from "../src/sawmill";

test("the sawmill has a non-empty, deterministic layout", () => {
  const layout = getSawmillLayout(1);
  expect(layout.length).toBeGreaterThan(0);
  expect(getSawmillLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("six posts carry a gable roof of dark planks", () => {
  const layout = getSawmillLayout(1);
  const posts = layout.filter(
    (part) =>
      part.shape === "box" && part.color === "wood" && part.height > 0.2,
  );
  expect(posts).toHaveLength(6);
  const roof = layout.filter((part) => part.shape === "prism");
  expect(roof).toHaveLength(1);
  expect(roof[0].color).toBe("darkWood");
  // about 12 x 6 m, a hex side being 18 m
  expect(roof[0].width).toBeGreaterThan(0.6);
  expect(roof[0].depth).toBeLessThan(0.45);
  const postTop = Math.max(...posts.map((p) => p.y + p.height / 2));
  expect(roof[0].y - roof[0].height / 2).toBeCloseTo(postTop);
});

test("a saw bench with a log, a plank stack of 3 layers and a pile of 4 logs", () => {
  const layout = getSawmillLayout(1);
  const logs = layout.filter((part) => part.shape === "log");
  expect(logs).toHaveLength(5); // one on the bench, four in the pile
  // the log on the bench lies above the table top
  const bench = layout.find(
    (part) => part.color === "wood" && part.width > 0.5 && part.height < 0.05,
  )!;
  const onBench = logs.find((log) => Math.abs(log.z) < 0.01)!;
  expect(onBench.y).toBeGreaterThan(bench.y);
  const planks = layout.filter((part) => part.color === "plank");
  expect(planks).toHaveLength(3);
  expect(new Set(planks.map((p) => p.y)).size).toBe(3);
});

test("the ground has light sawdust patches and no trees", () => {
  const layout = getSawmillLayout(1);
  const patches = layout.filter((part) => part.color === "sawdust");
  expect(patches.length).toBeGreaterThan(0);
  expect(layout.some((part) => part.color === "plant")).toBe(false);
  expect(layout.some((part) => part.shape === "sphere")).toBe(false);
});

test("no part leaves the hex", () => {
  for (const part of getSawmillLayout(1)) {
    for (const [sx, sz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const corner = rotateY(
        { x: (sx * part.width) / 2, z: (sz * part.depth) / 2 },
        part.rotation,
      );
      expect(Math.hypot(part.x + corner.x, part.z + corner.z)).toBeLessThan(
        0.8,
      );
    }
  }
});

test("the geometry stays below 1,000 triangles and the logs have 6 segments", () => {
  const layout = getSawmillLayout(1);
  expect(buildGeometry(layout).indices.length / 3).toBeLessThan(1000);
  const [log] = layout.filter((part) => part.shape === "log");
  // 6 sides with 4 triangles each
  expect(buildGeometry([log]).indices.length / 3).toBe(24);
});

test("the layout scales with the hex size", () => {
  const small = getSawmillLayout(1);
  getSawmillLayout(2).forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.z).toBeCloseTo(small[i].z * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
    expect(part.depth).toBeCloseTo(small[i].depth * 2);
  });
});
