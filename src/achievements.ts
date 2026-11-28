import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import { emptyResources, type Resources } from "./resources";

export type Resource = keyof Resources;

const RESOURCES = Object.keys(emptyResources) as Resource[];

// the resources a settlement has from the start
export const INITIAL_ACHIEVED: readonly Resource[] = ["wood", "food", "labor"];

// what a settlement needs to have had to produce a resource
const producers: Record<Resource, string> = {
  food: "a farm",
  water: "a well",
  labor: "settlers",
  wood: "a forest",
  planks: "a sawmill",
  ore: "a mine",
  steel: "a steelworks",
  glass: "a glassworks",
  hydrogen: "an electrolyzer",
  electronics: "a factory",
  energy: "a power plant",
};

// the resources a finished building produces
export function getProducedResources(type: BuildingType): Resource[] {
  const { produces } = BuildingDefinition[type];
  return RESOURCES.filter((resource) => produces[resource] > 0);
}

// the resources a building type needs: those of its cost and consumption
export function getRequiredResources(type: BuildingType): Resource[] {
  const { cost, consumes } = BuildingDefinition[type];
  return RESOURCES.filter(
    (resource) => cost[resource] + consumes[resource] > 0,
  );
}

// a building type is unlocked once all resources it needs are achieved
export function isUnlocked(
  type: BuildingType,
  achieved: ReadonlySet<Resource>,
): boolean {
  return getRequiredResources(type).every((resource) => achieved.has(resource));
}

// why a building type is locked ("Needs a sawmill and a power plant"),
// undefined if it is unlocked
export function getLockReason(
  type: BuildingType,
  achieved: ReadonlySet<Resource>,
): string | undefined {
  const missing = getRequiredResources(type).filter(
    (resource) => !achieved.has(resource),
  );
  return missing.length > 0
    ? `Needs ${missing.map((resource) => producers[resource]).join(" and ")}`
    : undefined;
}
