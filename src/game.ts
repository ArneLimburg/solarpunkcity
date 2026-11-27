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
import { assignHomes, getOccupantIds, type Assignments } from "./housing";
import { createRoster, syncRoster, type Resident } from "./settlers";
import type { WorkSlot } from "./tasks";

export const INITIAL_RESOURCES: Resources = {
  ...emptyResources,
  wood: 0,
  food: 0,
};
let currentResources: Resources = { ...INITIAL_RESOURCES };
export const INITIAL_POPULATION = 2;
let currentPopulation = INITIAL_POPULATION;
// one record per person, in sync with the population
const roster = createRoster(Math.floor(Math.random() * 2 ** 32));
syncRoster(roster, INITIAL_POPULATION);
// the home of every housed resident (resident ID -> placed building)
const homes: Assignments = new Map();

// brings the home assignments in line with the roster and the finished
// buildings; called whenever one of them changes
function updateHomes() {
  assignHomes(
    homes,
    roster.residents.map(({ id }) => id),
    getPlacedBuildings().filter(({ building }) => building.resident > 0),
  );
}
updateHomes();

// the home of a resident, undefined if they are unhoused
export function getHome(residentId: number): PlacedBuilding | undefined {
  return homes.get(residentId);
}

// the residents who live in a placed building, in arrival order
export function getOccupants(home: PlacedBuilding): Resident[] {
  const ids = new Set(getOccupantIds(homes, home));
  return roster.residents.filter(({ id }) => ids.has(id));
}
let currentFoodBalance = 0;
let currentWeek = 0;
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

// consumers that got no energy in the current weekly tick
let unpoweredBuildings = new Set<PlacedBuilding>();

// reports of the last week by placed building; a replaced or new building has none
let reports = new Map<PlacedBuilding, BuildingReport>();

// the workers per construction site of the last weekly tick
let siteWorkers = new Map<PlacedBuilding, number>();

// the work slot of a placed building: its footprint and `workers` places
export function toWorkSlot(placed: PlacedBuilding, workers: number): WorkSlot {
  return {
    key: `${placed.center.q},${placed.center.r}`,
    tiles: getFootprint(
      placed.center,
      getFootprintRadius(placed.building.size),
    ),
    workers,
  };
}

// the places the last weekly tick staffed (buildings and construction sites);
// settlers walk to them, the numbers are those of the building reports
export function getWorkSlots(): WorkSlot[] {
  const slots: WorkSlot[] = [];
  for (const [placed, { workers }] of reports) {
    if (workers > 0) {
      slots.push(toWorkSlot(placed, workers));
    }
  }
  for (const [site, workers] of siteWorkers) {
    slots.push(toWorkSlot(site, workers));
  }
  return slots;
}

export function getBuildingReport(
  center: HexCoordinates,
): BuildingReport | undefined {
  const placed = getPlacedBuilding(center);
  return placed && reports.get(placed);
}

// the builders of the last weekly tick by construction site; a site placed
// since then has none
let siteBuilders = new Map<PlacedBuilding, number>();

// how far a construction site is
export type ConstructionReport = {
  percent: number; // completed work, rounded down
  remainingWork: number; // worker-weeks
  builders: number; // assigned in the last completed week
  weeks?: number; // estimate at that work rate, only with builders
};

// the progress of the construction site at a center, undefined for a finished
// building
export function getConstructionReport(
  center: HexCoordinates,
): ConstructionReport | undefined {
  const placed = getPlacedBuilding(center);
  if (!placed || placed.remainingWork === undefined) {
    return undefined;
  }
  const { remainingWork } = placed;
  const builders = siteBuilders.get(placed) ?? 0;
  const total = placed.building.cost.labor;
  return {
    percent: Math.floor(((total - remainingWork) / total) * 100),
    remainingWork,
    builders,
    ...(builders > 0 && { weeks: Math.ceil(remainingWork / builders) }),
  };
}

// the wood a finished storage holds: the stock fills the storages in placement
// order up to their capacity, what is above the capacity of all of them stays
// with the last one, so the shown stocks add up to the stock
export function getStoredWood(center: HexCoordinates): number {
  const storages = getPlacedBuildings()
    .filter(({ building }) => (building.storage?.wood ?? 0) > 0)
    .sort((a, b) => a.sequence - b.sequence);
  let rest = currentResources.wood;
  for (const [index, storage] of storages.entries()) {
    const isLast = index === storages.length - 1;
    const stored = isLast
      ? rest
      : Math.min(rest, storage.building.storage!.wood);
    if (sameTile(storage.center, center)) {
      return stored;
    }
    rest -= stored;
  }
  return 0;
}

function sameTile(a: HexCoordinates, b: HexCoordinates): boolean {
  return a.q === b.q && a.r === b.r;
}

// the harvest of the fields in percent (ecology dependent), separate from what
// a farm actually produced
export function getFieldEfficiency(): number {
  return Math.round(getHarvestFactor() * 100);
}

// whether the footprint is on the board and free of buildings without recycling
export function canPlace(
  buildingType: BuildingType,
  coords: HexCoordinates,
): boolean {
  // a hydro power plant needs the river; all other buildings need tiles with
  // recycling, which the river and the plant itself do not have
  const isHydro = buildingType === "HydroPowerPlant";
  return getFootprintOf(BuildingDefinition[buildingType], coords).every(
    (tile) =>
      isOnBoard(tile) &&
      (isHydro
        ? getBuilding(tile)?.type === "River"
        : getBuilding(tile)?.recycling),
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
  return hasEnoughResources(
    getResourcesAfterClearing(buildingDefinition, coords),
    getMaterialCost(buildingDefinition),
  );
}

// the stock plus the recycling of the footprint; the footprint must be placeable
function getResourcesAfterClearing(
  building: Building,
  coords: HexCoordinates,
): Resources {
  let resources = currentResources;
  for (const tile of getFootprintOf(building, coords)) {
    resources = addResources(
      resources,
      getBuilding(tile)!.recycling ?? emptyResources,
    );
  }
  return resources;
}

// the capacity of a resource is the storage of all finished buildings; wood,
// planks and food are capped, everything else is unlimited
export function getCapacity(): Resources {
  return getBuildings().reduce(
    (capacity, building) =>
      addResources(capacity, building.storage ?? emptyResources),
    emptyResources,
  );
}

// the labor of the cost is construction work, it is not paid from the stock;
// the wood or planks of a construction site are delivered week by week, not
// paid upfront
function getMaterialCost(building: Building): Resources {
  return {
    ...building.cost,
    labor: 0,
    ...(building.cost.labor > 0 && { wood: 0, planks: 0 }),
  };
}

type Material = "wood" | "planks";

// the material a construction site uses: planks if the building costs planks
// (no building costs both), otherwise wood
function getMaterial(building: Building): Material {
  return building.cost.planks > 0 ? "planks" : "wood";
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
  const recycledWood = newResources.wood - currentResources.wood - siteWood;
  const costWood = getMaterialCost(newBuilding).wood;
  const paidFromRecycled = Math.min(recycledWood, costWood);
  // the recycled wood that is neither used for the site nor the cost
  const surplusWood = recycledWood - paidFromRecycled;
  const capacityBefore = getCapacity();
  currentResources = subtractResources(
    newResources,
    getMaterialCost(newBuilding),
  );
  currentResources.wood -= surplusWood + siteWood;
  placeBuilding(coords, newBuilding, newBuilding.cost.labor, siteWood);
  updateHomes(); // occupants of a replaced home move out immediately
  const capacity = getCapacity();
  // a replaced storage takes its capacity with it; wood and planks above the
  // new capacity are lost
  if (capacity.wood < capacityBefore.wood) {
    currentResources.wood = Math.min(currentResources.wood, capacity.wood);
  }
  currentResources.planks = Math.min(currentResources.planks, capacity.planks);
  currentResources.food = Math.min(currentResources.food, capacity.food);
  // the surplus wood goes to the other sites, the sawmills and the storage;
  // the rest is lost
  const sawmills = getPlacedBuildings()
    .filter(({ building }) => building.produces.planks > 0)
    .sort((a, b) => a.sequence - b.sequence);
  const sites = getConstructionSites().filter(
    (site) => getMaterial(site.building) === "wood",
  );
  deliver(
    sites,
    sawmills,
    "wood",
    surplusWood,
    Math.max(capacity.wood, currentResources.wood),
  );
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
  sitesWaitingForWood: number; // waiting for wood or planks
  workforce: Workforce | undefined; // of the last tick
  week: number; // completed weekly ticks, 0 for a new settlement
  energyProduced: number; // of the last tick
  energyUsed: number; // of the last tick
  buildingsWithoutEnergy: number; // consumers without energy in the last tick
};

// how the workers were used in the last weekly tick
export type Workforce = {
  food: number;
  construction: number;
  production: number; // sawmills
  forestry: number;
  free: number;
};

let currentWorkforce: Workforce | undefined;

let currentEnergyProduced = 0;
let currentEnergyUsed = 0;
let currentBuildingsWithoutEnergy = 0;

// construction sites that got no workers last week only for lack of material
// (wood or planks)
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
  updateHomes(); // completed homes take unhoused residents
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
    week: currentWeek,
    energyProduced: currentEnergyProduced,
    energyUsed: currentEnergyUsed,
    buildingsWithoutEnergy: currentBuildingsWithoutEnergy,
  };
}

export type EnergyDistribution = {
  produced: number;
  used: number;
  surplus: number; // produced - used
  deficit: number; // demand of the consumers without energy
  unpowered: Set<PlacedBuilding>; // consumers that got no energy
};

// distributes the energy of this week to the finished buildings that consume
// energy: food producers first, then all others, each group in placement
// order; a consumer gets its full demand or nothing (no partial supply).
// Batteries will later charge from the surplus and discharge into the deficit.
export function distributeEnergy(): EnergyDistribution {
  const finished = getPlacedBuildings();
  let produced = 0;
  for (const { building } of finished) {
    produced += building.produces.energy;
  }
  const isFood = ({ building }: PlacedBuilding) => building.produces.food > 0;
  const consumers = finished
    .filter(({ building }) => building.consumes.energy > 0)
    .sort(
      (a, b) =>
        Number(isFood(b)) - Number(isFood(a)) || a.sequence - b.sequence,
    );
  let remaining = produced;
  let deficit = 0;
  const unpowered = new Set<PlacedBuilding>();
  for (const consumer of consumers) {
    const demand = consumer.building.consumes.energy;
    if (demand <= remaining) {
      remaining -= demand;
    } else {
      deficit += demand;
      unpowered.add(consumer);
    }
  }
  return {
    produced,
    used: produced - remaining,
    surplus: remaining,
    deficit,
    unpowered,
  };
}

export function calculateWeek(): GameState {
  calculateDevelopment();
  currentWeek++;
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

// growth that satisfaction and housing allow, regardless of food
function getPossibleGrowth(): number {
  const growth = Math.min(
    Math.ceil((currentPopulation * 0.1 * getSatisfaction()) / 100),
    getAvailableHousing() - currentPopulation,
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

  // energy is a weekly flow: only the surplus of this week is left
  const energy = distributeEnergy();
  unpoweredBuildings = energy.unpowered;
  currentEnergyProduced = energy.produced;
  currentEnergyUsed = energy.used;
  currentBuildingsWithoutEnergy = energy.unpowered.size;
  currentResources.energy = energy.surplus;

  // food producers get labor before all other buildings, but only as much
  // as this week's demand and the possible growth need; the food stock
  // stays a buffer
  const harvestFactor = getHarvestFactor();
  let producedFood = 0;
  // demand plus the growth or the free storage space (whichever is more) that
  // the food stock does not cover
  const possibleGrowth = getPossibleGrowth();
  const foodCapacity = getCapacity().food;
  const foodTarget =
    startPopulation +
    Math.max(0, Math.max(possibleGrowth, foodCapacity) - currentResources.food);
  for (const placed of getFoodBuildingsByEfficiency()) {
    const { building } = placed;
    const needed = building.consumes.labor;
    if (unpoweredBuildings.has(placed)) {
      reports.set(placed, {
        workers: 0,
        produced: { ...emptyResources },
        consumed: { ...emptyResources },
        status: "missing-resources",
      });
      continue;
    }
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
    const missingFood = foodTarget - producedFood;
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
  // TODO food should spoil later
  const foodWorkers = startPopulation - labor;
  const availableFood = currentResources.food + producedFood;
  currentFoodBalance = producedFood - startPopulation;

  if (availableFood < startPopulation) {
    // hunger: the stock is eaten up and the population shrinks, no growth
    currentResources.food = 0;
    currentPopulation = Math.max(1, Math.floor(availableFood));
    labor = Math.min(labor, currentPopulation);
  } else {
    const leftFood = availableFood - startPopulation;
    // new residents work from next week on; growth looks at the food before
    // capping, the food above the capacity is lost
    currentPopulation += Math.min(possibleGrowth, Math.floor(leftFood));
    currentResources.food = Math.min(leftFood, foodCapacity);
  }
  syncRoster(roster, currentPopulation, currentWeek + 1); // newcomers are added, the newest leave first
  updateHomes();
  const constructionWorkers = construct(labor);
  currentResources.labor = labor - constructionWorkers;
  const { production, forestry } = calculateOtherProductions();
  currentWorkforce = {
    food: foodWorkers,
    construction: constructionWorkers,
    production,
    forestry,
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
  siteBuilders = new Map();
  siteWorkers = new Map();
  for (const site of getConstructionSites()) {
    const { cost, maxBuilders } = site.building;
    const material = getMaterial(site.building);
    const perWorker = cost.labor > 0 ? cost[material] / cost.labor : 0;
    const possible = Math.min(maxBuilders, site.remainingWork!, labor - used);
    // the own supply and the stock; the stock is only used for this week's work
    const available = site.siteWood! + currentResources[material];
    const affordable =
      perWorker > 0
        ? Math.floor(available / perWorker + WOOD_EPSILON)
        : Infinity;
    const workers = Math.min(possible, affordable);
    if (possible > 0 && affordable === 0) {
      sitesWaitingForWood++;
    }
    // the last work week uses exactly the remaining material of the site
    const amount = Math.min(
      workers === site.remainingWork
        ? site.remainingWood!
        : workers * perWorker,
      available,
    );
    const fromSupply = Math.min(amount, site.siteWood!);
    site.siteWood = site.siteWood! - fromSupply;
    currentResources[material] = Math.max(
      0,
      currentResources[material] - (amount - fromSupply),
    );
    site.remainingWood = site.remainingWood! - amount;
    workOnSite(site, workers);
    siteBuilders.set(site, workers);
    if (workers > 0) {
      siteWorkers.set(site, workers);
    }
    used += workers;
  }
  return used;
}

function getFreeSiteMaterial(site: PlacedBuilding): number {
  return site.remainingWood! - site.siteWood!;
}

// the wood supply of a sawmill holds one week's consumption
function getFreeSawmillWood(sawmill: PlacedBuilding): number {
  return sawmill.building.consumes.wood - (sawmill.sawmillWood ?? 0);
}

// whether any construction site supply, sawmill supply (wood only) or the
// storage of the material has room
function hasRoom(
  sites: PlacedBuilding[],
  sawmills: PlacedBuilding[],
  material: Material,
  capacity: number,
): boolean {
  return (
    currentResources[material] < capacity ||
    sites.some((site) => getFreeSiteMaterial(site) > WOOD_EPSILON) ||
    sawmills.some((sawmill) => getFreeSawmillWood(sawmill) > WOOD_EPSILON)
  );
}

// produced wood or planks go into the supplies of the construction sites that
// use them first (oldest first, each up to its free space), the rest into the
// storages, capped by the capacity; wood goes into the supplies of the
// sawmills (placement order) between the sites and the storage
function deliver(
  sites: PlacedBuilding[],
  sawmills: PlacedBuilding[],
  material: Material,
  amount: number,
  capacity: number,
) {
  let rest = amount;
  for (const site of sites) {
    const delivered = Math.min(rest, Math.max(0, getFreeSiteMaterial(site)));
    site.siteWood = site.siteWood! + delivered;
    rest -= delivered;
  }
  for (const sawmill of sawmills) {
    const delivered = Math.min(rest, Math.max(0, getFreeSawmillWood(sawmill)));
    sawmill.sawmillWood = (sawmill.sawmillWood ?? 0) + delivered;
    rest -= delivered;
  }
  currentResources[material] = Math.min(
    currentResources[material] + rest,
    capacity,
  );
}

function nonZeroValues(resources: Resources): boolean {
  return Object.values(resources).some((value) => value !== 0);
}

// the material a building delivers to construction sites and storages
function getOutputMaterial(building: Building): Material | undefined {
  if (building.produces.planks > 0) {
    return "planks";
  }
  return building.produces.wood > 0 ? "wood" : undefined;
}

// lets one building work if it has what it needs; returns its workers
function produce(
  placed: PlacedBuilding,
  sites: PlacedBuilding[],
  sawmills: PlacedBuilding[],
  capacity: Resources,
): number {
  const { building } = placed;
  const output = getOutputMaterial(building);
  const outputSites = sites.filter(
    (site) => getMaterial(site.building) === output,
  );
  const outputSawmills = output === "wood" ? sawmills : [];
  // forestry and sawmills stop (and keep their labor free) when neither a
  // construction site, a sawmill supply nor the storages have room for their
  // output
  if (
    output &&
    !hasRoom(outputSites, outputSawmills, output, capacity[output])
  ) {
    return 0;
  }
  // a sawmill uses its own wood supply before the stock
  const supply = placed.sawmillWood ?? 0;
  // energy is not a stock: the distribution at the start of the week decided
  // whether the building has it
  if (
    unpoweredBuildings.has(placed) ||
    !hasEnoughResources(
      {
        ...currentResources,
        wood: currentResources.wood + supply,
        energy: building.consumes.energy,
      },
      building.consumes,
    )
  ) {
    // no partial production
    reports.set(placed, {
      workers: 0,
      produced: { ...emptyResources },
      consumed: { ...emptyResources },
      ...(nonZeroValues(building.produces) && {
        status: "missing-resources" as const,
      }),
    });
    return 0;
  }
  const fromSupply = Math.min(supply, building.consumes.wood);
  if (supply > 0) {
    placed.sawmillWood = supply - fromSupply;
  }
  currentResources = subtractResources(currentResources, {
    ...building.consumes,
    wood: building.consumes.wood - fromSupply,
    energy: 0,
  });
  currentResources = addResources(currentResources, {
    ...building.produces,
    wood: 0,
    planks: 0,
    energy: 0,
  });
  if (output) {
    deliver(
      outputSites,
      outputSawmills,
      output,
      building.produces[output],
      capacity[output],
    );
  }
  reports.set(placed, {
    workers: building.consumes.labor,
    produced: { ...building.produces },
    consumed: { ...building.consumes },
  });
  return building.consumes.labor;
}

// returns the workers that were assigned to sawmills and to all other
// productions (forestry)
function calculateOtherProductions(): { production: number; forestry: number } {
  // TODO prioritize buildings
  const capacity = getCapacity();
  const sites = getConstructionSites(); // oldest first
  const finished = getPlacedBuildings();
  const isSawmill = ({ building }: PlacedBuilding) =>
    building.produces.planks > 0;
  // sawmills work before forestry, in placement order
  const sawmills = finished
    .filter(isSawmill)
    .sort((a, b) => a.sequence - b.sequence);
  let production = 0;
  for (const placed of sawmills) {
    production += produce(placed, sites, sawmills, capacity);
  }
  let forestry = 0;
  for (const placed of finished) {
    // food is already produced in calculateDevelopment
    if (placed.building.produces.food > 0 || isSawmill(placed)) {
      continue;
    }
    forestry += produce(placed, sites, sawmills, capacity);
  }
  return { production, forestry };
}
