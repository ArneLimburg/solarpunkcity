import { expect, test } from "vitest";
import type { GameState } from "../src/game";
import {
  formatConstructionSites,
  formatFood,
  formatFreeRow,
  formatPercent,
  formatPlanks,
  formatPopulation,
  formatSatisfactionDetail,
  formatWood,
  formatWorkersButton,
  getFurtherStocks,
} from "../src/hudFormat";
import { emptyResources } from "../src/resources";

const state: GameState = {
  resources: { ...emptyResources, food: 18.7, wood: 38.2, labor: 3 },
  capacity: { ...emptyResources, wood: 100, food: 100 },
  population: 12.4,
  residents: [],
  housing: 15,
  ecology: 80.5,
  satisfaction: 70,
  freeLaborShare: 25.9,
  laborFactor: 60.2,
  foodBalance: 2.6,
  constructionSites: 2,
  sitesWaitingForWood: 0,
  workforce: { food: 4, construction: 3, production: 0, forestry: 2, free: 3 },
  week: 0,
  energyProduced: 0,
  energyUsed: 0,
  buildingsWithoutEnergy: 0,
};

test("people, food and wood", () => {
  expect(formatPopulation(state)).toBe("12 / 15");
  expect(formatFood(state)).toBe("18 / 100 (+2/wk)");
  expect(formatFood({ ...state, foodBalance: -1.5 })).toBe("18 / 100 (−1/wk)");
  expect(formatWood(state)).toBe("38 / 100");
});

test("workers", () => {
  expect(formatWorkersButton(state)).toBe("Workers: 3 free");
  expect(formatFreeRow(state, state.workforce!)).toBe("3 (25 %)");
});

test("ecology, satisfaction and construction sites", () => {
  expect(formatPercent(80.5)).toBe("80 %");
  expect(formatSatisfactionDetail(state)).toBe("ecology 80 %, work 60 %");
  expect(formatConstructionSites(state)).toBe("2");
  expect(formatConstructionSites({ ...state, sitesWaitingForWood: 1 })).toBe(
    "2 (1 waiting for material)",
  );
});

test("planks as stock and capacity", () => {
  expect(
    formatPlanks({
      ...state,
      resources: { ...state.resources, planks: 12.8 },
      capacity: { ...state.capacity, planks: 20 },
    }),
  ).toBe("12 / 20");
});

test("further stocks only above 0, wood and planks have their own entry", () => {
  expect(getFurtherStocks(state.resources)).toEqual([]);
  expect(
    getFurtherStocks({
      ...state.resources,
      wood: 5,
      planks: 7,
      ore: 2,
      steel: 0,
    }),
  ).toEqual(["ore"]);
});
