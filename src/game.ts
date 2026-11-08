import {
  completeSites,
  getBuilding,
  getBuildings,
  getPlacedBuilding,
  getPlacedBuildings,
  getConstructionSites,
  workOnSite,
  getFootprint,
  getFootprintRadius,
  getTileBuildings,
  isOnBoard,
  placeBuilding,
  type HexCoordinates,
  type PlacedBuilding,
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
  wood: 10,
  food: 10,
};
let currentResources: Resources = { ...INITIAL_RESOURCES };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;
let currentFoodBalance = 0;

// why a building with production did not produce
export type BuildingStatus = "not-needed" | "no-workers" | "missing-resources";

// what a building did in the last weekly tick
export type BuildingReport = {
  workers: number; // assigned workers
  produced: Resources;
  consumed: Resources; // including labor (= workers)
  status?: BuildingStatus;
};

// reports of the last week by placed building; a replaced or new building has none
let reports = new Map<PlacedBuilding, BuildingReport>();

export function getBuildingReport(
  center: HexCoordinates,
): BuildingReport | undefined {
  const placed = getPlacedBuilding(center);
  return placed && reports.get(placed);
}

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
  let newResources = currentResources;
  for (const tile of getFootprintOf(buildingDefinition, coords)) {
    newResources = addResources(newResources, getBuilding(tile)!.recycling!);
  }
  return hasEnoughResources(newResources, getMaterialCost(buildingDefinition));
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
function getFoodBuildingsByEfficiency(): PlacedBuilding[] {
  // without labor demand the efficiency is Infinity
  const efficiency = ({ building }: PlacedBuilding) =>
    building.produces.food / building.consumes.labor;
  return getPlacedBuildings()
    .filter(({ building }) => building.produces.food > 0)
    .sort((a, b) => efficiency(b) - efficiency(a));
}

function calculateDevelopment() {
  reports = new Map();
  const startPopulation = currentPopulation;
  // labor is not stockpiled: it equals the population
  let labor = startPopulation;

  // food producers get labor before all other buildings, but only as much
  // as this week's demand needs; the food stock stays a buffer
  const harvestFactor = getHarvestFactor();
  let producedFood = 0;
  for (const placed of getFoodBuildingsByEfficiency()) {
    const { building } = placed;
    const needed = building.consumes.labor;
    if (needed === 0) {
      const food = building.produces.food * harvestFactor; // no staff needed
      producedFood += food;
      reports.set(placed, {
        workers: 0,
        produced: { ...emptyResources, food },
        consumed: { ...emptyResources },
      });
      continue;
    }
    const missingFood = startPopulation - producedFood;
    if (missingFood <= 0) {
      // the demand is covered, the remaining buildings get no workers
      reports.set(placed, {
        workers: 0,
        produced: { ...emptyResources },
        consumed: { ...emptyResources },
        status: "not-needed",
      });
      continue;
    }
    const foodPerWorker = building.produces.food / needed;
    const workers = Math.min(
      Math.ceil(missingFood / (foodPerWorker * harvestFactor)),
      needed,
      labor,
    );
    const food = foodPerWorker * workers * harvestFactor;
    producedFood += food;
    labor -= workers;
    reports.set(placed, {
      workers,
      produced: { ...emptyResources, food },
      consumed: { ...emptyResources, labor: workers },
      ...(workers === 0 && { status: "no-workers" as const }),
    });
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

function nonZeroValues(resources: Resources): boolean {
  return Object.values(resources).some((value) => value !== 0);
}

function calculateOtherProductions() {
  // TODO prioritize buildings
  for (const placed of getPlacedBuildings()) {
    const { building } = placed;
    if (building.produces.food > 0) {
      continue; // food is already produced in calculateDevelopment
    }
    if (!hasEnoughResources(currentResources, building.consumes)) {
      // no partial production
      reports.set(placed, {
        workers: 0,
        produced: { ...emptyResources },
        consumed: { ...emptyResources },
        ...(nonZeroValues(building.produces) && {
          status: "missing-resources" as const,
        }),
      });
      continue;
    }
    currentResources = subtractResources(currentResources, building.consumes);
    currentResources = addResources(currentResources, building.produces);
    reports.set(placed, {
      workers: building.consumes.labor,
      produced: { ...building.produces },
      consumed: { ...building.consumes },
    });
  }
}
