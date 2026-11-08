import { beforeEach, expect, test, vi } from "vitest";
import { buildGeometry } from "../src/farmGeometry";
import { FarmPalette, rotateY } from "../src/farms";
import { getSettlersCampLayout } from "../src/settlersCamp";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

const isZero = (resources: Record<string, number>) =>
  Object.values(resources).every((value) => value === 0);

test("the camp is a not buildable category with the defined values", () => {
  const { BuildingCategories, BuildingDefinition, BuildingTypes } = definitions;
  expect(BuildingCategories.CAMP.buildable).toBe(false);
  expect(BuildingTypes.SettlersCamp.category).toBe("CAMP");
  const camp = BuildingDefinition.SettlersCamp;
  expect(camp.name).toBe("Settlers' camp");
  expect(camp.size).toBe(1);
  expect(camp.resident).toBe(2);
  expect(camp.ecology).toBe(0);
  expect(camp.produces).toEqual({ ...camp.cost, food: 2 });
  expect(isZero(camp.cost)).toBe(true);
  expect(isZero(camp.consumes)).toBe(true);
  expect(isZero(camp.recycling!)).toBe(true);
});

test("a new board has the camp on 0,0 and forest everywhere else", () => {
  const camp = definitions.BuildingDefinition.SettlersCamp;
  expect(board.getBuilding({ q: 0, r: 0 })).toBe(camp);
  expect(board.isUnderConstruction({ q: 0, r: 0 })).toBe(false);
  const buildings = board.getBuildings();
  expect(buildings.filter((b) => b === camp)).toHaveLength(1);
  expect(buildings.filter((b) => b.type === "Forest")).toHaveLength(
    buildings.length - 1,
  );
});

test("the first weeks: housing 2, food balance 0, no growth", () => {
  expect(game.getState().housing).toBe(2);
  for (let week = 0; week < 5; week++) {
    const state = game.calculateWeek();
    expect(state.population).toBe(2);
    expect(state.foodBalance).toBe(0);
    expect(state.resources.food).toBe(10);
  }
});

test("the camp needs no labor, so both settlers can build from week 1", () => {
  game.build("OrganicHomestead", { q: 1, r: 0 });
  game.calculateWeek();
  // the homestead has 2 builders at most and both are free
  expect(board.getConstructionSites()[0].remainingWork).toBe(2);
});

test("below 90 % ecology the camp produces less than 2 food", () => {
  for (let q = -30; q <= 30; q++) {
    for (let r = -30; r <= 30; r++) {
      if (board.isOnBoard({ q, r }) && (q !== 0 || r !== 0)) {
        board.setBuilding(
          { q, r },
          { ...definitions.BuildingDefinition.Forest, ecology: 0.6 },
        );
      }
    }
  }
  expect(game.getState().ecology).toBeLessThan(90);
  const { foodBalance } = game.calculateWeek();
  expect(foodBalance).toBeLessThan(0);
  expect(foodBalance).toBeGreaterThan(-2);
});

test("building over the camp removes housing and food without a refund", () => {
  const before = game.getState().resources;
  expect(game.canBuild("OrganicHomestead", { q: 0, r: 0 })).toBe(true);
  game.build("OrganicHomestead", { q: 0, r: 0 });
  const state = game.getState();
  expect(state.housing).toBe(0);
  expect(state.resources.wood).toBe(before.wood - 4);
  expect(state.resources.food).toBe(before.food);
  expect(state.population).toBe(2);
  // the settlers live from the food stock now
  expect(game.calculateWeek().foodBalance).toBe(-2);
});

test("a large building can cover the camp", () => {
  expect(game.canBuild("Farm", { q: 1, r: 0 })).toBe(true);
});

test("the camp layout is deterministic and uses palette colors", () => {
  const layout = getSettlersCampLayout(1);
  expect(getSettlersCampLayout(1)).toEqual(layout);
  for (const part of layout) {
    expect(FarmPalette).toHaveProperty(part.color);
  }
});

test("the camp has 2 tents, 6 stones, 3 logs and a bed with plants", () => {
  const layout = getSettlersCampLayout(1);
  const count = (shape: string, color: string) =>
    layout.filter((p) => p.shape === shape && p.color === color).length;
  expect(count("prism", "canvas")).toBe(2);
  expect(count("box", "stone")).toBe(6);
  expect(count("box", "wood")).toBe(3);
  expect(count("box", "soil")).toBe(1);
  expect(count("sphere", "plant")).toBe(12);
});

test("the tents are about 3-4 m long", () => {
  // 1 scene unit is about 18 m
  const tents = getSettlersCampLayout(1).filter((p) => p.shape === "prism");
  for (const tent of tents) {
    expect(tent.width * 18).toBeGreaterThanOrEqual(3);
    expect(tent.width * 18).toBeLessThanOrEqual(4.5);
  }
});

test("no part leaves 80 % of the hex radius", () => {
  for (const part of getSettlersCampLayout(1)) {
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

test("the camp stays below 1,000 triangles", () => {
  const triangles = buildGeometry(getSettlersCampLayout(1)).indices.length / 3;
  expect(triangles).toBeLessThan(1000);
});

test("the layout scales with the hex size", () => {
  const small = getSettlersCampLayout(1);
  getSettlersCampLayout(2).forEach((part, i) => {
    expect(part.x).toBeCloseTo(small[i].x * 2);
    expect(part.y).toBeCloseTo(small[i].y * 2);
    expect(part.z).toBeCloseTo(small[i].z * 2);
    expect(part.width).toBeCloseTo(small[i].width * 2);
    expect(part.height).toBeCloseTo(small[i].height * 2);
    expect(part.depth).toBeCloseTo(small[i].depth * 2);
  });
});
