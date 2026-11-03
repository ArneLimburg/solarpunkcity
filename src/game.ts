import {
  getBuilding,
  getBuildings,
  getFootprint,
  getFootprintRadius,
  getTileBuildings,
  isOnBoard,
  placeBuilding,
  type HexCoordinates,
} from "./board";
import {
  BuildingDefinition,
  type Building,
  type BuildingType,
} from "./gameDefinitions";
import {
  addResources,
  emptyResources,
  hasEnoughResources,
  subtractResources,
  type Resources,
} from "./resources";

export const INITIAL_RESOURCES: Resources = { ...emptyResources, wood: 10 };
let currentResources: Resources = { ...INITIAL_RESOURCES };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;

export function canBuild(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  const buildingDefinition = BuildingDefinition[buildingType];
  let newResources = currentResources;
  for (const tile of getFootprintOf(buildingDefinition, coords)) {
    if (!isOnBoard(tile)) {
      return false;
    }
    const oldBuilding = getBuilding(tile);
    if (!oldBuilding?.recycling) {
      return false; // cannot build on top of existing building without recycling
    }
    newResources = addResources(newResources, oldBuilding.recycling);
  }
  return hasEnoughResources(newResources, buildingDefinition.cost);
}

function getFootprintOf(building: Building, center: HexCoordinates) {
  return getFootprint(center, getFootprintRadius(building.size));
}

export function grantResources(resources: Partial<Resources>) {
  currentResources = addResources(currentResources, {
    ...emptyResources,
    ...resources,
  });
}

export function build(buildingType: BuildingType, coords: HexCoordinates) {
  const newBuilding = BuildingDefinition[buildingType];
  let newResources = currentResources;
  for (const tile of getFootprintOf(newBuilding, coords)) {
    const oldBuilding = getBuilding(tile);
    if (oldBuilding && oldBuilding.recycling) {
      newResources = addResources(newResources, oldBuilding.recycling);
    }
  }
  currentResources = subtractResources(newResources, newBuilding.cost);
  placeBuilding(coords, newBuilding);
}

export type GameState = {
  resources: Resources;
  population: number;
  housing: number;
  ecology: number;
  satisfaction: number;
};

export function getState(): GameState {
  return {
    resources: { ...currentResources },
    population: currentPopulation,
    housing: getAvailableHousing(),
    ecology: getEcology(),
    satisfaction: getSatisfaction(),
  };
}

export function calculateWeek(): GameState {
  calculateDevelopment();
  return getState();
}

// ecology in percent, derived from the board: 100 % means all tiles are forest
function getEcology(): number {
  const buildings = getTileBuildings(); // ecology counts per tile
  let sum = 0;
  for (const building of buildings) {
    sum += building.ecology;
  }
  const ecology =
    (sum / (buildings.length * BuildingDefinition.Forest.ecology)) * 100;
  return Math.min(Math.max(ecology, 0), 100);
}

// starting point: satisfaction equals ecology; more factors (food, housing,
// culture) will follow
function getSatisfaction(): number {
  return getEcology();
}

function getHarvestFactor(): number {
  const ecology = getEcology();
  if (ecology >= 90) {
    return 1;
  }
  if (ecology <= 50) {
    return 0.5;
  }
  return 0.5 + ((ecology - 50) / 40) * 0.5;
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
  const harvestFactor = getHarvestFactor();
  let availableLabor = currentPopulation;
  let producedFood = 0;
  // TODO sort building by efficiency
  for (const building of getBuildings()) {
    if (
      building.produces.food > 0 &&
      availableLabor >= building.consumes.labor
    ) {
      producedFood += building.produces.food * harvestFactor;
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
      let growth = Math.ceil(
        (currentPopulation * 0.1 * getSatisfaction()) / 100,
      );
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
  const harvestFactor = getHarvestFactor();
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
      requiredFood -= building.produces.food * harvestFactor;
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
