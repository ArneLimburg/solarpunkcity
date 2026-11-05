import type { Resources } from "./resources";

export const resourceIcons: Record<keyof Resources, string> = {
  food: "restaurant",
  water: "water_drop",
  labor: "engineering",
  wood: "forest",
  ore: "diamond",
  steel: "hardware",
  glass: "window",
  hydrogen: "bolt",
  electronics: "memory",
};

// resources shown as stock in the status bar, in display order
export const stockResources = [
  "wood",
  "ore",
  "steel",
  "glass",
  "hydrogen",
  "electronics",
] as const satisfies (keyof Resources)[];
