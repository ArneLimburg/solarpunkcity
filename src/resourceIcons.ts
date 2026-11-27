import type { Resources } from "./resources";

export const resourceIcons: Record<keyof Resources, string> = {
  food: "restaurant",
  water: "water_drop",
  labor: "engineering",
  wood: "forest",
  planks: "carpenter",
  ore: "diamond",
  steel: "hardware",
  glass: "window",
  hydrogen: "bolt",
  electronics: "memory",
  energy: "electric_bolt",
};

// resources shown as stock in the status bar, in display order
export const stockResources = [
  "wood",
  "planks",
  "ore",
  "steel",
  "glass",
  "hydrogen",
  "electronics",
] as const satisfies (keyof Resources)[];
