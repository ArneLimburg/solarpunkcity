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
import { emptyResources } from "../src/resources";

test("construction work and maximum builders of every building", () => {
  const work = (name: keyof typeof BuildingDefinition) => [
    BuildingDefinition[name].cost.labor,
    BuildingDefinition[name].maxBuilders,
  ];
  expect(work("OrganicHomestead")).toEqual([32, 2]);
  expect(work("AppartmentBuilding")).toEqual([240, 6]);
  expect(work("Farm")).toEqual([156, 6]);
  expect(work("AgroIndustrial")).toEqual([520, 10]);
  expect(work("Supermarket")).toEqual([39, 3]);
  expect(work("HydroPowerPlant")).toEqual([120, 4]);
  expect(work("Forest")).toEqual([0, 0]);
  expect(work("WoodStorage")).toEqual([0, 0]);
  expect(work("Sawmill")).toEqual([52, 3]);
});

test("construction takes realistic weeks at full staffing", () => {
  const weeks: Partial<Record<BuildingType, number>> = {
    OrganicHomestead: 16,
    Farm: 26,
    AgroIndustrial: 52,
    Supermarket: 13,
    Sawmill: 18,
    HydroPowerPlant: 30,
    AppartmentBuilding: 40,
  };
  for (const [type, expected] of Object.entries(weeks)) {
    const { cost, maxBuilders } = BuildingDefinition[type as BuildingType];
    expect(Math.ceil(cost.labor / maxBuilders)).toBe(expected);
  }
  for (const { cost, maxBuilders, type } of Object.values(BuildingDefinition)) {
    expect(cost.labor > 0, type).toBe(type in weeks);
    expect(maxBuilders > 0, type).toBe(type in weeks);
  }
});

test("the sawmill and its category", () => {
  const sawmill = BuildingDefinition.Sawmill;
  expect(BuildingCategories.PRODUCTION).toMatchObject({
    buildable: true,
    label: "Production",
    icon: "production/production.svg",
  });
  expect(BuildingTypes.Sawmill).toEqual({
    category: "PRODUCTION",
    icon: "production/sawmill.svg",
    label: "Sawmill",
  });
  expect(sawmill).toMatchObject({
    name: "Sawmill",
    description: "Saws logs into planks",
    size: 1,
    resident: 0,
    ecology: 0,
  });
  expect(sawmill.cost).toEqual({ ...emptyResources, wood: 15, labor: 52 });
  expect(sawmill.consumes).toEqual({
    ...emptyResources,
    wood: 4,
    labor: 2,
    energy: 2,
  });
  expect(BuildingDefinition.AgroIndustrial.consumes.energy).toBe(4);
  expect(sawmill.produces).toEqual({ ...emptyResources, planks: 2 });
  expect(sawmill.storage).toEqual({ ...emptyResources, planks: 20 });
  expect(sawmill.recycling).toEqual({ ...emptyResources, wood: 7 });
});

test("planks replace wood in the costs of the apartment and the agro-industrial farm", () => {
  expect(BuildingDefinition.AppartmentBuilding.cost.planks).toBe(6);
  expect(BuildingDefinition.AgroIndustrial.cost.planks).toBe(40);
  for (const { cost } of Object.values(BuildingDefinition)) {
    expect(cost.wood > 0 && cost.planks > 0).toBe(false);
  }
  expect(BuildingDefinition.AppartmentBuilding.cost.wood).toBe(0);
  expect(BuildingDefinition.AgroIndustrial.cost.wood).toBe(0);
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
  ).toEqual(["Farms", "Residential", "Storage", "Production", "Energy"]);
  expect((Object.keys(BuildingTypes) as BuildingType[]).map(getLabel)).toEqual([
    "Organic homestead",
    "Farm",
    "Agro-industrial Farm",
    "Apartment building",
    "Wood storage",
    "Supermarket",
    "Sawmill",
    "Hydro power plant",
    undefined,
    undefined,
    undefined,
  ]);
});

test("the hydro power plant is a buildable energy building on the river", () => {
  const plant = BuildingDefinition.HydroPowerPlant;
  expect(BuildingCategories.ENERGY).toEqual({
    name: "ENERGY",
    buildable: true,
    icon: "energy/energy.svg",
    label: "Energy",
  });
  expect(BuildingTypes.HydroPowerPlant).toEqual({
    category: "ENERGY",
    icon: "energy/hydro-power-plant.svg",
    label: "Hydro power plant",
  });
  expect(plant).toMatchObject({
    name: "Hydro power plant",
    type: "HydroPowerPlant",
    description: "Turns the flow of the river into energy",
    size: 1,
    resident: 0,
    ecology: -10,
    maxBuilders: 4,
  });
  expect(plant.cost).toEqual({ ...emptyResources, wood: 20, labor: 120 });
  expect(plant.produces).toEqual({ ...emptyResources, energy: 10 });
  expect(plant.consumes).toEqual(emptyResources);
  expect(plant.recycling).toBeUndefined();
  // only sawmills and agro-industrial farms use energy, all others cover it
  // themselves
  for (const { type, produces, consumes } of Object.values(
    BuildingDefinition,
  )) {
    expect(consumes.energy).toBe(
      type === "Sawmill" ? 2 : type === "AgroIndustrial" ? 4 : 0,
    );
    expect(produces.energy).toBe(type === "HydroPowerPlant" ? 10 : 0);
  }
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
  for (const [type, { icon }] of Object.entries(BuildingTypes)) {
    // the icon of the hydro power plant follows in a later ticket
    if (type !== "HydroPowerPlant") {
      expect(exists(icon), icon).toBe(true);
    }
  }
});
