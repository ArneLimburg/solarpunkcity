import { expect, test } from "vitest";
import {
  ageInWeek,
  birthTime,
  formatLongDate,
  formatSessionTime,
  formatShortDate,
  formatShortTime,
  weekToTime,
} from "../src/calendar";

test.each([
  [0, "1 Jan 2030", "Tuesday, 1 January 2030"],
  [1, "8 Jan 2030", "Tuesday, 8 January 2030"],
  [52, "31 Dec 2030", "Tuesday, 31 December 2030"],
  [53, "7 Jan 2031", "Tuesday, 7 January 2031"],
  [112, "24 Feb 2032", "Tuesday, 24 February 2032"],
  [113, "2 Mar 2032", "Tuesday, 2 March 2032"],
])("week %i is %s", (week, short, long) => {
  expect(formatShortDate(week)).toBe(short);
  expect(formatLongDate(week)).toBe(long);
});

test("formats the session time as h:mm:ss", () => {
  expect(formatSessionTime(0)).toBe("0:00:00");
  expect(formatSessionTime(247_999)).toBe("0:04:07");
  expect(formatSessionTime(3_725_000)).toBe("1:02:05");
  expect(formatSessionTime(-5000)).toBe("0:00:00");
});

test("formats a time as a short date", () => {
  expect(formatShortTime(Date.UTC(2005, 2, 15))).toBe("15 Mar 2005");
});

test("a settler born on 15 March 2005 turns 25 with the first tick on or after 15 March 2030", () => {
  const born = Date.UTC(2005, 2, 15);
  expect(formatShortDate(10)).toBe("12 Mar 2030");
  expect(formatShortDate(11)).toBe("19 Mar 2030");
  expect(ageInWeek(born, 10)).toBe(24);
  expect(ageInWeek(born, 11)).toBe(25);
});

test("a tick exactly on the birthday counts the new age", () => {
  // week 1 is 8 Jan 2030
  expect(ageInWeek(Date.UTC(2000, 0, 8), 0)).toBe(29);
  expect(ageInWeek(Date.UTC(2000, 0, 8), 1)).toBe(30);
});

test("a settler born on 29 February 2008 turns 22 on 28 February 2030", () => {
  const born = Date.UTC(2008, 1, 29);
  expect(formatShortDate(8)).toBe("26 Feb 2030");
  expect(formatShortDate(9)).toBe("5 Mar 2030");
  expect(ageInWeek(born, 8)).toBe(21);
  expect(ageInWeek(born, 9)).toBe(22);
});

test("a 29 February birthday is celebrated on 29 February in leap years", () => {
  const born = Date.UTC(2008, 1, 29);
  // 24 Feb 2032 is before, 2 Mar 2032 after the birthday
  expect(ageInWeek(born, 112)).toBe(23);
  expect(ageInWeek(born, 113)).toBe(24);
});

test("the birth date makes the settler exactly as old as generated on joining", () => {
  for (let week = 0; week < 900; week += 7) {
    for (const age of [18, 19, 40, 64, 65]) {
      for (const offset of [0, 1, 100, 200, 364]) {
        const birth = birthTime(week, age, offset);
        expect(ageInWeek(birth, week)).toBe(age);
        expect(birth).toBeLessThanOrEqual(weekToTime(week));
      }
    }
  }
});

test("joining on 29 February works", () => {
  const week = Array.from({ length: 3000 }, (_, i) => i).find((w) =>
    formatShortDate(w).startsWith("29 Feb"),
  )!;
  expect(week).toBeDefined();
  for (const age of [18, 19, 20, 21, 22, 23, 24]) {
    for (const offset of [0, 364]) {
      expect(ageInWeek(birthTime(week, age, offset), week)).toBe(age);
    }
  }
});
