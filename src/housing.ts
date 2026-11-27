import type { PlacedBuilding } from "./board";

// home of each resident by resident ID; the single source of truth for who
// lives where (occupant lists are derived from it)
export type Assignments = Map<number, PlacedBuilding>;

/**
 * Updates the assignments in place. Residents who left the population and
 * residents whose home is no longer one of the homes keep no place. Vacancies
 * are filled in placement order (oldest home first) with the unhoused
 * residents in arrival order. Housed residents stay where they are.
 *
 * @param residentIds IDs of the population in arrival order
 * @param homes finished buildings with housing
 */
export function assignHomes(
  assignments: Assignments,
  residentIds: number[],
  homes: PlacedBuilding[],
) {
  const present = new Set(residentIds);
  const valid = new Set(homes);
  const occupancy = new Map<PlacedBuilding, number>();
  for (const [id, home] of [...assignments]) {
    const used = (occupancy.get(home) ?? 0) + 1;
    if (!present.has(id) || !valid.has(home) || used > home.building.resident) {
      assignments.delete(id);
    } else {
      occupancy.set(home, used);
    }
  }
  const unhoused = residentIds.filter((id) => !assignments.has(id));
  const ordered = [...homes].sort((a, b) => a.sequence - b.sequence);
  for (const home of ordered) {
    let used = occupancy.get(home) ?? 0;
    while (used < home.building.resident && unhoused.length > 0) {
      assignments.set(unhoused.shift()!, home);
      used++;
    }
  }
}

// the IDs of the residents who live in a home, in arrival order
export function getOccupantIds(
  assignments: Assignments,
  home: PlacedBuilding,
): number[] {
  return [...assignments]
    .filter(([, assigned]) => assigned === home)
    .map(([id]) => id)
    .sort((a, b) => a - b);
}
