import { test, expect } from "./fixtures";
import { GRID_RADIUS, getRiverCourse } from "../src/board";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  openCategory,
  selectBuilding,
  tilePosition,
} from "./helpers";

test("the menu offers the hydro power plant under Energy with its details", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await openCategory(page, "Energy");
  await expect(page.getByTestId("build-cost-HydroPowerPlant")).toHaveText(
    /20$/,
  );
  await selectBuilding(page, "Energy", "Hydro power plant");
  const details = page.getByTestId("building-details");
  await expect(details.getByTestId("details-river-only")).toHaveText(
    "Can only be built on the river",
  );
  await expect(
    details.getByTestId("details-produces").getByTestId("detail-energy"),
  ).toHaveText(/10$/);
  // not buildable on a forest tile
  const forest = { q: -2, r: -2 };
  const { x, y } = await tilePosition(page, forest);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, forest)).toBe("Forest");
});

test("the HUD shows used / produced energy and the error style without power", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  const energy = page.getByTestId("status-energy");
  await expect(energy).toHaveCount(0);
  await selectBuilding(page, "Production", "Sawmill");
  const origin = { q: 0, r: 0 };
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("Sawmill");
  await finishConstruction(page);
  const sawmillDetails = page.getByTestId("detail-energy");
  await expect(sawmillDetails.first()).toHaveText(/2$/);
  await expect(energy).toHaveText(/0 \/ 0$/);
  await expect(energy).toHaveClass(/error/);
  const river = getRiverCourse(GRID_RADIUS)[10];
  await page.evaluate((c) => window.__solarpunk?.addHydroPowerPlant(c), river);
  await finishConstruction(page);
  await expect(energy).toHaveText(/2 \/ 10$/);
  await expect(energy).not.toHaveClass(/error/);
});

test("a hydro power plant shows its model and keeps the river water", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const course = getRiverCourse(GRID_RADIUS);
  // a bent and a straight part of the river
  const tiles = [course[4], course[10]];
  for (const tile of tiles) {
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("water");
    await page.evaluate((c) => window.__solarpunk?.addHydroPowerPlant(c), tile);
    expect(
      await page.evaluate((c) => window.__solarpunk?.getBuildingType(c), tile),
    ).toBe("HydroPowerPlant");
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("water");
    expect(
      await page.evaluate((c) => window.__solarpunk?.getModelCount(c), tile),
    ).toBe(1);
    const triangles = await page.evaluate(
      (c) => window.__solarpunk?.getModelTriangleCount(c),
      tile,
    );
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThan(1000);
  }
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
