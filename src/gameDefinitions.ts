import { emptyResources, type Resources } from "./resources";

export type BuildableCategory = {
  name: string;
  buildable: true;
  icon: string;
  label: string;
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
    label: "Farms",
  },
  RESIDENTIAL: {
    name: "RESIDENTIAL",
    buildable: true,
    icon: "residential/residential.svg",
    label: "Residential",
  },
  STORAGE: {
    name: "STORAGE",
    buildable: true,
    icon: "storage/storage.svg",
    label: "Storage",
  },
  PRODUCTION: {
    name: "PRODUCTION",
    buildable: true,
    icon: "production/production.svg",
    label: "Production",
  },
  ENERGY: {
    name: "ENERGY",
    buildable: false,
  },
  FOREST: {
    name: "FOREST",
    buildable: false,
  },
  CAMP: {
    name: "CAMP",
    buildable: false,
  },
  WATER: {
    name: "WATER",
    buildable: false,
  },
} as const satisfies Record<string, BuildableCategory | NotBuildableCategory>;
export type BuildingCategory = keyof typeof BuildingCategories;
export const BuildingTypes = {
  OrganicHomestead: {
    category: "FARM",
    icon: "farm/organic-homestead.svg",
    label: "Organic homestead",
  },
  Farm: {
    category: "FARM",
    icon: "farm/farm-medium.svg",
    label: "Farm",
  },
  AgroIndustrial: {
    category: "FARM",
    icon: "farm/agro-industrial.svg",
    label: "Agro-industrial Farm",
  },
  AppartmentBuilding: {
    category: "RESIDENTIAL",
    icon: "residential/appartment-building.svg",
    label: "Apartment building",
  },
  WoodStorage: {
    category: "STORAGE",
    icon: "storage/wood-storage.svg",
    label: "Wood storage",
  },
  Supermarket: {
    category: "STORAGE",
    icon: "storage/supermarket.svg",
    label: "Supermarket",
  },
  Sawmill: {
    category: "PRODUCTION",
    icon: "production/sawmill.svg",
    label: "Sawmill",
  },
  HydroPowerPlant: {
    category: "ENERGY",
    icon: "energy/hydro-power-plant.svg",
    label: "Hydro power plant",
  },
  Forest: {
    category: "FOREST",
    icon: "forest/forest.svg",
  },
  SettlersCamp: {
    category: "CAMP",
    icon: "camp/settlers-camp.svg",
  },
  River: {
    category: "WATER",
    icon: "water/river.svg",
  },
} as const satisfies Record<
  string,
  { category: BuildingCategory; icon: string; label?: string }
>;
export type BuildingType = keyof typeof BuildingTypes;

// the label of a buildable type or category; other types have none
export function getLabel(type: BuildingType): string | undefined {
  return (BuildingTypes[type] as { label?: string }).label;
}
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
  // capacity the building adds; only wood, planks and food are capped
  storage?: Resources;
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
    cost: { ...emptyResources, planks: 40, labor: 80 },
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
  WoodStorage: {
    name: "Wood storage",
    type: "WoodStorage",
    description: "Stores up to 100 wood from clearing and forestry",
    size: 1,
    resident: 0,
    ecology: 0,
    cost: { ...emptyResources }, // finished immediately: no labor
    maxBuilders: 0,
    produces: { ...emptyResources },
    consumes: { ...emptyResources },
    storage: { ...emptyResources, wood: 100 },
  },
  Supermarket: {
    name: "Supermarket",
    type: "Supermarket",
    description:
      "Keeps up to 100 food in stock as a reserve against bad harvests",
    size: 1,
    resident: 0,
    ecology: 0,
    cost: { ...emptyResources, wood: 10, labor: 6 },
    maxBuilders: 3,
    produces: { ...emptyResources },
    consumes: { ...emptyResources },
    storage: { ...emptyResources, food: 100 },
    recycling: { ...emptyResources, wood: 5 },
  },
  Sawmill: {
    name: "Sawmill",
    type: "Sawmill",
    description: "Saws logs into planks",
    size: 1,
    resident: 0,
    ecology: 0,
    cost: { ...emptyResources, wood: 15, labor: 10 },
    maxBuilders: 3,
    produces: { ...emptyResources, planks: 2 },
    consumes: { ...emptyResources, wood: 4, labor: 2 },
    storage: { ...emptyResources, planks: 20 },
    recycling: { ...emptyResources, wood: 7 },
  },
  HydroPowerPlant: {
    name: "Hydro power plant",
    type: "HydroPowerPlant",
    description: "Turns the flow of the river into energy",
    size: 1,
    resident: 0,
    ecology: -10, // the weir blocks the whole width of the river
    // wood, not planks: planks come from sawmills, which will need energy
    cost: { ...emptyResources, wood: 20, labor: 15 },
    maxBuilders: 3,
    produces: { ...emptyResources, energy: 10 },
    consumes: { ...emptyResources }, // fully automated
  },
  SettlersCamp: {
    name: "Settlers' camp",
    type: "SettlersCamp",
    description: "Tents and garden of the first settlers",
    size: 1,
    resident: 2,
    ecology: 0,
    cost: { ...emptyResources },
    maxBuilders: 0,
    produces: { ...emptyResources, food: 2 },
    consumes: { ...emptyResources },
    recycling: { ...emptyResources },
  },
  River: {
    name: "River",
    type: "River",
    description: "Fresh water flowing from the mountains to the sea",
    size: 1,
    resident: 0,
    ecology: 1,
    cost: { ...emptyResources },
    maxBuilders: 0,
    produces: { ...emptyResources },
    consumes: { ...emptyResources },
  },
  AppartmentBuilding: {
    name: "Appartment Building",
    type: "AppartmentBuilding",
    description: "Building for people to live",
    size: 1,
    resident: 15,
    ecology: 0,
    cost: { ...emptyResources, planks: 6, labor: 20 },
    maxBuilders: 4,
    produces: emptyResources,
    consumes: { ...emptyResources }, // later water and energy
  },
};
