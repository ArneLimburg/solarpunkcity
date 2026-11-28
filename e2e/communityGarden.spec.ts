import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  selectBuilding,
  tilePosition,
} from "./helpers";

test("the menu offers the community garden under Leisure and builds it on a forest tile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Leisure", "Community garden");
  await expect(page.getByTestId("build-cost-CommunityGarden")).toHaveText(/4$/);
  const tile = { q: -2, r: -2 };
  const { x, y } = await tilePosition(page, tile);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, tile)).toBe("CommunityGarden");
  await finishConstruction(page);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("a community garden shows its model on meadow ground and the game keeps running", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const garden = { q: -2, r: 3 };
  await page.evaluate((c) => window.__solarpunk?.addCommunityGarden(c), garden);
  expect(await buildingAt(page, garden)).toBe("CommunityGarden");
  expect(
    await page.evaluate(
      (c) => window.__solarpunk?.isUnderConstruction(c),
      garden,
    ),
  ).toBe(false);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), garden),
  ).toBe("meadow");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), garden),
  ).toBe(1);
  const triangles = await page.evaluate(
    (c) => window.__solarpunk?.getModelTriangleCount(c),
    garden,
  );
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThan(1000);
  // the weekly tick keeps running
  const week = page.getByTestId("hud-date-button");
  const before = await week.textContent();
  await expect.poll(() => week.textContent()).not.toBe(before);
  expect(await buildingAt(page, garden)).toBe("CommunityGarden");
  expect(errors).toEqual([]);
});
