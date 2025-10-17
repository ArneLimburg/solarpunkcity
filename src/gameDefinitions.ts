import { emptyResources, type Resources } from "./resources";

export type Model = string;
export type BuildableCategory = {
  name: string;
  buildable: true;
  icon: string;
};
export type NotBuildableCategory = {
  name: string;
  buildable: false;
};
export const BuildingCategories = {
  FARM: {
    name: "FARM",
    buildable: true,
    icon: "farm/farm-icon.png",
  },
  RESIDENTIAL: {
    name: "RESIDENTIAL",
    buildable: true,
    icon: "residential/residential-icon.png",
  },
  FOREST: {
    name: "FOREST",
    buildable: false,
  },
} as const satisfies Record<string, BuildableCategory | NotBuildableCategory>;
export type BuildingCategory = keyof typeof BuildingCategories;
export const BuildingTypes = {
  OrganicHomestead: {
    category: "FARM",
    icon: "farm/farm-icon.png",
    model: "farm/farm.glb",
  },
  Farm: {
    category: "FARM",
    icon: "farm/farm-icon.png",
    model: "farm/farm.glb",
  },
  AgroIndustrial: {
    category: "FARM",
    icon: "farm/farm-icon.png",
    model: "farm/farm.glb",
  },
  AppartmentBuilding: {
    category: "RESIDENTIAL",
    icon: "residential/residential-icon.png",
    model: "residential/residential.glb",
  },
  Forest: {
    category: "FOREST",
    icon: "forest.png",
    model: "forest/forest.glb",
  },
} as const satisfies Record<
  string,
  { category: BuildingCategory; icon: string; model: Model }
>;
export type BuildingType = keyof typeof BuildingTypes;
export type Building = {
  name: string;
  type: BuildingType;
  description: string;
  size: number;
  resident: number;
  cost: Resources;
  produces: Resources;
  consumes: Resources;
  recycling?: Resources;
};
export const BuildingDefinition: Record<BuildingType, Building> = {
  OrganicHomestead: {
    name: "Organic homestead",
    type: "OrganicHomestead",
    description: "Produces food for the residents",
    size: 1,
    resident: 3,
    cost: { ...emptyResources, wood: 4 }, // 40 cu m
    produces: { ...emptyResources, food: 3 },
    consumes: { ...emptyResources, labor: 2 },
  },
  Farm: {
    name: "Farm",
    type: "Farm",
    description: "Produces food for the residents",
    size: 7,
    resident: 2,
    cost: { ...emptyResources, wood: 10 },
    produces: { ...emptyResources, food: 20 },
    consumes: { ...emptyResources, labor: 4 },
  },
  AgroIndustrial: {
    name: "Agro-industrial Farm",
    type: "AgroIndustrial",
    description: "Advanced farming techniques to boost food production",
    size: 19,
    resident: 0,
    cost: { ...emptyResources, wood: 20 },
    produces: { ...emptyResources, food: 60 },
    consumes: { ...emptyResources, labor: 8 },
  },
  Forest: {
    name: "Forest",
    type: "Forest",
    description: "Provides wood for building and crafting",
    size: 1,
    resident: 0,
    cost: { ...emptyResources }, // requires forestry
    produces: { ...emptyResources, wood: 0.2 },
    consumes: { ...emptyResources, labor: 1 }, // later water
    recycling: { ...emptyResources, wood: 7 },
  },
  AppartmentBuilding: {
    name: "Appartment Building",
    type: "AppartmentBuilding",
    description: "Building for people to live",
    size: 1,
    resident: 15,
    cost: { ...emptyResources, wood: 10 },
    produces: emptyResources,
    consumes: { ...emptyResources }, // later water and energy
  },
};
