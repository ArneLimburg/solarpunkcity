import { expect, test } from "vitest";
import {
  APARTMENT_ROTOR_RPM,
  getApartmentHubPosition,
  getApartmentLayout,
  getApartmentRotorLayout,
} from "../src/apartment";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";

test("the apartment building has a non-empty, deterministic layout", () => {
  const layout = getApartmentLayout(1);
  expect(layout.length).toBeGreaterThan(0);
  expect(getApartmentLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("no part leaves 80 % of the hex radius", () => {
  for (const part of getApartmentLayout(1)) {
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
      ).toBeLessThanOrEqual(0.8 + 1e-9);
    }
  }
});

test("the building is about 1.5 tall with a roof above and within budget", () => {
  const layout = getApartmentLayout(1);
  const tower = layout[0];
  expect(tower.height).toBeCloseTo(1.5);
  expect(Math.max(...layout.map((p) => p.y + p.height / 2))).toBeGreaterThan(
    1.5,
  );
  expect(buildGeometry(layout).indices.length / 3).toBeLessThanOrEqual(1000);
  const colors = new Set(layout.map((p) => p.color));
  for (const color of ["ochre", "darkGlass", "solar", "plant", "wood"]) {
    expect(colors.has(color as never)).toBe(true);
  }
});

test("the rotor parts at angle 0 complete the previous layout", () => {
  const rotor = getApartmentRotorLayout(1);
  expect(rotor).toHaveLength(3);
  const hub = getApartmentHubPosition(1);
  const layout = getApartmentLayout(1);
  // the mast stays in the static layout, the blades are only in the rotor
  expect(layout[layout.length - 1].shape).toBe("cylinder");
  expect(layout.some((p) => p.color === "concrete" && p.width === 0.01)).toBe(
    false,
  );
  // blade 0 points up from the hub, 0.03 in front of the mast
  expect(rotor[0].x).toBeCloseTo(0.33);
  expect(rotor[0].y).toBeCloseTo(hub.y + 0.14);
  expect(rotor[0].z).toBeCloseTo(hub.z);
  expect(getApartmentRotorLayout(2)[0].y).toBeCloseTo(rotor[0].y * 2);
  expect(getApartmentHubPosition(2).y).toBeCloseTo(hub.y * 2);
  expect(APARTMENT_ROTOR_RPM).toBe(60);
});

test("the building with its rotor stays below 1,000 triangles", () => {
  const all = [...getApartmentLayout(1), ...getApartmentRotorLayout(1)];
  expect(buildGeometry(all).indices.length / 3).toBeLessThan(1000);
});

test("the layout scales with the hex size", () => {
  const small = getApartmentLayout(1);
  getApartmentLayout(2).forEach((part, i) => {
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
  });
});
