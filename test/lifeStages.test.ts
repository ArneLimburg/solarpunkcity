import { expect, test } from "vitest";
import { ageInWeek, birthTime } from "../src/calendar";
import {
  drawForBirthday,
  getDeaths,
  getLifeStage,
  getMortality,
  MAX_LIFE_AGE,
  MORTALITY_BASE,
  MORTALITY_DOUBLING_YEARS,
} from "../src/lifeStages";
import { createRoster, type Resident, type Roster } from "../src/settlers";

function resident(id: number, birthDate: number): Resident {
  return {
    id,
    clothing: "#ffffff",
    skin: "#f5deb3",
    hobby: "Gardening",
    name: `Resident ${id}`,
    age: 0,
    birthDate,
  };
}

function rosterOf(...residents: Resident[]): Roster {
  return { ...createRoster(7), residents };
}

test("the life stage follows the age", () => {
  expect(getLifeStage(0)).toBe("Child");
  expect(getLifeStage(17)).toBe("Child");
  expect(getLifeStage(18)).toBe("Adult");
  expect(getLifeStage(64)).toBe("Adult");
  expect(getLifeStage(65)).toBe("Retired");
  expect(getLifeStage(100)).toBe("Retired");
});

test("a birthday between two ticks changes the stage at the next tick", () => {
  // turns 65 on the date of week 5
  const birth = birthTime(5, 65, 0);
  expect(getLifeStage(ageInWeek(birth, 4))).toBe("Adult");
  expect(getLifeStage(ageInWeek(birth, 5))).toBe("Retired");
});

test("the mortality doubles every eight years and is capped at 1", () => {
  expect(MORTALITY_BASE).toBe(0.01);
  expect(MORTALITY_DOUBLING_YEARS).toBe(8);
  expect(getMortality(65)).toBeCloseTo(0.01);
  expect(getMortality(73)).toBeCloseTo(0.02);
  expect(getMortality(81)).toBeCloseTo(0.04);
  expect(getMortality(MAX_LIFE_AGE)).toBe(1);
});

test("the draw only depends on seed, resident and age", () => {
  const roster = rosterOf();
  const draw = drawForBirthday(roster, 3, 70);
  expect(draw).toBeGreaterThanOrEqual(0);
  expect(draw).toBeLessThan(1);
  expect(drawForBirthday(roster, 3, 70)).toBe(draw);
  expect(drawForBirthday(roster, 3, 71)).not.toBe(draw);
  expect(drawForBirthday(roster, 4, 70)).not.toBe(draw);
  expect(drawForBirthday({ ...roster, seed: 8 }, 3, 70)).not.toBe(draw);
});

test("one draw per resident turning 65 or older, none before", () => {
  const young = resident(1000, birthTime(1, 30, 0));
  const turning64 = Array.from({ length: 300 }, (_, i) =>
    resident(i + 1, birthTime(1, 64, 0)),
  );
  expect(getDeaths(rosterOf(young, ...turning64), 0)).toEqual([]);

  const turning65 = Array.from({ length: 300 }, (_, i) =>
    resident(i + 1, birthTime(1, 65, 0)),
  );
  const roster = rosterOf(young, ...turning65);
  const expected = turning65
    .filter(({ id }) => drawForBirthday(roster, id, 65) < getMortality(65))
    .map(({ id }) => id);
  expect(expected.length).toBeGreaterThan(0);
  expect(expected.length).toBeLessThan(30);
  expect(getDeaths(roster, 0)).toEqual(expected);
  // the same state gives the same deaths
  expect(getDeaths(roster, 0)).toEqual(expected);
  // no birthday between the ticks, no draw
  expect(getDeaths(roster, 1)).toEqual([]);
});

test("a resident turning 120 always dies, the youngest of all survives", () => {
  const young = resident(1, birthTime(1, 30, 0));
  const old = resident(2, birthTime(1, MAX_LIFE_AGE, 0));
  expect(getDeaths(rosterOf(young, old), 0)).toEqual([2]);
  expect(getDeaths(rosterOf(old), 0)).toEqual([]);
  expect(getDeaths(rosterOf(), 0)).toEqual([]);

  const older = resident(3, birthTime(1, MAX_LIFE_AGE, 5));
  expect(getDeaths(rosterOf(old, older), 0)).toEqual([3]);
  expect(getDeaths(rosterOf(older, old), 0)).toEqual([3]);
});
