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
    buildable: true,
    icon: "energy/energy.svg",
    label: "Energy",
  },
  LEISURE: {
    name: "LEISURE",
    buildable: true,
    icon: "leisure/leisure.svg",
    label: "Leisure",
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
  WoodenHouse: {
    category: "RESIDENTIAL",
    icon: "residential/wooden-house.svg",
    label: "Wooden house",
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
  WindTurbine: {
    category: "ENERGY",
    icon: "energy/wind-turbine.svg",
    label: "Wind turbine",
  },
  SolarField: {
    category: "ENERGY",
    icon: "energy/solar-field.svg",
    label: "Solar field",
  },
  CommunityGarden: {
    category: "LEISURE",
    icon: "leisure/community-garden.svg",
    label: "Community garden",
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
    cost: { ...emptyResources, wood: 4, labor: 32 }, // 40 cu m
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
    cost: { ...emptyResources, wood: 25, labor: 156 },
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
    cost: { ...emptyResources, planks: 40, labor: 520 },
    maxBuilders: 10,
    produces: { ...emptyResources, food: 60 },
    consumes: { ...emptyResources, labor: 8, energy: 4 },
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
    cost: { ...emptyResources, wood: 10, labor: 39 },
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
    cost: { ...emptyResources, wood: 15, labor: 52 },
    maxBuilders: 3,
    produces: { ...emptyResources, planks: 2 },
    consumes: { ...emptyResources, wood: 4, labor: 2, energy: 2 },
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
    // wood, not planks: planks come from sawmills, which need energy
    cost: { ...emptyResources, wood: 20, labor: 120 },
    maxBuilders: 4,
    produces: { ...emptyResources, energy: 10 },
    consumes: { ...emptyResources }, // fully automated
  },
  WindTurbine: {
    name: "Wind turbine",
    type: "WindTurbine",
    description: "Turns the wind into energy",
    size: 1,
    resident: 0,
    ecology: -1, // bird strikes
    // wood, not planks: planks come from sawmills, which need energy
    cost: { ...emptyResources, wood: 10, labor: 80 },
    maxBuilders: 2,
    // 4 energy is about 24 kW continuous: a small turbine of about 100 kW
    // with a capacity factor of 20-30 %. Per 10 energy, hydro needs 20 wood,
    // 120 labor, 1 river tile and changes the ecology by -11; wind needs
    // 25 wood, 200 labor, 2.5 tiles of land and changes it by about -5.
    produces: { ...emptyResources, energy: 4 },
    consumes: { ...emptyResources }, // fully automated
    recycling: { ...emptyResources, wood: 5 },
  },
  SolarField: {
    name: "Solar field",
    type: "SolarField",
    description: "Turns sunlight into energy above a flower meadow",
    size: 1,
    resident: 0,
    ecology: 0.5, // extensive meadow below the panels
    // wood is the timber mounting; the panels count as bought in (glass and
    // electronics have no producer yet)
    cost: { ...emptyResources, wood: 4, labor: 64 },
    maxBuilders: 2,
    // a tile has about 840 m2 (hex side about 18 m), which holds about
    // 85-125 kWp of ground-mounted panels; at about 1,000 kWh per kWp and
    // year that is about 2 MWh per week, i.e. 2 energy. Per 10 energy, hydro
    // needs 1 river tile and changes the ecology by -11; wind 2.5 tiles and
    // about -5; solar 5 tiles and about -2.5 (compared to forest), for 20 wood
    // and 320 labor.
    produces: { ...emptyResources, energy: 2 },
    consumes: { ...emptyResources }, // fully automated
    recycling: { ...emptyResources, wood: 2 },
  },
  CommunityGarden: {
    name: "Community garden",
    type: "CommunityGarden",
    description: "A place where settlers tend raised beds in their free time",
    size: 1,
    resident: 0,
    ecology: 0.5,
    cost: { ...emptyResources, wood: 4, labor: 12 },
    maxBuilders: 2,
    produces: { ...emptyResources },
    consumes: { ...emptyResources },
    recycling: { ...emptyResources, wood: 2 },
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
    cost: { ...emptyResources, planks: 6, labor: 240 },
    maxBuilders: 6,
    produces: emptyResources,
    consumes: { ...emptyResources }, // later water and energy
  },
  WoodenHouse: {
    name: "Wooden house",
    type: "WoodenHouse",
    description:
      "Home for up to 5 people, powered by its own solar panels and wind turbine",
    size: 1,
    resident: 5,
    ecology: 0.3,
    cost: { ...emptyResources, wood: 10, labor: 100 },
    maxBuilders: 4,
    produces: { ...emptyResources },
    consumes: { ...emptyResources }, // supplies itself with energy
    recycling: { ...emptyResources, wood: 5 },
  },
};
