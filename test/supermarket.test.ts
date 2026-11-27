import { expect, test } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";
import { getSupermarketLayout } from "../src/supermarket";

test("the layout is non-empty, deterministic and uses palette colors", () => {
  const layout = getSupermarketLayout(1);
  expect(layout.length).toBeGreaterThan(0);
  expect(getSupermarketLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("a timber hall of about 10 x 6 m with a green flat roof", () => {
  const layout = getSupermarketLayout(1);
  const walls = layout.filter(
    (part) => part.color === "wood" && part.shape === "box",
  );
  expect(walls).toHaveLength(1);
  // a hex side being 18 m
  expect(walls[0].width).toBeCloseTo(0.55);
  expect(walls[0].depth).toBeCloseTo(0.33);
  const frame = layout.filter((part) => part.color === "darkWood");
  expect(frame.length).toBeGreaterThanOrEqual(4);
  const roof = layout.filter((part) => part.color === "plant");
  expect(roof).toHaveLength(1);
  expect(roof[0].y - roof[0].height / 2).toBeCloseTo(
    walls[0].y + walls[0].height / 2,
  );
});

test("a large front window faces the forecourt", () => {
  const layout = getSupermarketLayout(1);
  const windows = layout.filter((part) => part.color === "glass");
  expect(windows).toHaveLength(1);
  const [window] = windows;
  expect(window.width).toBeGreaterThan(0.2);
  const wall = layout.find((part) => part.color === "wood")!;
  expect(window.z).toBeGreaterThan(wall.z + wall.depth / 2);
});

test("a striped awning with alternating colors hangs over the entrance", () => {
  const layout = getSupermarketLayout(1);
  const stripes = layout.filter(
    (part) => part.color === "awning" || part.color === "canvas",
  );
  expect(stripes).toHaveLength(4);
  expect(stripes.map((stripe) => stripe.color)).toEqual([
    "awning",
    "canvas",
    "awning",
    "canvas",
  ]);
  for (const stripe of stripes) {
    expect(stripe.tilt).not.toBe(0);
  }
});

test("4 produce crates and a gravel forecourt in front of the hall", () => {
  const layout = getSupermarketLayout(1);
  const crates = layout.filter((part) => part.color === "plank");
  expect(crates).toHaveLength(4);
  const wall = layout.find((part) => part.color === "wood")!;
  for (const crate of crates) {
    expect(crate.z).toBeGreaterThan(wall.z + wall.depth / 2);
  }
  expect(layout.filter((part) => part.color === "gravel")).toHaveLength(1);
});

test("no part leaves the hex", () => {
  for (const part of getSupermarketLayout(1)) {
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
        0.87,
      );
    }
  }
});

test("the geometry stays below 1,000 triangles", () => {
  const layout = getSupermarketLayout(1);
  expect(buildGeometry(layout).indices.length / 3).toBeLessThan(1000);
});

test("the layout scales with the hex size", () => {
  const small = getSupermarketLayout(1);
  getSupermarketLayout(2).forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.z).toBeCloseTo(small[i].z * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
    expect(part.depth).toBeCloseTo(small[i].depth * 2);
  });
});
