import { expect, test } from "vitest";
import { canBuild } from "../src/game";

test("cannot build outside the board", () => {
  expect(canBuild("Forest", { q: 31, r: -1 })).toBe(false);
});
