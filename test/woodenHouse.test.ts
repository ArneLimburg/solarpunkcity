import { expect, test } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";
import { getWoodenHouseLayout } from "../src/woodenHouse";

test("the wooden house is deterministic and uses palette colors", () => {
  const layout = getWoodenHouseLayout(1);
  expect(getWoodenHouseLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("the wooden house has walls, roof, panels, turbine and garden", () => {
  const layout = getWoodenHouseLayout(1);
  const walls = layout.find((p) => p.color === "wood" && p.shape === "box");
  expect(walls?.height).toBeCloseTo(0.17);
  const roof = layout.find((p) => p.shape === "prism");
  expect(roof?.color).toBe("roof");
  const ridge = roof!.y + roof!.height / 2;
  expect(
    layout.filter((p) => p.color === "solar").length,
  ).toBeGreaterThanOrEqual(2);
  const mast = layout.find(
    (p) => p.shape === "cylinder" && p.color === "concrete",
  )!;
  expect(mast.height).toBeGreaterThan(ridge);
  expect(mast.y + mast.height / 2).toBeGreaterThan(ridge);
  const blades = layout.filter(
    (p) => p.shape === "box" && p.color === "concrete" && p.width < 0.02,
  );
  expect(blades).toHaveLength(3);
  expect(layout.some((p) => p.color === "soil")).toBe(true);
  expect(layout.some((p) => p.shape === "sphere" && p.color === "plant")).toBe(
    true,
  );
  expect(layout.some((p) => p.color === "darkWood")).toBe(true);
  expect(layout.some((p) => p.color === "darkGlass")).toBe(true);
});

test("the wooden house is within the triangle budget", () => {
  const triangles = buildGeometry(getWoodenHouseLayout(1)).indices.length / 3;
  expect(triangles).toBeLessThan(1000);
});

test("all parts stay inside the tile and above the ground", () => {
  for (const hexSize of [1, 2]) {
    for (const part of getWoodenHouseLayout(hexSize)) {
      expect(part.y - part.height / 2).toBeGreaterThanOrEqual(-1e-9);
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
        expect(
          Math.hypot(part.x + corner.x, part.z + corner.z),
        ).toBeLessThanOrEqual(hexSize + 1e-9);
      }
    }
  }
});

test("the layout scales linearly with the hex size", () => {
  const small = getWoodenHouseLayout(1);
  const large = getWoodenHouseLayout(2);
  expect(large).toHaveLength(small.length);
  large.forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.z).toBeCloseTo(small[i].z * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
    expect(part.depth).toBeCloseTo(small[i].depth * 2);
  });
});
