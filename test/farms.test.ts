import { expect, test } from "vitest";
import { getFootprint, getFootprintRadius } from "../src/board";
import { buildGeometry } from "../src/farmGeometry";
import {
  FarmPalette,
  getFarmLayout,
  isFarmType,
  rotateY,
  type FarmType,
} from "../src/farms";
import { BuildingDefinition } from "../src/gameDefinitions";

const TYPES: FarmType[] = ["OrganicHomestead", "Farm", "AgroIndustrial"];
const TRIANGLE_BUDGET: Record<FarmType, number> = {
  OrganicHomestead: 1000,
  Farm: 3000,
  AgroIndustrial: 8000,
};

const center = ({ q, r }: { q: number; r: number }) => ({
  x: Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r,
  z: 1.5 * r,
});

test("only the farm types are built from code", () => {
  expect(TYPES.every(isFarmType)).toBe(true);
  expect(isFarmType("AppartmentBuilding")).toBe(false);
  expect(isFarmType("Forest")).toBe(false);
});

test.each(TYPES)("%s has a non-empty, deterministic layout", (type) => {
  const layout = getFarmLayout(type, 1);
  expect(layout.length).toBeGreaterThan(0);
  expect(getFarmLayout(type, 1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test.each(TYPES)("no part of %s leaves 80 % of a footprint tile", (type) => {
  const radius = getFootprintRadius(BuildingDefinition[type].size);
  const tiles = getFootprint({ q: 0, r: 0 }, radius).map(center);
  expect(tiles).toHaveLength(BuildingDefinition[type].size);
  for (const part of getFarmLayout(type, 1)) {
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
      const x = part.x + corner.x;
      const z = part.z + corner.z;
      const nearest = Math.min(
        ...tiles.map((tile) => Math.hypot(x - tile.x, z - tile.z)),
      );
      expect(nearest).toBeLessThanOrEqual(0.8 + 1e-9);
    }
  }
});

test.each(TYPES)("%s stays within its triangle budget", (type) => {
  const geometry = buildGeometry(getFarmLayout(type, 1));
  expect(geometry.indices.length / 3).toBeLessThanOrEqual(
    TRIANGLE_BUDGET[type],
  );
});

test("the models have the described height", () => {
  const top = (type: FarmType) =>
    Math.max(...getFarmLayout(type, 1).map((p) => p.y + p.height / 2));
  expect(top("OrganicHomestead")).toBeCloseTo(0.5, 1);
  expect(top("Farm")).toBeCloseTo(0.8, 1);
  expect(top("AgroIndustrial")).toBeCloseTo(2.5, 1);
});

test("the farm types look different", () => {
  const key = (type: FarmType) =>
    JSON.stringify(getFarmLayout(type, 1).slice(0, 3));
  expect(new Set(TYPES.map(key)).size).toBe(3);
  const colors = (type: FarmType) =>
    new Set(getFarmLayout(type, 1).map((p) => p.color));
  expect(colors("Farm").has("grain")).toBe(true);
  expect(colors("AgroIndustrial").has("glass")).toBe(true);
  expect(colors("AgroIndustrial").has("solar")).toBe(true);
});

test("the layout scales with the hex size", () => {
  const small = getFarmLayout("Farm", 1);
  const large = getFarmLayout("Farm", 2);
  large.forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
  });
});

test("the geometry has unit normals and one color per vertex", () => {
  const geometry = buildGeometry(getFarmLayout("OrganicHomestead", 1));
  const vertices = geometry.positions.length / 3;
  expect(geometry.normals).toHaveLength(vertices * 3);
  expect(geometry.colors).toHaveLength(vertices * 4);
  expect(geometry.indices).toHaveLength(vertices);
  for (let i = 0; i < geometry.normals.length; i += 3) {
    const n = geometry.normals.slice(i, i + 3);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1);
  }
});
