import {
  getBuilding,
  getBuildings,
  isOnBoard,
  setBuilding,
  type HexCoordinates,
} from "./board";
import { BuildingDefinition, type BuildingType } from "./gameDefinitions";
import {
  addResources,
  emptyResources,
  hasEnoughResources,
  subtractResources,
  type Resources,
} from "./resources";

let currentResources: Resources = { ...emptyResources };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;

export function canBuild(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  if (!isOnBoard(coords)) {
    return false;
  }
  const oldBuilding = getBuilding(coords);
  if (oldBuilding && !oldBuilding.recycling) {
    return false; // cannot build on top of existing building without recycling
  }
  const buildingDefinition = BuildingDefinition[buildingType];
  let newResources = currentResources;
  if (oldBuilding && oldBuilding.recycling) {
    newResources = addResources(newResources, oldBuilding.recycling);
  }
  return hasEnoughResources(newResources, buildingDefinition.cost);
}

export function grantResources(resources: Partial<Resources>) {
  currentResources = addResources(currentResources, {
    ...emptyResources,
    ...resources,
  });
}

export function build(buildingType: BuildingType, coords: HexCoordinates) {
  const oldBuilding = getBuilding(coords);
  const newBuilding = BuildingDefinition[buildingType];
  let newResources = currentResources;
  if (oldBuilding && oldBuilding.recycling) {
    newResources = addResources(newResources, oldBuilding.recycling);
  }
  currentResources = subtractResources(newResources, newBuilding.cost);
  setBuilding(coords, newBuilding);
}

export function calculateWeek(): { resources: Resources; population: number } {
  calculateDevelopment();
  return { resources: currentResources, population: currentPopulation };
}

function getAvailableHousing(): number {
  let availableHousing = 0;
  for (const building of getBuildings()) {
    availableHousing += building.resident;
  }
  return availableHousing;
}

// calculate how much food could be produced with current population as labor
function getPotentialProducedFood(): number {
  let availableLabor = currentPopulation;
  let producedFood = 0;
  // TODO sort building by efficiency
  for (const building of getBuildings()) {
    if (
      building.produces.food > 0 &&
      availableLabor >= building.consumes.labor
    ) {
      producedFood += building.produces.food;
      availableLabor -= building.consumes.labor;
    }
  }
  return producedFood;
}

function getGrowth(): number {
  const availableHousing = getAvailableHousing();
  if (availableHousing > currentPopulation) {
    const producedFood = getPotentialProducedFood();
    if (producedFood > currentPopulation) {
      let growth = Math.ceil(currentPopulation * 0.1);
      if (currentPopulation + growth > availableHousing) {
        growth = availableHousing - currentPopulation;
      }
      if (currentPopulation + growth > producedFood) {
        growth = producedFood - currentPopulation;
      }
      return growth;
    } else {
      // TODO shrink population if not enough food
      return 0;
    }
  } else {
    return 0;
  }
}

function getLaborForFood(): number {
  let requiredFood = currentPopulation;
  let availableLabor = currentPopulation;
  let laborForFood = 0;
  // TODO sort building by efficiency
  for (const building of getBuildings()) {
    if (requiredFood <= 0) {
      break;
    }
    if (
      building.produces.food > 0 &&
      availableLabor >= building.consumes.labor
    ) {
      requiredFood -= building.produces.food;
      availableLabor -= building.consumes.labor;
      laborForFood += building.consumes.labor;
    }
  }
  return laborForFood;
}

function calculateDevelopment() {
  currentPopulation += getGrowth(); // growth depends on available housing and potential food production
  const laborForFood = getLaborForFood(); // only as much food as required is produced
  // labor is not stockpiled: the grown population minus labor for food is available
  currentResources.labor = Math.max(currentPopulation - laborForFood, 0);
  calculateOtherProductions();
}

function calculateOtherProductions() {
  // TODO prioritize buildings
  for (const building of getBuildings()) {
    if (building.produces.food > 0) {
      continue; // food is already produced in getPotentialProducedFood
    }
    if (!hasEnoughResources(currentResources, building.consumes)) {
      continue; // no partial production
    }
    currentResources = subtractResources(currentResources, building.consumes);
    currentResources = addResources(currentResources, building.produces);
  }
}
