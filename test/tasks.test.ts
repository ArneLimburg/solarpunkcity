import { expect, test } from "vitest";
import { assignTasks, type WorkSlot } from "../src/tasks";
import { getWorkSlots, toWorkSlot } from "../src/game";
import { getPlacedBuilding } from "../src/board";

const slot = (key: string, workers: number): WorkSlot => ({
  key,
  tiles: [],
  workers,
});

test("places go to the residents in order, never more than the slots have", () => {
  const tasks = assignTasks(
    new Map(),
    [1, 2, 3, 4],
    [slot("a", 2), slot("b", 1)],
  );
  expect([...tasks]).toEqual([
    [1, "a"],
    [2, "a"],
    [3, "b"],
  ]);
  expect(assignTasks(new Map(), [1], [slot("a", 5)]).size).toBe(1);
  expect(assignTasks(new Map(), [1, 2], []).size).toBe(0);
});

test("a resident keeps the task while the place is still available", () => {
  const previous = new Map([
    [3, "b"],
    [4, "gone"],
  ]);
  const tasks = assignTasks(
    previous,
    [1, 2, 3, 4],
    [slot("a", 2), slot("b", 1)],
  );
  expect(tasks.get(3)).toBe("b");
  expect(tasks.get(1)).toBe("a");
  expect(tasks.get(2)).toBe("a");
  expect(tasks.has(4)).toBe(false);
  // fewer places than before: the first holders keep theirs
  const fewer = assignTasks(
    new Map([
      [1, "a"],
      [2, "a"],
    ]),
    [1, 2],
    [slot("a", 1)],
  );
  expect([...fewer]).toEqual([[1, "a"]]);
});

test("when a resident dies, the survivors keep their workplaces", () => {
  const slots = [slot("a", 2), slot("b", 2)];
  const before = assignTasks(new Map(), [1, 2, 3, 4], slots);
  const after = assignTasks(before, [1, 3, 4], slots);
  expect(after.has(2)).toBe(false);
  for (const id of [1, 3, 4]) {
    expect(after.get(id)).toBe(before.get(id));
  }
});

test("the work slots of the game are the staffed places of the last week", async () => {
  const game = await import("../src/game");
  expect(getWorkSlots()).toEqual([]);
  game.grantResources({ wood: 1000 });
  game.build("Farm", { q: 3, r: 3 });
  game.calculateWeek();
  const slots = getWorkSlots();
  const site = getPlacedBuilding({ q: 3, r: 3 })!;
  const siteSlot = slots.find(({ key }) => key === "3,3")!;
  expect(siteSlot.workers).toBeGreaterThan(0);
  expect(siteSlot.tiles).toEqual(toWorkSlot(site, 1).tiles);

  // finished: the staffed places are the workers of the building report
  game.finishConstruction();
  game.calculateWeek();
  const report = game.getBuildingReport({ q: 3, r: 3 })!;
  expect(report.workers).toBeGreaterThan(0);
  expect(getWorkSlots()).toEqual([toWorkSlot(site, report.workers)]);
});
