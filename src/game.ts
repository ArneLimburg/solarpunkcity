import {
  getBuilding,
  getBuildings,
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
let currentPopulation = 1;

export function canBuild(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
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
    if (building.produces.food > 0) {
      producedFood += building.produces.food;
      availableLabor -= building.consumes.labor;
    }
    if (availableLabor <= 0) {
      break;
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
  let laborForFood = 0;
  // TODO sort building by efficiency
  for (const building of getBuildings()) {
    if (building.produces.food > 0) {
      requiredFood -= building.produces.food;
      laborForFood += building.consumes.labor;
    }
    if (requiredFood <= 0) {
      break;
    }
  }
  return laborForFood;
}

function calculateDevelopment() {
  let availableLabor = currentPopulation;
  currentPopulation += getGrowth(); // growth depends on available housing and potential food production
  const laborForFood = getLaborForFood(); // only as much food as required is produced
  availableLabor -= laborForFood;
  if (availableLabor > 0) {
    // if everybody is fed up, use remaining labor for other productions
    currentResources.labor = availableLabor;
    calculateOtherProductions();
  }
}

function calculateOtherProductions() {
  // TODO prioritize buildings
  for (const building of getBuildings()) {
    if (building.produces.food > 0) {
      continue; // food is already produced in getPotentialProducedFood
    }
    currentResources = addResources(currentResources, building.produces);
    currentResources = subtractResources(currentResources, building.consumes);
    if (currentResources.labor <= 0) {
      currentResources.labor = 0;
      break;
    }
  }
}
