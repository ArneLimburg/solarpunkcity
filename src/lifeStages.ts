import { ageInWeek } from "./calendar";
import { random, type Roster } from "./settlers";

// Life stages and age-dependent mortality (pure, no React and no Babylon).

export type LifeStage = "Child" | "Adult" | "Retired";

export const ADULT_AGE = 18;
export const RETIREMENT_AGE = 65;
export const MAX_LIFE_AGE = 120;
// probability of dying in the year of the 65th birthday; it doubles every
// MORTALITY_DOUBLING_YEARS years
export const MORTALITY_BASE = 0.01;
export const MORTALITY_DOUBLING_YEARS = 8;

export function getLifeStage(age: number): LifeStage {
  if (age < ADULT_AGE) {
    return "Child";
  }
  return age < RETIREMENT_AGE ? "Adult" : "Retired";
}

// the probability of dying at the birthday of the given age (65 or older)
export function getMortality(age: number): number {
  return Math.min(
    1,
    MORTALITY_BASE * 2 ** ((age - RETIREMENT_AGE) / MORTALITY_DOUBLING_YEARS),
  );
}

// The draw of a resident for a birthday, in [0, 1): derived from the roster
// seed, the resident ID and the age only, so it never changes.
export function drawForBirthday(
  roster: Roster,
  residentId: number,
  age: number,
): number {
  return random({
    seed:
      roster.seed ^
      Math.imul(residentId, 0x9e3779b1) ^
      Math.imul(age, 0x85ebca6b),
  });
}

// The IDs of the residents who die in the tick from `week` to `week + 1`: one
// draw for every birthday from the 65th on between the two weeks, and certain
// death from the 120th birthday on. The youngest resident survives if all
// would die.
export function getDeaths(roster: Roster, week: number): number[] {
  const dead = roster.residents.filter((resident) => {
    const age = ageInWeek(resident.birthDate, week + 1);
    if (age >= MAX_LIFE_AGE) {
      return true;
    }
    // a week is shorter than a year: at most one birthday lies in between
    const hadBirthday = age > ageInWeek(resident.birthDate, week);
    return (
      hadBirthday &&
      age >= RETIREMENT_AGE &&
      drawForBirthday(roster, resident.id, age) < getMortality(age)
    );
  });
  if (dead.length === roster.residents.length && dead.length > 0) {
    const youngest = dead.reduce((best, resident) =>
      resident.birthDate > best.birthDate ? resident : best,
    );
    return dead.filter((resident) => resident !== youngest).map(({ id }) => id);
  }
  return dead.map(({ id }) => id);
}
