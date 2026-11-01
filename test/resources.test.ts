import { describe, expect, test } from "vitest";
import {
  addResources,
  emptyResources,
  hasEnoughResources,
  subtractResources,
  type Resources,
} from "../src/resources";

const keys = Object.keys(emptyResources) as (keyof Resources)[];

const a: Resources = {
  food: 10,
  water: 20,
  labor: 30,
  wood: 40,
  ore: 50,
  steel: 60,
  glass: 70,
  hydrogen: 80,
  electronics: 90,
};
const b: Resources = {
  food: 1,
  water: 2,
  labor: 3,
  wood: 4,
  ore: 5,
  steel: 6,
  glass: 7,
  hydrogen: 8,
  electronics: 9,
};

describe("addResources", () => {
  test("adds each resource individually", () => {
    expect(addResources(a, b)).toEqual({
      food: 11,
      water: 22,
      labor: 33,
      wood: 44,
      ore: 55,
      steel: 66,
      glass: 77,
      hydrogen: 88,
      electronics: 99,
    });
  });
});

describe("subtractResources", () => {
  test("subtracts each resource individually", () => {
    expect(subtractResources(a, b)).toEqual({
      food: 9,
      water: 18,
      labor: 27,
      wood: 36,
      ore: 45,
      steel: 54,
      glass: 63,
      hydrogen: 72,
      electronics: 81,
    });
  });
});

describe("hasEnoughResources", () => {
  test("is true for exactly equal values", () => {
    expect(hasEnoughResources(a, { ...a })).toBe(true);
  });

  test("is true for empty cost", () => {
    expect(hasEnoughResources(a, emptyResources)).toBe(true);
    expect(hasEnoughResources(emptyResources, emptyResources)).toBe(true);
  });

  test.each(keys)("is false if only %s is short by 1", (key) => {
    const available = { ...a, [key]: a[key] - 1 };
    expect(hasEnoughResources(available, a)).toBe(false);
  });
});

describe("immutability", () => {
  test("does not modify its inputs", () => {
    const inputA = { ...a };
    const inputB = { ...b };

    addResources(inputA, inputB);
    subtractResources(inputA, inputB);
    addResources(emptyResources, inputA);
    subtractResources(emptyResources, inputA);
    hasEnoughResources(inputA, emptyResources);
    hasEnoughResources(emptyResources, inputA);

    expect(inputA).toEqual(a);
    expect(inputB).toEqual(b);
    expect(Object.values(emptyResources).every((v) => v === 0)).toBe(true);
    expect(Object.keys(emptyResources)).toHaveLength(9);
  });
});
