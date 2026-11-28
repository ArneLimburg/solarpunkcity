import { expect, test } from "vitest";
import { weekToMonth } from "../src/calendar";
import {
  WEATHER_TYPES,
  effectiveFactor,
  expectedTypeFactor,
  getProbabilities,
  getWeather,
  type WeatherType,
} from "../src/weather";

const WEEKS_PER_YEAR = 52;

test("the weather of a week is the same for the same seed and week", () => {
  for (let week = 0; week < 200; week++) {
    expect(getWeather(42, week)).toEqual(getWeather(42, week));
  }
});

test("the weather differs between seeds for some weeks", () => {
  const differing = Array.from({ length: 200 }, (_, week) => week).filter(
    (week) => getWeather(1, week).type !== getWeather(2, week).type,
  );
  expect(differing.length).toBeGreaterThan(0);
});

test("the frequency of each type per season follows the table", () => {
  const seasons = [
    [11, 0, 1],
    [2, 3, 4],
    [5, 6, 7],
    [8, 9, 10],
  ];
  for (const months of seasons) {
    const counts = new Map<WeatherType, number>();
    let total = 0;
    for (let week = 0; week < 100 * WEEKS_PER_YEAR; week++) {
      if (months.includes(weekToMonth(week))) {
        const { type } = getWeather(1, week);
        counts.set(type, (counts.get(type) ?? 0) + 1);
        total++;
      }
    }
    const probabilities = getProbabilities(months[0]);
    for (const type of WEATHER_TYPES) {
      expect(
        Math.abs((counts.get(type) ?? 0) / total - probabilities[type]),
      ).toBeLessThan(0.02);
    }
  }
});

test("the expected yearly mean of the effective factors is 1", () => {
  for (const kind of ["sun", "wind"] as const) {
    let sum = 0;
    for (let month = 0; month < 12; month++) {
      const probabilities = getProbabilities(month);
      for (const type of WEATHER_TYPES) {
        sum += probabilities[type] * effectiveFactor(month, type, kind);
      }
    }
    expect(Math.abs(sum / 12 - 1)).toBeLessThan(0.001);
  }
});

test("the expected type factor is the probability-weighted mean", () => {
  expect(getProbabilities(5).Sunny).toBe(0.5);
  expect(expectedTypeFactor(5, "wind")).toBeCloseTo(
    0.5 * 0.7 + 0.2 * 1 + 0.15 * 1.1 + 0.1 * 1.6,
    10,
  );
});

test("a storm stops the wind and weather has effective factors", () => {
  const storm = Array.from({ length: 500 }, (_, week) =>
    getWeather(7, week),
  ).find(({ type }) => type === "Storm")!;
  expect(storm.wind).toBe(0);
  expect(storm.sun).toBeGreaterThan(0);
});
