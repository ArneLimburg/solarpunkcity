import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  BuildingCategories,
  BuildingDefinition,
  BuildingTypes,
  getLabel,
  type BuildingType,
} from "../src/gameDefinitions";

test("construction work and maximum builders of every building", () => {
  const work = (name: keyof typeof BuildingDefinition) => [
    BuildingDefinition[name].cost.labor,
    BuildingDefinition[name].maxBuilders,
  ];
  expect(work("OrganicHomestead")).toEqual([4, 2]);
  expect(work("AppartmentBuilding")).toEqual([20, 4]);
  expect(work("Farm")).toEqual([24, 6]);
  expect(work("AgroIndustrial")).toEqual([80, 10]);
  expect(work("Forest")).toEqual([0, 0]);
  expect(work("WoodStorage")).toEqual([0, 0]);
});

test("the wood storage is a free storage building without recycling", () => {
  const storage = BuildingDefinition.WoodStorage;
  expect(BuildingTypes.WoodStorage.category).toBe("STORAGE");
  expect(BuildingCategories.STORAGE.buildable).toBe(true);
  expect(storage.storage?.wood).toBe(100);
  expect(Object.values(storage.cost).every((value) => value === 0)).toBe(true);
  expect(storage.size).toBe(1);
  expect(storage.recycling).toBeUndefined();
});

test("the river is a not buildable water tile that cannot be built over", () => {
  const river = BuildingDefinition.River;
  expect(BuildingCategories.WATER.buildable).toBe(false);
  expect(BuildingTypes.River).toEqual({
    category: "WATER",
    icon: "water/river.svg",
  });
  expect(river.name).toBe("River");
  expect(river.description).toBe(
    "Fresh water flowing from the mountains to the sea",
  );
  expect(river.size).toBe(1);
  expect(river.resident).toBe(0);
  expect(river.ecology).toBe(1);
  expect(river.recycling).toBeUndefined();
  for (const resources of [river.cost, river.produces, river.consumes]) {
    expect(Object.values(resources).every((value) => value === 0)).toBe(true);
  }
});

test("buildable categories and building types have display labels", () => {
  expect(
    Object.values(BuildingCategories).flatMap((category) =>
      category.buildable ? [category.label] : [],
    ),
  ).toEqual(["Farms", "Residential", "Storage"]);
  expect((Object.keys(BuildingTypes) as BuildingType[]).map(getLabel)).toEqual([
    "Organic homestead",
    "Farm",
    "Agro-industrial Farm",
    "Apartment building",
    "Wood storage",
    undefined,
    undefined,
    undefined,
  ]);
});

const exists = (icon: string) => existsSync(join("public", icon));

test("every buildable category icon refers to an existing file", () => {
  for (const category of Object.values(BuildingCategories)) {
    if (category.buildable) {
      expect(exists(category.icon), category.icon).toBe(true);
    }
  }
});

test("every building type icon refers to an existing file", () => {
  for (const { icon } of Object.values(BuildingTypes)) {
    expect(exists(icon), icon).toBe(true);
  }
});
