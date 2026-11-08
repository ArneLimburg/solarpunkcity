// share of the housing that is occupied, between 0 and 1
export function getOccupancy(population: number, housing: number): number {
  if (housing <= 0) return 0;
  return Math.min(population / housing, 1);
}

// residents of a single building; residents are not assigned to buildings,
// so the sum over all buildings may differ from the population
export function getResidents(
  resident: number,
  population: number,
  housing: number,
): { residents: number; percent: number } {
  const occupancy = getOccupancy(population, housing);
  return {
    residents: Math.round(occupancy * resident),
    percent: Math.round(occupancy * 100),
  };
}
