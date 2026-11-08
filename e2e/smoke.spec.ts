import { test, expect } from "./fixtures";
import { tilePosition } from "./helpers";
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
  await page.clock.install();
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
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
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
  await page.goto("./");
  // the camp tile has no ecology, so it is just below 100 %
  await expect(page.getByTestId("status-ecology")).toContainText("99 %");
  await expect(page.getByTestId("status-satisfaction")).toContainText("99 %");
});
