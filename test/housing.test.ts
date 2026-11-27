import { expect, test } from "vitest";
import type { PlacedBuilding } from "../src/board";
import { assignHomes, getOccupantIds, type Assignments } from "../src/housing";
import { BuildingDefinition } from "../src/gameDefinitions";

const home = (sequence: number, resident: number): PlacedBuilding => ({
  building: { ...BuildingDefinition.SettlersCamp, resident },
  center: { q: sequence, r: 0 },
  sequence,
});

test("the oldest home is filled first, in arrival order", () => {
  const a = home(1, 2);
  const b = home(2, 2);
  const assignments: Assignments = new Map();
  assignHomes(assignments, [1, 2, 3], [b, a]);
  expect(getOccupantIds(assignments, a)).toEqual([1, 2]);
  expect(getOccupantIds(assignments, b)).toEqual([3]);
});

test("housed residents stay when a new home is completed", () => {
  const a = home(1, 3);
  const assignments: Assignments = new Map();
  assignHomes(assignments, [1, 2], [a]);
  const b = home(0, 3); // older, but only completed now
  assignHomes(assignments, [1, 2, 3], [a, b]);
  expect(getOccupantIds(assignments, a)).toEqual([1, 2]);
  expect(getOccupantIds(assignments, b)).toEqual([3]);
});

test("unhoused residents get places before newcomers", () => {
  const a = home(1, 1);
  const assignments: Assignments = new Map();
  assignHomes(assignments, [1, 2], [a]);
  expect(assignments.has(2)).toBe(false);
  const b = home(2, 1);
  assignHomes(assignments, [1, 2, 3], [a, b]);
  expect(assignments.get(2)).toBe(b);
  expect(assignments.has(3)).toBe(false);
});

test("a removed home displaces its occupants", () => {
  const a = home(1, 2);
  const b = home(2, 1);
  const assignments: Assignments = new Map();
  assignHomes(assignments, [1, 2, 3], [a, b]);
  const replacement = home(3, 1);
  assignHomes(assignments, [1, 2, 3], [b, replacement]);
  expect(getOccupantIds(assignments, a)).toEqual([]);
  expect(getOccupantIds(assignments, b)).toEqual([3]);
  expect(getOccupantIds(assignments, replacement)).toEqual([1]);
  expect(assignments.has(2)).toBe(false);
  assignHomes(assignments, [1, 2, 3], []);
  expect(assignments.size).toBe(0);
});

test("departed residents free their places", () => {
  const a = home(1, 2);
  const assignments: Assignments = new Map();
  assignHomes(assignments, [1, 2], [a]);
  assignHomes(assignments, [1], [a]);
  expect(getOccupantIds(assignments, a)).toEqual([1]);
  assignHomes(assignments, [1, 4], [a]);
  expect(getOccupantIds(assignments, a)).toEqual([1, 4]);
});

test("a home that lost capacity keeps at most its capacity", () => {
  const a = home(1, 2);
  const assignments: Assignments = new Map([
    [1, a],
    [2, a],
    [3, a],
  ]);
  assignHomes(assignments, [1, 2, 3], [a]);
  expect(getOccupantIds(assignments, a)).toEqual([1, 2]);
});
