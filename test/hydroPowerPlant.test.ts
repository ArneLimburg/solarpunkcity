import { expect, test } from "vitest";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import { buildGeometry } from "../src/farmGeometry";
import { rotateY } from "../src/farms";
import { hexToPixel } from "../src/hexGeometry";
import {
  getHydroPowerPlantLayout,
  getHydroPowerPlantRotation,
} from "../src/hydroPowerPlant";

const course = getRiverCourse(GRID_RADIUS);

test("the weir is perpendicular to the river course on every river tile", () => {
  course.forEach((tile, i) => {
    const previous = hexToPixel(
      course[Math.max(i - 1, 0)].q,
      course[Math.max(i - 1, 0)].r,
    );
    const next = hexToPixel(
      course[Math.min(i + 1, course.length - 1)].q,
      course[Math.min(i + 1, course.length - 1)].r,
    );
    const flow = { x: next.x - previous.x, z: next.z - previous.z };
    const weir = rotateY({ x: 1, z: 0 }, getHydroPowerPlantRotation(tile));
    expect(weir.x * flow.x + weir.z * flow.z).toBeCloseTo(0);
    // downstream is the +Z side of the model
    const downstream = rotateY(
      { x: 0, z: 1 },
      getHydroPowerPlantRotation(tile),
    );
    expect(downstream.x * flow.x + downstream.z * flow.z).toBeGreaterThan(0);
  });
});

test("the orientation differs between a straight and a bent tile", () => {
  const rotations = new Set(
    course.map((tile) => getHydroPowerPlantRotation(tile).toFixed(3)),
  );
  expect(rotations.size).toBeGreaterThan(1);
});

test("a tile off the river course is not turned", () => {
  expect(getHydroPowerPlantRotation({ q: 0, r: 0 })).toBe(0);
});

test("a given course is used instead of the river", () => {
  const straight = [
    { q: 0, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: 2 },
  ];
  const flow = hexToPixel(0, 2);
  expect(getHydroPowerPlantRotation(straight[1], straight)).toBeCloseTo(
    Math.atan2(flow.x, flow.z),
  );
});

test("the model has weir, turbine house, planted roof and foam within the budget", () => {
  const parts = getHydroPowerPlantLayout(1);
  const colors = parts.map((p) => p.color);
  expect(colors).toEqual(
    expect.arrayContaining(["concrete", "stone", "plant", "foam"]),
  );
  // one opaque mesh: no glass
  expect(colors).not.toContain("glass");
  const triangles = buildGeometry(parts).indices.length / 3;
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(1000);
  // the weir spans the river, the house stands on one end of it
  const weir = parts[0];
  expect(weir.width).toBeGreaterThan(1.5);
  expect(parts.some((p) => p.color === "stone" && p.x > 0)).toBe(true);
});

test("the layout scales with the hex size", () => {
  const small = getHydroPowerPlantLayout(1);
  const large = getHydroPowerPlantLayout(2);
  expect(large[0].width).toBe(small[0].width * 2);
  expect(large[2].x).toBe(small[2].x * 2);
});
