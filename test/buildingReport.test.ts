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

function testBuilding(overrides: {
  produces?: Partial<Building["produces"]>;
  consumes?: Partial<Building["consumes"]>;
}): Building {
  const forest = definitions.BuildingDefinition.Forest;
  return {
    ...forest,
    name: "Test",
    produces: { ...forest.produces, wood: 0, ...overrides.produces },
    consumes: { ...forest.consumes, labor: 0, ...overrides.consumes },
    recycling: undefined,
  };
}

const homestead = () => definitions.BuildingDefinition.OrganicHomestead;
const origin = { q: 0, r: 0 };
const east = { q: 1, r: 0 };
const far = { q: 2, r: 0 };

test("a building has no report before the first tick", () => {
  board.setBuilding(origin, homestead());
  expect(game.getBuildingReport(origin)).toBeUndefined();
  expect(game.getBuildingReport({ q: 99, r: 0 })).toBeUndefined();
});

test("a food building reports its workers and produced food", () => {
  board.setBuilding(origin, homestead());
  const { foodBalance, population } = game.calculateWeek();
  const report = game.getBuildingReport(origin)!;
  expect(report.workers).toBe(2);
  expect(report.produced.food).toBe(3);
  expect(report.consumed.labor).toBe(2);
  expect(report.status).toBeUndefined();
  expect(foodBalance).toBe(report.produced.food - 2);
  expect(population).toBe(3);
});

test("the produced food of all reports adds up to the week's food", () => {
  const staffed = { produces: { food: 1 }, consumes: { labor: 2 } };
  board.setBuilding(origin, testBuilding(staffed));
  board.setBuilding(east, testBuilding(staffed));
  board.setBuilding(far, testBuilding({ produces: { food: 0.5 } }));
  const { foodBalance } = game.calculateWeek();
  const reports = [origin, east, far].map((c) => game.getBuildingReport(c)!);
  const sum = reports.reduce((s, r) => s + r.produced.food, 0);
  expect(sum).toBeCloseTo(foodBalance + 2);
  // no staff needed
  expect(reports[2].workers).toBe(0);
  expect(reports[2].produced.food).toBeGreaterThan(0);
  expect(reports[2].status).toBeUndefined();
  // the second building finds no workers left
  expect(reports[1].workers).toBe(0);
  expect(reports[1].status).toBe("no-workers");
  expect(reports[1].produced.food).toBe(0);
});

test("a food building is not needed once the demand is covered", () => {
  board.setBuilding(origin, homestead());
  board.setBuilding(east, homestead());
  game.calculateWeek();
  expect(game.getBuildingReport(origin)!.status).toBeUndefined();
  const second = game.getBuildingReport(east)!;
  expect(second.status).toBe("not-needed");
  expect(second.workers).toBe(0);
  expect(second.produced.food).toBe(0);
  expect(second.consumed.labor).toBe(0);
});

test("a producer without its inputs reports missing resources", () => {
  board.setBuilding(
    origin,
    testBuilding({ produces: { steel: 1 }, consumes: { ore: 5 } }),
  );
  board.setBuilding(east, testBuilding({ consumes: { ore: 5 } }));
  game.calculateWeek();
  const report = game.getBuildingReport(origin)!;
  expect(report.status).toBe("missing-resources");
  expect(report.produced.steel).toBe(0);
  // nothing to produce, so nothing is missing
  expect(game.getBuildingReport(east)!.status).toBeUndefined();
});

test("a working producer reports what it produced and consumed", () => {
  game.grantResources({ ore: 5 });
  board.setBuilding(
    origin,
    testBuilding({ produces: { steel: 1 }, consumes: { ore: 5 } }),
  );
  game.calculateWeek();
  const report = game.getBuildingReport(origin)!;
  expect(report.produced.steel).toBe(1);
  expect(report.consumed.ore).toBe(5);
  expect(report.status).toBeUndefined();
});

test("a new building has no report and a replaced one loses it", () => {
  board.setBuilding(origin, homestead());
  game.calculateWeek();
  expect(game.getBuildingReport(origin)).toBeDefined();
  game.grantResources({ wood: 100 });
  game.build("OrganicHomestead", origin);
  expect(game.getBuildingReport(origin)).toBeUndefined();
  game.calculateWeek();
  expect(game.getBuildingReport(origin)).toBeUndefined(); // still a site
  game.finishConstruction();
  expect(game.getBuildingReport(origin)).toBeUndefined();
  game.calculateWeek();
  expect(game.getBuildingReport(origin)).toBeDefined();
});
