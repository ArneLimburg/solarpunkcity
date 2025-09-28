export type Resources = {
  food: number;
  water: number;
  labor: number;
  wood: number;
  ore: number;
  steel: number;
  glass: number;
  hydrogen: number;
  electronics: number;
};
export const emptyResources: Resources = {
  food: 0,
  water: 0,
  labor: 0,
  wood: 0,
  ore: 0,
  steel: 0,
  glass: 0,
  hydrogen: 0,
  electronics: 0,
};
export function addResources(
  resourcesA: Resources,
  resourcesB: Resources,
): Resources {
  return {
    food: resourcesA.food + resourcesB.food,
    water: resourcesA.water + resourcesB.water,
    labor: resourcesA.labor + resourcesB.labor,
    wood: resourcesA.wood + resourcesB.wood,
    ore: resourcesA.ore + resourcesB.ore,
    steel: resourcesA.steel + resourcesB.steel,
    glass: resourcesA.glass + resourcesB.glass,
    hydrogen: resourcesA.hydrogen + resourcesB.hydrogen,
    electronics: resourcesA.electronics + resourcesB.electronics,
  };
}
export function subtractResources(
  resourcesA: Resources,
  resourcesB: Resources,
): Resources {
  return {
    food: resourcesA.food - resourcesB.food,
    water: resourcesA.water - resourcesB.water,
    labor: resourcesA.labor - resourcesB.labor,
    wood: resourcesA.wood - resourcesB.wood,
    ore: resourcesA.ore - resourcesB.ore,
    steel: resourcesA.steel - resourcesB.steel,
    glass: resourcesA.glass - resourcesB.glass,
    hydrogen: resourcesA.hydrogen - resourcesB.hydrogen,
    electronics: resourcesA.electronics - resourcesB.electronics,
  };
}
export function hasEnoughResources(
  available: Resources,
  cost: Resources,
): boolean {
  return (
    available.food >= cost.food &&
    available.water >= cost.water &&
    available.labor >= cost.labor &&
    available.wood >= cost.wood &&
    available.ore >= cost.ore &&
    available.steel >= cost.steel &&
    available.glass >= cost.glass &&
    available.hydrogen >= cost.hydrogen &&
    available.electronics >= cost.electronics
  );
}
