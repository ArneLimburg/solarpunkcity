import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  openDropdown,
  selectBuilding,
  tilePosition,
} from "./helpers";

const origin = { q: 0, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
}

async function buildAtOrigin(page: Page, category: string, label: string) {
  await selectBuilding(page, category, label);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
}

const planks = (page: Page) => page.getByTestId("status-planks");

test("planks are hidden in the HUD while there is no plank capacity", async ({
  page,
}) => {
  await setup(page);
  await expect(page.getByTestId("status-wood")).toBeVisible();
  await expect(planks(page)).toHaveCount(0);
});

test("a sawmill is an open saw shed on bare ground within the model budget", async ({
  page,
}) => {
  await setup(page);
  await buildAtOrigin(page, "Production", "Sawmill");
  await expect.poll(() => buildingAt(page, origin)).toBe("Sawmill");
  // bare soil and no model while it is built
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("soil");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin),
  ).toBe(0);
  await finishConstruction(page);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("earth");
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin),
    )
    .toBe(1);
  const triangles = await page.evaluate(
    (c) => window.__solarpunk?.getModelTriangleCount(c),
    origin,
  );
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(1000);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTreeCount(c), origin),
  ).toBe(0);
});

test("the HUD shows planks after wood only with plank capacity and More does not list them", async ({
  page,
}) => {
  await setup(page);
  await buildAtOrigin(page, "Production", "Sawmill");
  await expect.poll(() => buildingAt(page, origin)).toBe("Sawmill");
  await finishConstruction(page);
  await expect(planks(page)).toHaveText(/\d+ \/ 20$/);
  // directly after the wood entry
  const names = await page
    .getByTestId("hud")
    .locator("[data-testid^='status-']")
    .evaluateAll((entries) =>
      entries.map((entry) => entry.getAttribute("data-testid")),
    );
  expect(names.indexOf("status-planks")).toBe(names.indexOf("status-wood") + 1);
  await page.evaluate(() => window.__solarpunk?.addResources({ planks: 5 }));
  await expect(planks(page)).toHaveText(/\d+ \/ 20$/);
  const more = await openDropdown(page, "more");
  await expect(more.getByTestId("row-planks")).toHaveCount(0);
  await expect(more.getByTestId("row-wood")).toHaveCount(0);
});

test("a site waiting for planks counts as waiting for material", async ({
  page,
}) => {
  await setup(page);
  await buildAtOrigin(page, "Residential", "Apartment building");
  await expect.poll(() => buildingAt(page, origin)).toBe("AppartmentBuilding");
  const panel = await openDropdown(page, "more");
  await expect(panel.getByTestId("row-Construction sites")).toHaveText(
    /sites1 \(1 waiting for material\)$/,
  );
  await expect(panel.getByTestId("row-Construction sites")).toHaveClass(
    /error/,
  );
  await expect(page.getByTestId("hud-more-button")).toHaveClass(/error/);
});

test("the Workers dropdown lists Production between Construction and Forestry", async ({
  page,
}) => {
  await setup(page);
  const panel = await openDropdown(page, "workers");
  // the rows appear with the first weekly report
  await expect(panel.getByTestId("row-Free")).toBeVisible();
  const names = await panel
    .locator("[data-testid^='row-']")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")));
  expect(names).toEqual([
    "row-Food production",
    "row-Construction",
    "row-Production",
    "row-Forestry",
    "row-Free",
  ]);
});
