import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import type { Resources } from "./resources";

function maxRecycling(resource: keyof Resources): number {
  return Math.max(
    0,
    ...Object.values(BuildingDefinition).map(
      (building) => building.recycling?.[resource] ?? 0,
    ),
  );
}

/**
 * Cost resources that cannot be paid even if every tile recycles the most.
 * Labor is construction work done over several weeks, so it is never missing.
 */
export function unaffordableCosts(
  type: BuildingType,
  available: Resources,
): Set<keyof Resources> {
  const { cost, size } = BuildingDefinition[type];
  return new Set(
    nonZeroResources(cost)
      .filter(
        ([name, value]) =>
          name !== "labor" &&
          available[name] + size * maxRecycling(name) < value,
      )
      .map(([name]) => name),
  );
}

export function nonZeroResources(
  resources: Resources,
): [keyof Resources, number][] {
  return (Object.entries(resources) as [keyof Resources, number][]).filter(
    ([, value]) => value !== 0,
  );
}

export function formatEcology(ecology: number): string {
  if (ecology === 0) return "0";
  return (ecology > 0 ? "+" : "−") + Math.abs(ecology);
}

export function formatTiles(size: number): string {
  return size + (size === 1 ? " tile" : " tiles");
}
