import { test, expect } from "./fixtures";
import {
  grantWood,
  installClockWithNativeFrames,
  tilePosition,
} from "./helpers";
import { GRID_RADIUS } from "../src/board";
import { BuildingCategories, BuildingTypes } from "../src/gameDefinitions";

test("app loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  await page.goto("./");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  // let model preloading finish so that late errors are caught as well
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});

test("the tile layers hold exactly one finite matrix per board tile", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const stats = await page.evaluate(() =>
    window.__solarpunk!.getTileInstanceStats(),
  );
  const tileCount = 3 * GRID_RADIUS * (GRID_RADIUS + 1) + 1;
  expect(stats.instances).toBe(tileCount);
  expect(Number.isInteger(stats.instances)).toBe(true);
  expect(stats.finiteMatrices).toBe(tileCount);
});

test("menu shows categories", async ({ page }) => {
  await page.goto("./");
  const expected = Object.values(BuildingCategories).filter(
    (category) => category.buildable,
  );
  await expect(page.locator("header nav.top > .details > button")).toHaveCount(
    expected.length,
  );
});

test("category opens building list", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "FARM", exact: true }).click();
  const expected = Object.values(BuildingTypes).filter(
    (building) => building.category === "FARM",
  );
  await expect(page.locator("nav.list > button")).toHaveCount(expected.length);
});

test("status bar shows population", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByTestId("status-bar")).toBeVisible();
  await expect(page.getByTestId("status-population")).toContainText("2");
});

test("status bar shows the food stock and balance", async ({ page }) => {
  // freeze timers so that no week is calculated before the initial state is checked
  await installClockWithNativeFrames(page);
  await page.goto("./");
  const food = page.getByTestId("status-food");
  await expect(food).toHaveText(/^restaurant10 \(\+0\)$/);
  await expect(food).not.toHaveClass(/error/);
});

test("food entry is marked as error when the balance is negative", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  const food = page.getByTestId("status-food");
  // the settlers' camp feeds the 2 residents
  await expect(food).not.toHaveClass(/error/);
  // building over the camp removes the food production
  await page.getByRole("button", { name: "FARM", exact: true }).click();
  await page.getByRole("button", { name: "OrganicHomestead" }).click();
  const { x, y } = await tilePosition(page, { q: 0, r: 0 });
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect(food).toContainText("(−2)");
  await expect(food).toHaveClass(/error/);
});

test("status bar shows ecology and satisfaction", async ({ page }) => {
  // freeze timers so that no week changes the labor factor
  await installClockWithNativeFrames(page);
  await page.goto("./");
  // the camp tile has no ecology, so it is just below 100 %
  await expect(page.getByTestId("status-ecology")).toContainText("99 %");
  const satisfaction = page.getByTestId("status-satisfaction");
  await expect(satisfaction).toContainText("99 %");
  await expect(satisfaction).toHaveAttribute(
    "title",
    "Satisfaction: 99 % (ecology 99 %, work 100 %)",
  );
  await expect(satisfaction).toHaveAttribute("aria-label", "satisfaction");
  const labor = page.getByTestId("status-labor");
  await expect(labor).toHaveText(/0 \(0 %\)$/);
  await expect(labor).not.toHaveClass(/error/);
});

test("status bar shows a stock resource once it is available", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await expect(page.getByTestId("status-ore")).toHaveCount(0);
  await page.evaluate(() => window.__solarpunk?.addResources({ ore: 5 }));
  await expect(page.getByTestId("status-ore")).toContainText("5");
});

test("labor entry is marked as error when labor is not used well", async ({
  page,
}) => {
  await page.goto("./");
  // without storage no forest works, so all labor stays free after a week
  const labor = page.getByTestId("status-labor");
  await expect(labor).toHaveText(/2 \(100 %\)$/);
  await expect(labor).toHaveClass(/error/);
});
