import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  openCategory,
  selectBuilding,
  tilePosition,
} from "./helpers";

test("the menu offers the solar field under Energy and builds it on a forest tile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await openCategory(page, "Energy");
  await expect(page.getByTestId("build-cost-SolarField")).toHaveText(/4$/);
  await selectBuilding(page, "Energy", "Solar field");
  const tile = { q: -2, r: -2 };
  const { x, y } = await tilePosition(page, tile);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, tile)).toBe("SolarField");
  await finishConstruction(page);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("a solar field shows its model on meadow ground", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const tile = { q: 3, r: -4 };
  await page.evaluate((c) => window.__solarpunk?.addSolarField(c), tile);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getBuildingType(c), tile),
  ).toBe("SolarField");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
  ).toBe("meadow");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), tile),
  ).toBe(1);
  // three panels, nine posts and the inverter, 12 triangles each
  expect(
    await page.evaluate(
      (c) => window.__solarpunk?.getModelTriangleCount(c),
      tile,
    ),
  ).toBe(13 * 12);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
