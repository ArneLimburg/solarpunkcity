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
    model: "forest.glb",
  },
} as const satisfies Record<
  string,
  { category: BuildingCategory; icon: string; model: Model }
>;
export type BuildingType = keyof typeof BuildingTypes;
