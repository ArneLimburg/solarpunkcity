import type { Resources } from "./resources";

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
