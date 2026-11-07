import { emptyResources, type Resources } from "./resources";

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
    icon: "farm/farm.svg",
  },
  RESIDENTIAL: {
    name: "RESIDENTIAL",
    buildable: true,
    icon: "residential/residential.svg",
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
    icon: "farm/organic-homestead.svg",
  },
  Farm: {
    category: "FARM",
    icon: "farm/farm-medium.svg",
  },
  AgroIndustrial: {
    category: "FARM",
    icon: "farm/agro-industrial.svg",
  },
  AppartmentBuilding: {
    category: "RESIDENTIAL",
    icon: "residential/appartment-building.svg",
  },
  Forest: {
    category: "FOREST",
    icon: "forest/forest.svg",
  },
} as const satisfies Record<
  string,
  { category: BuildingCategory; icon: string }
>;
export type BuildingType = keyof typeof BuildingTypes;
export type Building = {
  name: string;
  type: BuildingType;
  description: string;
  size: number;
  resident: number;
  ecology: number; // per tile, forest is the reference
  cost: Resources; // labor is the construction work in worker-weeks
  maxBuilders: number; // workers per construction site and week
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
    ecology: 0.5,
    cost: { ...emptyResources, wood: 4, labor: 4 }, // 40 cu m
    maxBuilders: 2,
    produces: { ...emptyResources, food: 3 },
    consumes: { ...emptyResources, labor: 2 },
  },
  Farm: {
    name: "Farm",
    type: "Farm",
    description: "Produces food for the residents",
    size: 7,
    resident: 2,
    ecology: 0.2,
    cost: { ...emptyResources, wood: 25, labor: 24 },
    maxBuilders: 6,
    produces: { ...emptyResources, food: 20 },
    consumes: { ...emptyResources, labor: 4 },
  },
  AgroIndustrial: {
    name: "Agro-industrial Farm",
    type: "AgroIndustrial",
    description: "Advanced farming techniques to boost food production",
    size: 19,
    resident: 0,
    ecology: -5,
    cost: { ...emptyResources, wood: 65, labor: 80 },
    maxBuilders: 10,
    produces: { ...emptyResources, food: 60 },
    consumes: { ...emptyResources, labor: 8 },
  },
  Forest: {
    name: "Forest",
    type: "Forest",
    description: "Provides wood for building and crafting",
    size: 1,
    resident: 0,
    ecology: 1,
    cost: { ...emptyResources }, // requires forestry
    maxBuilders: 0,
    produces: { ...emptyResources, wood: 0.5 },
    consumes: { ...emptyResources, labor: 1 }, // later water
    recycling: { ...emptyResources, wood: 3 },
  },
  AppartmentBuilding: {
    name: "Appartment Building",
    type: "AppartmentBuilding",
    description: "Building for people to live",
    size: 1,
    resident: 15,
    ecology: 0,
    cost: { ...emptyResources, wood: 10, labor: 20 },
    maxBuilders: 4,
    produces: emptyResources,
    consumes: { ...emptyResources }, // later water and energy
  },
};
