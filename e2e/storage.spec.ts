import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  installClockWithNativeFrames,
  isUnderConstruction,
  openDropdown,
  selectBuilding,
  tilePosition,
} from "./helpers";

const origin = { q: 0, r: 0 };

async function start(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
}

const wood = (page: Page) => page.getByTestId("status-wood");

async function hoverOrigin(page: Page) {
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  return { x, y };
}

test("the HUD shows 0 / 0 wood in the error style at the start", async ({
  page,
}) => {
  await start(page);
  await expect(wood(page)).toHaveText(/0 \/ 0$/);
  await expect(wood(page)).toHaveClass(/error/);
});

test("the details panel of the wood storage shows its storage and no cost", async ({
  page,
}) => {
  await start(page);
  await selectBuilding(page, "Storage", "Wood storage");
  const panel = page.getByTestId("building-details");
  await expect(panel).toContainText("Wood storage");
  await expect(panel).toContainText(
    "Stores up to 100 wood from clearing and forestry",
  );
  await expect(
    panel.getByTestId("details-storage").getByTestId("detail-wood"),
  ).toHaveText(/100$/);
  await expect(panel.getByTestId("details-cost")).toHaveCount(0);
});

test("a wood storage is placed on forest as a log yard and adds capacity", async ({
  page,
}) => {
  await start(page);
  await selectBuilding(page, "Storage", "Wood storage");
  const { x, y } = await hoverOrigin(page);
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.isRingBlocked()))
    .toBe(false);
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("WoodStorage");
  // finished at once: bare gravel ground, no soil
  expect(await isUnderConstruction(page, origin)).toBe(false);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("gravel");
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
  // the 3 cleared wood plus forestry fit now
  await expect(wood(page)).toHaveText(/\d+ \/ 100$/);
  await expect(wood(page)).not.toHaveClass(/error/);
});

test("a site without wood waits for it and the More dropdown shows it", async ({
  page,
}) => {
  // no weekly tick runs by itself, so a slow runner cannot skip the waiting week
  await installClockWithNativeFrames(page);
  await page.clock.pauseAt(Date.now() + 1000);
  await start(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  // the camp gives no wood and there is no stock: the homestead is not blocked
  const { x, y } = await hoverOrigin(page);
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.isRingBlocked()))
    .toBe(false);
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  await page.clock.runFor(1000);
  // forestry delivers 1 wood per week, a worker-week needs 1 wood: the site
  // waits every other week
  const panel = await openDropdown(page, "more");
  await expect(panel.getByTestId("row-Construction sites")).toHaveText(
    /sites1 \(1 waiting for wood\)$/,
  );
  await expect(panel.getByTestId("row-Construction sites")).toHaveClass(
    /error/,
  );
  await expect(page.getByTestId("hud-more-button")).toHaveClass(/error/);
});

test("the ring is red where the cleared wood does not fit", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 5 }));
  await selectBuilding(page, "Farms", "Organic homestead");
  const { x, y } = await hoverOrigin(page);
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.isRingBlocked()))
    .toBe(true);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});
