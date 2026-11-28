import { weekToMonth } from "./calendar";

export type WeatherType = "Sunny" | "Cloudy" | "Rainy" | "Windy" | "Storm";

export const WEATHER_TYPES: WeatherType[] = [
  "Sunny",
  "Cloudy",
  "Rainy",
  "Windy",
  "Storm",
];

// factors of a weather type for solar fields and wind turbines
export const TYPE_FACTORS: Record<WeatherType, { sun: number; wind: number }> =
  {
    Sunny: { sun: 1.3, wind: 0.7 },
    Cloudy: { sun: 0.7, wind: 1.0 },
    Rainy: { sun: 0.4, wind: 1.1 },
    Windy: { sun: 0.9, wind: 1.6 },
    Storm: { sun: 0.3, wind: 0 },
  };

// probabilities of the types (in the order of WEATHER_TYPES) per season
const WINTER = [0.15, 0.35, 0.2, 0.2, 0.1];
const SPRING = [0.3, 0.3, 0.2, 0.15, 0.05];
const SUMMER = [0.5, 0.2, 0.15, 0.1, 0.05];
const AUTUMN = [0.2, 0.3, 0.25, 0.17, 0.08];
// by month, January first
const MONTH_PROBABILITIES = [
  WINTER,
  WINTER,
  SPRING,
  SPRING,
  SPRING,
  SUMMER,
  SUMMER,
  SUMMER,
  AUTUMN,
  AUTUMN,
  AUTUMN,
  WINTER,
];

// seasonal curves by month, January first, scaled so that their mean is 1
function normalize(values: number[]): number[] {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value / mean);
}

export const SEASONAL_SUN = normalize([
  0.35, 0.6, 0.95, 1.35, 1.55, 1.6, 1.6, 1.4, 1.05, 0.7, 0.4, 0.35,
]);
export const SEASONAL_WIND = normalize([
  1.35, 1.3, 1.2, 1.0, 0.85, 0.75, 0.7, 0.7, 0.85, 1.05, 1.2, 1.35,
]);

// probability of each weather type in a month (0 = January)
export function getProbabilities(month: number): Record<WeatherType, number> {
  const entries = WEATHER_TYPES.map(
    (type, index) => [type, MONTH_PROBABILITIES[month][index]] as const,
  );
  return Object.fromEntries(entries) as Record<WeatherType, number>;
}

// probability-weighted mean of the type factor in a month
export function expectedTypeFactor(
  month: number,
  kind: "sun" | "wind",
): number {
  return WEATHER_TYPES.reduce(
    (sum, type, index) =>
      sum + MONTH_PROBABILITIES[month][index] * TYPE_FACTORS[type][kind],
    0,
  );
}

// the effective factor of a type in a month; its expectation over the types
// of that month is the seasonal curve, the mean of which over a year is 1
export function effectiveFactor(
  month: number,
  type: WeatherType,
  kind: "sun" | "wind",
): number {
  const seasonal = kind === "sun" ? SEASONAL_SUN : SEASONAL_WIND;
  return (
    (seasonal[month] * TYPE_FACTORS[type][kind]) /
    expectedTypeFactor(month, kind)
  );
}

export type Weather = {
  type: WeatherType;
  sun: number; // effective factor for solar fields
  wind: number; // effective factor for wind turbines
};

// the weather of a week: a pure function of the game seed and the week
export function getWeather(seed: number, week: number): Weather {
  // murmur3 finalizer: a well mixed number in [0, 1) from seed and week
  let hash = seed ^ Math.imul(week + 1, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  const roll = (hash >>> 0) / 2 ** 32;
  const month = weekToMonth(week);
  const probabilities = MONTH_PROBABILITIES[month];
  let cumulative = 0;
  // the last type takes what rounding leaves over
  const type = WEATHER_TYPES.find((_, index) => {
    cumulative += probabilities[index];
    return roll < cumulative || index === WEATHER_TYPES.length - 1;
  })!;
  return {
    type,
    sun: effectiveFactor(month, type, "sun"),
    wind: effectiveFactor(month, type, "wind"),
  };
}
