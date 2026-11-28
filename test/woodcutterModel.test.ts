import { expect, test } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";
import { getWoodcutterLayout } from "../src/woodcutterModel";

test("the woodcutter has a non-empty, deterministic layout", () => {
  const layout = getWoodcutterLayout(1);
  expect(layout.length).toBeGreaterThan(0);
  expect(getWoodcutterLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("four posts carry a sloped roof of dark planks", () => {
  const layout = getWoodcutterLayout(1);
  const posts = layout.filter(
    (part) =>
      part.shape === "box" && part.color === "wood" && part.height > 0.2,
  );
  expect(posts).toHaveLength(4);
  const roof = layout.filter((part) => part.shape === "prism");
  expect(roof).toHaveLength(1);
  expect(roof[0].color).toBe("darkWood");
  const postTop = Math.max(...posts.map((p) => p.y + p.height / 2));
  expect(roof[0].y - roof[0].height / 2).toBeCloseTo(postTop);
});

test("a stack of four logs lies beside the shelter", () => {
  const layout = getWoodcutterLayout(1);
  const roof = layout.find((part) => part.shape === "prism")!;
  const stack = layout.filter(
    (part) => part.shape === "log" && part.z > roof.z + roof.depth / 2,
  );
  expect(stack).toHaveLength(4);
});

test("no part leaves the hex", () => {
  for (const part of getWoodcutterLayout(1)) {
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

test("the geometry stays within 1,000 triangles", () => {
  const layout = getWoodcutterLayout(1);
  expect(buildGeometry(layout).indices.length / 3).toBeLessThanOrEqual(1000);
});

test("the layout scales with the hex size", () => {
  const small = getWoodcutterLayout(1);
  getWoodcutterLayout(2).forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.z).toBeCloseTo(small[i].z * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
    expect(part.depth).toBeCloseTo(small[i].depth * 2);
  });
});
