import { expect, test } from "vitest";
import { getOccupancy, getResidents } from "../src/buildingInfo";

test("occupancy is the share of occupied housing, at most 1", () => {
  expect(getOccupancy(5, 10)).toBe(0.5);
  expect(getOccupancy(20, 10)).toBe(1);
});

test("occupancy is 0 without housing", () => {
  expect(getOccupancy(5, 0)).toBe(0);
});

test("residents and percent are rounded", () => {
  expect(getResidents(15, 2, 17)).toEqual({ residents: 2, percent: 12 });
  expect(getResidents(15, 100, 17)).toEqual({ residents: 15, percent: 100 });
  expect(getResidents(15, 3, 0)).toEqual({ residents: 0, percent: 0 });
});
