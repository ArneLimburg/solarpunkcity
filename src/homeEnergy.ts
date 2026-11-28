import type { Building } from "./gameDefinitions";

// electricity demand of apartment buildings; all values are in milli-energy
// (integers), so small loads are not rounded away and sums are exact
export const APARTMENT_BASE_DEMAND = 40; // common areas, 0.040 energy
export const RESIDENT_DEMAND = 23; // per resident, 0.023 (about 1,200 kWh a year)
export const APARTMENT_ROOFTOP_SUPPLY = 50; // rooftop wind turbines, 0.050

// what an apartment building needs and gets in a weekly tick, in energy
export type HomeEnergyReport = {
  demand: number; // gross demand
  rooftop: number; // supplied by its own rooftop turbines
  grid: number; // received from the grid
  unmet: number; // requested from the grid but not received
};

export function milli(energy: number): number {
  return Math.round(energy * 1000);
}

export function isApartment(building: Building): boolean {
  return building.type === "AppartmentBuilding";
}

// the gross demand and the part the rooftop covers, in milli-energy
export function getApartmentDemand(occupants: number): {
  gross: number;
  rooftop: number;
} {
  const gross = APARTMENT_BASE_DEMAND + occupants * RESIDENT_DEMAND;
  return { gross, rooftop: Math.min(gross, APARTMENT_ROOFTOP_SUPPLY) };
}

// the request to the grid in milli-energy: what the rooftop does not cover
export function getGridRequest(occupants: number): number {
  const { gross, rooftop } = getApartmentDemand(occupants);
  return gross - rooftop;
}

export function toHomeEnergyReport(
  occupants: number,
  powered: boolean,
): HomeEnergyReport {
  const { gross, rooftop } = getApartmentDemand(occupants);
  const request = gross - rooftop;
  return {
    demand: gross / 1000,
    rooftop: rooftop / 1000,
    grid: powered ? request / 1000 : 0,
    unmet: powered ? 0 : request / 1000,
  };
}
