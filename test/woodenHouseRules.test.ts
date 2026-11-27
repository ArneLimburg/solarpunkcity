import { beforeEach, expect, test, vi } from "vitest";
import type { Building } from "../src/gameDefinitions";

let board: typeof import("../src/board");
let game: typeof import("../src/game");
let definitions: typeof import("../src/gameDefinitions");

beforeEach(async () => {
  vi.resetModules();
  board = await import("../src/board");
  game = await import("../src/game");
  definitions = await import("../src/gameDefinitions");
});

const house = (): Building => definitions.BuildingDefinition.WoodenHouse;

test("the wooden house is a residential building made of wood only", () => {
  expect(definitions.BuildingTypes.WoodenHouse).toEqual({
    category: "RESIDENTIAL",
    icon: "residential/wooden-house.svg",
    label: "Wooden house",
  });
  expect(house()).toMatchObject({
    name: "Wooden house",
    size: 1,
    resident: 5,
    ecology: 0.3,
    maxBuilders: 4,
  });
  expect(house().cost.wood).toBe(10);
  expect(house().cost.planks).toBe(0);
  expect(house().cost.labor).toBe(100);
  const none = definitions.BuildingDefinition.River.produces;
  expect(house().produces).toEqual(none);
  expect(house().consumes).toEqual(none);
});

test("a finished wooden house houses 5 residents, a 6th stays unhoused", async () => {
  const { assignHomes } = await import("../src/housing");
  const placed = { building: house(), center: { q: 1, r: 0 }, sequence: 1 };
  const assignments = new Map();
  assignHomes(assignments, [1, 2, 3, 4, 5, 6], [placed]);
  expect(assignments.size).toBe(5);
  expect(assignments.has(6)).toBe(false);
});

test("demolishing a wooden house returns 5 wood", () => {
  expect(house().recycling?.wood).toBe(5);
  board.setBuilding({ q: 1, r: 0 }, house());
  game.grantResources({ wood: 10 });
  game.build("WoodenHouse", { q: 1, r: 0 });
  // the site costs 10 wood, so all 5 recycled wood stay in it
  expect(board.getConstructionSites()[0].siteWood).toBe(5);
});
