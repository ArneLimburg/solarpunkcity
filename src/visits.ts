import {
  getFootprint,
  getFootprintRadius,
  getPlacedBuildings,
  type HexCoordinates,
} from "./board";
import { VISITOR_SPOTS } from "./communityGarden";
import { hexDistance } from "./settlers";

// the direction the settler faces at each visitor spot (radians around y, 0
// looks to +z): towards the bed behind the spot
export const SPOT_HEADINGS: readonly number[] = [Math.PI, 0];

export type Garden = {
  key: string; // center of the garden ("q,r")
  center: HexCoordinates;
  tiles: HexCoordinates[]; // footprint: the destination of the route
};

// a reserved visitor spot of a garden
export type Visit = { garden: string; spot: number };

export type VisitResident = {
  id: number;
  gardener: boolean; // the hobby is Gardening
  hasTask: boolean; // work wins over visits
  ready: boolean; // the cooldown is over
  tile: HexCoordinates; // where the settler stands
};

// the finished community gardens (construction sites are not visited)
export function getGardens(): Garden[] {
  return getPlacedBuildings()
    .filter(({ building }) => building.type === "CommunityGarden")
    .map(({ center, building }) => ({
      key: `${center.q},${center.r}`,
      center,
      tiles: getFootprint(center, getFootprintRadius(building.size)),
    }));
}

// Chooses the garden spot of every settler (in the order of `residents`, which
// is the order of the resident IDs). A visit stays as long as it is still
// valid; the free spots go to the ready gardeners without a task, each to the
// nearest garden (ties by garden key) that has one. Pure.
export function assignVisits(
  previous: Map<number, Visit>,
  residents: VisitResident[],
  gardens: Garden[],
): Map<number, Visit> {
  const keys = new Set(gardens.map(({ key }) => key));
  const taken = new Set<string>();
  const spot = (visit: Visit) => `${visit.garden}#${visit.spot}`;
  const visits = new Map<number, Visit>();
  for (const { id, gardener, hasTask } of residents) {
    const visit = previous.get(id);
    if (
      visit &&
      gardener &&
      !hasTask &&
      keys.has(visit.garden) &&
      !taken.has(spot(visit))
    ) {
      taken.add(spot(visit));
      visits.set(id, visit);
    }
  }
  const byKey = [...gardens].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const { id, gardener, hasTask, ready, tile } of residents) {
    if (!gardener || hasTask || !ready || visits.has(id)) {
      continue;
    }
    let best: Visit | undefined;
    let bestDistance = Infinity;
    for (const garden of byKey) {
      const distance = hexDistance(tile, garden.center);
      const free = VISITOR_SPOTS.findIndex(
        (_, index) => !taken.has(spot({ garden: garden.key, spot: index })),
      );
      if (free >= 0 && distance < bestDistance) {
        best = { garden: garden.key, spot: free };
        bestDistance = distance;
      }
    }
    if (best) {
      taken.add(spot(best));
      visits.set(id, best);
    }
  }
  return visits;
}
