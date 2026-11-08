import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { buildingAt, isUnderConstruction, tilePosition } from "./helpers";

const origin = { q: 0, r: 0 };

async function start(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
}

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const wood = (page: Page) => page.getByTestId("status-wood");

async function hoverOrigin(page: Page) {
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  return { x, y };
}

test("the status bar shows 0 / 0 wood in the error style at the start", async ({
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
  await button(page, "STORAGE").click();
  await button(page, "WoodStorage").click();
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
  await button(page, "STORAGE").click();
  await button(page, "WoodStorage").click();
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

test("the ring is red where the cleared wood does not fit", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 5 }));
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  const { x, y } = await hoverOrigin(page);
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.isRingBlocked()))
    .toBe(true);
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("Forest");
});
