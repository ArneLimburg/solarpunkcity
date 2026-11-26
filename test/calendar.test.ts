import { expect, test } from "vitest";
import {
  formatLongDate,
  formatSessionTime,
  formatShortDate,
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
