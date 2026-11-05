import { expect, test } from "vitest";
import { FOREST_FLOOR_SIZE, createForestFloorPixels } from "../src/forestFloor";

test("the forest floor has the expected size", () => {
  expect(createForestFloorPixels()).toHaveLength(
    FOREST_FLOOR_SIZE * FOREST_FLOOR_SIZE * 4,
  );
});

test("the forest floor is identical on every call", () => {
  expect(createForestFloorPixels()).toEqual(createForestFloorPixels());
});

test("the forest floor only has opaque greenish colors in several shades", () => {
  const pixels = createForestFloorPixels();
  const shades = new Set<number>();
  for (let i = 0; i < pixels.length; i += 4) {
    expect(pixels[i + 1]).toBeGreaterThan(pixels[i]);
    expect(pixels[i + 1]).toBeGreaterThan(pixels[i + 2]);
    expect(pixels[i + 3]).toBe(255);
    shades.add(pixels[i + 1]);
  }
  expect(shades.size).toBeGreaterThanOrEqual(2);
});
