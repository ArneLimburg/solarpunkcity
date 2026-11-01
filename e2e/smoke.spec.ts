import { test, expect } from "@playwright/test";
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
