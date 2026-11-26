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
import { createRoster, syncRoster, type Resident } from "./settlers";

export const INITIAL_RESOURCES: Resources = {
  ...emptyResources,
  wood: 0,
  food: 10,
};
let currentResources: Resources = { ...INITIAL_RESOURCES };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;
// one record per person, in sync with the population
const roster = createRoster(Math.floor(Math.random() * 2 ** 32));
syncRoster(roster, INITIAL_POPULATION);
let currentFoodBalance = 0;
// free labor share of the last weekly tick in percent; the labor factor
// derived from it is what residents judge in the next tick (no previous
// week at game start: 100 %)
let currentFreeLaborShare = 0;
let currentLaborFactor = 100;

// labor factor in percent for a free labor share between 0 and 1: overloaded
// residents (no free time) and unemployed residents are less satisfied
export function getLaborFactor(freeLaborShare: number): number {
  if (freeLaborShare < 0.1) {
    return 50 + (freeLaborShare / 0.1) * 50;
  }
  if (freeLaborShare <= 0.25) {
    return 100;
  }
  if (freeLaborShare >= 0.75) {
    return 0;
  }
  return ((0.75 - freeLaborShare) / 0.5) * 100;
}

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
  const recycledWood =
    getResourcesAfterClearing(building, coords).wood - currentResources.wood;
  const surplus = recycledWood - building.cost.wood;
  // a construction site takes the wood it needs first and never gives it back
  return (
    currentResources.wood +
      (building.cost.labor > 0 ? Math.max(0, surplus) : surplus) <=
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

// the labor of the cost is construction work, it is not paid from the stock;
// the wood of a construction site is delivered week by week, not paid upfront
function getMaterialCost(building: Building): Resources {
  return {
    ...building.cost,
    labor: 0,
    ...(building.cost.labor > 0 && { wood: 0 }),
  };
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
  // the recycled wood goes into the supply of the new site first
  const siteWood =
    newBuilding.cost.labor > 0
      ? Math.min(
          newResources.wood - currentResources.wood,
          newBuilding.cost.wood,
        )
      : 0;
  currentResources = subtractResources(
    newResources,
    getMaterialCost(newBuilding),
  );
  currentResources.wood -= siteWood;
  placeBuilding(coords, newBuilding, newBuilding.cost.labor, siteWood);
}

export type GameState = {
  resources: Resources;
  capacity: Resources;
  population: number;
  residents: Resident[]; // one per person, oldest first
  housing: number;
  ecology: number;
  satisfaction: number;
  freeLaborShare: number; // 0-100, of the last tick
  laborFactor: number; // 0-100, of the last tick
  foodBalance: number;
  constructionSites: number;
  sitesWaitingForWood: number;
  workforce: Workforce | undefined; // of the last tick
};

// how the workers were used in the last weekly tick
export type Workforce = {
  food: number;
  construction: number;
  forestry: number;
  free: number;
};

let currentWorkforce: Workforce | undefined;

// construction sites that got no workers last week only for lack of wood
let sitesWaitingForWood = 0;

// tolerance for floating point remainders of wood
const WOOD_EPSILON = 1e-9;

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
    residents: [...roster.residents],
    housing: getAvailableHousing(),
    ecology: getEcology(),
    satisfaction: getSatisfaction(),
    freeLaborShare: currentFreeLaborShare,
    laborFactor: currentLaborFactor,
    foodBalance: currentFoodBalance,
    constructionSites: getConstructionSites().length,
    sitesWaitingForWood,
    workforce: currentWorkforce && { ...currentWorkforce },
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

// average of ecology and the labor factor of the last week; more factors
// (food, housing, culture) will follow
function getSatisfaction(): number {
  return (getEcology() + currentLaborFactor) / 2;
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
  const foodWorkers = startPopulation - labor;
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
  syncRoster(roster, currentPopulation); // newcomers are added, the newest leave first
  const constructionWorkers = construct(labor);
  currentResources.labor = labor - constructionWorkers;
  const forestryWorkers = calculateOtherProductions();
  currentWorkforce = {
    food: foodWorkers,
    construction: constructionWorkers,
    forestry: forestryWorkers,
    free: currentResources.labor,
  };
  // the free labor is between 0 and the start population
  const freeLaborShare = currentResources.labor / startPopulation;
  currentFreeLaborShare = freeLaborShare * 100;
  currentLaborFactor = getLaborFactor(freeLaborShare);
  // sites finished this week take part from the next week on
  collectCompletedBuildings();
}

// distributes the labor on the construction sites, oldest first; returns the
// labor that was used
function construct(labor: number): number {
  let used = 0;
  sitesWaitingForWood = 0;
  for (const site of getConstructionSites()) {
    const { cost, maxBuilders } = site.building;
    const woodPerWorker = cost.labor > 0 ? cost.wood / cost.labor : 0;
    const possible = Math.min(maxBuilders, site.remainingWork!, labor - used);
    // the own supply and the stock; the stock is only used for this week's work
    const availableWood = site.siteWood! + currentResources.wood;
    const affordable =
      woodPerWorker > 0
        ? Math.floor(availableWood / woodPerWorker + WOOD_EPSILON)
        : Infinity;
    const workers = Math.min(possible, affordable);
    if (possible > 0 && affordable === 0) {
      sitesWaitingForWood++;
    }
    // the last work week uses exactly the remaining wood of the site
    const wood = Math.min(
      workers === site.remainingWork
        ? site.remainingWood!
        : workers * woodPerWorker,
      availableWood,
    );
    const fromSupply = Math.min(wood, site.siteWood!);
    site.siteWood = site.siteWood! - fromSupply;
    currentResources.wood = Math.max(
      0,
      currentResources.wood - (wood - fromSupply),
    );
    site.remainingWood = site.remainingWood! - wood;
    workOnSite(site, workers);
    used += workers;
  }
  return used;
}

// whether any construction site supply or the wood storage has room for wood
function hasWoodRoom(sites: PlacedBuilding[], woodCapacity: number): boolean {
  return (
    currentResources.wood < woodCapacity ||
    sites.some((site) => getFreeSiteWood(site) > WOOD_EPSILON)
  );
}

function getFreeSiteWood(site: PlacedBuilding): number {
  return site.remainingWood! - site.siteWood!;
}

// produced wood goes into the supplies of the construction sites first (oldest
// first, each up to its free space), the rest into the storages
function deliverWood(
  sites: PlacedBuilding[],
  amount: number,
  woodCapacity: number,
) {
  let rest = amount;
  for (const site of sites) {
    const delivered = Math.min(rest, Math.max(0, getFreeSiteWood(site)));
    site.siteWood = site.siteWood! + delivered;
    rest -= delivered;
  }
  currentResources.wood = Math.min(currentResources.wood + rest, woodCapacity);
}

function nonZeroValues(resources: Resources): boolean {
  return Object.values(resources).some((value) => value !== 0);
}

// returns the workers that were assigned
function calculateOtherProductions(): number {
  // TODO prioritize buildings
  let workers = 0;
  const woodCapacity = getCapacity().wood;
  const sites = getConstructionSites(); // oldest first
  for (const placed of getPlacedBuildings()) {
    const { building } = placed;
    if (building.produces.food > 0) {
      continue; // food is already produced in calculateDevelopment
    }
    // forestry stops (and keeps its labor free) when neither a construction
    // site nor the storages have room for the wood
    if (building.produces.wood > 0 && !hasWoodRoom(sites, woodCapacity)) {
      continue;
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
    currentResources = addResources(currentResources, {
      ...building.produces,
      wood: 0,
    });
    if (building.produces.wood > 0) {
      deliverWood(sites, building.produces.wood, woodCapacity);
    }
    workers += building.consumes.labor;
    reports.set(placed, {
      workers: building.consumes.labor,
      produced: { ...building.produces },
      consumed: { ...building.consumes },
    });
  }
  return workers;
}
