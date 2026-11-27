import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  selectBuilding,
  tilePosition,
} from "./helpers";

const origin = { q: 0, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
}

test("the details panel of the supermarket shows 100 food of storage", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Storage", "Supermarket");
  const panel = page.getByTestId("building-details");
  await expect(panel).toContainText("Supermarket");
  await expect(panel).toContainText(
    "Keeps up to 100 food in stock as a reserve against bad harvests",
  );
  await expect(
    panel.getByTestId("details-storage").getByTestId("detail-food"),
  ).toHaveText(/100$/);
});

test("a supermarket is a market hall on grass within the model budget and adds food capacity", async ({
  page,
}) => {
  await setup(page);
  const food = page.getByTestId("status-food");
  await expect(food).toContainText("/ 0 (");
  await selectBuilding(page, "Storage", "Supermarket");
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("Supermarket");
  // bare soil and no model while it is built, no capacity yet
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("soil");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin),
  ).toBe(0);
  await expect(food).toContainText("/ 0 (");
  await finishConstruction(page);
  // the forecourt is part of the model, the tile is meadow
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("meadow");
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
  await expect(food).toContainText("/ 100 (");
});
