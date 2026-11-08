import {
  completeSites,
  getBuilding,
  getBuildings,
  getConstructionSites,
  workOnSite,
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

export const INITIAL_RESOURCES: Resources = {
  ...emptyResources,
  wood: 0,
  food: 10,
};
let currentResources: Resources = { ...INITIAL_RESOURCES };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;
let currentFoodBalance = 0;

// whether the footprint is on the board and free of buildings without recycling
export function canPlace(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  return getFootprintOf(BuildingDefinition[buildingType], coords).every(
    (tile) => isOnBoard(tile) && getBuilding(tile)?.recycling,
  );
}

export function canBuild(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  if (!canPlace(buildingType, coords)) {
    return false;
  }
  const buildingDefinition = BuildingDefinition[buildingType];
  return (
    hasEnoughResources(
      getResourcesAfterClearing(buildingDefinition, coords),
      getMaterialCost(buildingDefinition),
    ) && fitsStorage(buildingType, coords)
  );
}

// the stock plus the recycling of the footprint; the footprint must be placeable
function getResourcesAfterClearing(
  building: Building,
  coords: HexCoordinates,
): Resources {
  let resources = currentResources;
  for (const tile of getFootprintOf(building, coords)) {
    resources = addResources(resources, getBuilding(tile)!.recycling!);
  }
  return resources;
}

// whether the wood that is not used right away fits into the storages (with
// the storage of the new building); the footprint must be placeable
export function fitsStorage(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  const building = BuildingDefinition[buildingType];
  return (
    getResourcesAfterClearing(building, coords).wood - building.cost.wood <=
    getCapacity().wood + (building.storage?.wood ?? 0)
  );
}

// the capacity of a resource is the storage of all finished buildings; only
// wood is capped so far, everything else is unlimited
export function getCapacity(): Resources {
  return getBuildings().reduce(
    (capacity, building) =>
      addResources(capacity, building.storage ?? emptyResources),
    emptyResources,
  );
}

// the labor of the cost is construction work, it is not paid from the stock
function getMaterialCost(building: Building): Resources {
  return { ...building.cost, labor: 0 };
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
  currentResources = subtractResources(
    newResources,
    getMaterialCost(newBuilding),
  );
  placeBuilding(coords, newBuilding, newBuilding.cost.labor);
}

export type GameState = {
  resources: Resources;
  capacity: Resources;
  population: number;
  housing: number;
  ecology: number;
  satisfaction: number;
  foodBalance: number;
  constructionSites: number;
};

// the buildings that were finished by the last weekly tick, not yet taken
let completedBuildings: { coords: HexCoordinates; type: BuildingType }[] = [];

// finishes all construction sites at once (cheat for the e2e tests)
export function finishConstruction() {
  for (const site of getConstructionSites()) {
    workOnSite(site, site.remainingWork!);
  }
  collectCompletedBuildings();
  return takeCompletedBuildings();
}

function collectCompletedBuildings() {
  completedBuildings.push(
    ...completeSites().map((site) => ({
      coords: site.center,
      type: site.building.type,
    })),
  );
}

export function takeCompletedBuildings() {
  const completed = completedBuildings;
  completedBuildings = [];
  return completed;
}

export function getState(): GameState {
  return {
    resources: { ...currentResources },
    capacity: getCapacity(),
    population: currentPopulation,
    housing: getAvailableHousing(),
    ecology: getEcology(),
    satisfaction: getSatisfaction(),
    foodBalance: currentFoodBalance,
    constructionSites: getConstructionSites().length,
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

function getGrowth(): number {
  const growth = Math.min(
    Math.ceil((currentPopulation * 0.1 * getSatisfaction()) / 100),
    getAvailableHousing() - currentPopulation,
    Math.floor(currentResources.food),
  );
  return Math.max(growth, 0);
}

// highest food per worker first; Array.sort is stable, so equal efficiency
// keeps the board order
function getFoodBuildingsByEfficiency(): Building[] {
  // without labor demand the efficiency is Infinity
  const efficiency = (building: Building) =>
    building.produces.food / building.consumes.labor;
  return getBuildings()
    .filter((building) => building.produces.food > 0)
    .sort((a, b) => efficiency(b) - efficiency(a));
}

function calculateDevelopment() {
  const startPopulation = currentPopulation;
  // labor is not stockpiled: it equals the population
  let labor = startPopulation;

  // food producers get labor before all other buildings, but only as much
  // as this week's demand needs; the food stock stays a buffer
  const harvestFactor = getHarvestFactor();
  let producedFood = 0;
  for (const building of getFoodBuildingsByEfficiency()) {
    const needed = building.consumes.labor;
    if (needed === 0) {
      producedFood += building.produces.food * harvestFactor; // no staff needed
      continue;
    }
    const missingFood = startPopulation - producedFood;
    if (missingFood <= 0) {
      break;
    }
    const foodPerWorker = building.produces.food / needed;
    const workers = Math.min(
      Math.ceil(missingFood / (foodPerWorker * harvestFactor)),
      needed,
      labor,
    );
    producedFood += foodPerWorker * workers * harvestFactor;
    labor -= workers;
  }
  // TODO food should spoil later; storage buildings (storage capacity) may be needed
  const availableFood = currentResources.food + producedFood;
  currentFoodBalance = producedFood - startPopulation;

  if (availableFood < startPopulation) {
    // hunger: the stock is eaten up and the population shrinks, no growth
    currentResources.food = 0;
    currentPopulation = Math.max(1, Math.floor(availableFood));
    labor = Math.min(labor, currentPopulation);
  } else {
    currentResources.food = availableFood - startPopulation;
    currentPopulation += getGrowth(); // new residents work from next week on
  }
  currentResources.labor = labor - construct(labor);
  calculateOtherProductions();
  // sites finished this week take part from the next week on
  collectCompletedBuildings();
}

// distributes the labor on the construction sites, oldest first; returns the
// labor that was used
function construct(labor: number): number {
  let used = 0;
  for (const site of getConstructionSites()) {
    const workers = Math.min(
      site.building.maxBuilders,
      site.remainingWork!,
      labor - used,
    );
    workOnSite(site, workers);
    used += workers;
  }
  return used;
}

function calculateOtherProductions() {
  // TODO prioritize buildings
  const woodCapacity = getCapacity().wood;
  for (const building of getBuildings()) {
    if (building.produces.food > 0) {
      continue; // food is already produced in calculateDevelopment
    }
    // forestry stops (and keeps its labor free) when the storages are full
    if (building.produces.wood > 0 && currentResources.wood >= woodCapacity) {
      continue;
    }
    if (!hasEnoughResources(currentResources, building.consumes)) {
      continue; // no partial production
    }
    currentResources = subtractResources(currentResources, building.consumes);
    currentResources = addResources(currentResources, building.produces);
    if (building.produces.wood > 0) {
      currentResources.wood = Math.min(currentResources.wood, woodCapacity);
    }
  }
}
