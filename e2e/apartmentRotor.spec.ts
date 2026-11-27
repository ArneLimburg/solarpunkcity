import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  selectBuilding,
  tilePosition,
} from "./helpers";

test("the rooftop rotor of an apartment building stands still on the site and turns when finished", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Residential", "Apartment building");
  const tile = { q: -2, r: -2 };
  const { x, y } = await tilePosition(page, tile);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect
    .poll(() => buildingAt(page, tile), { timeout: 30_000 })
    .toBe("AppartmentBuilding");
  const matrix = () =>
    page.evaluate((c) => window.__solarpunk?.getRotorMatrix(c), tile);
  // under construction the rotor stands still: it has no turning rotor
  await page.waitForTimeout(300);
  expect(await matrix()).toBeUndefined();
  await finishConstruction(page);
  await expect.poll(matrix, { timeout: 30_000 }).toHaveLength(16);
  const before = await matrix();
  // the rotor turns between two frames (frames are slow in CI)
  await expect
    .poll(async () => (await matrix())?.join(), { timeout: 30_000 })
    .not.toBe(before?.join());
  expect(errors).toEqual([]);
});
