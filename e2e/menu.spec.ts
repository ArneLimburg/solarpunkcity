import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { buildingAt, tilePosition } from "./helpers";

const origin = { q: 0, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
}

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

async function selectHomestead(page: Page) {
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
}

async function clickOrigin(page: Page) {
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  // wait longer than Babylon's double click detection
  await page.waitForTimeout(500);
}

test("highlights only the selected type and its category", async ({ page }) => {
  await setup(page);
  await selectHomestead(page);
  await button(page, "FARM").click();
  await expect(button(page, "OrganicHomestead")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(button(page, "Farm")).toHaveAttribute("aria-pressed", "false");
  await expect(button(page, "AgroIndustrial")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(button(page, "OrganicHomestead")).toHaveClass(/large-elevate/);
  await expect(button(page, "Farm")).toHaveClass(/small-elevate/);
  await button(page, "FARM").click();
  await expect(button(page, "FARM")).toHaveClass(/large-elevate/);
  await expect(button(page, "RESIDENTIAL")).not.toHaveClass(/large-elevate/);
});

test("reopening a category shows the selected building large", async ({
  page,
}) => {
  await setup(page);
  await selectHomestead(page);
  await button(page, "FARM").click();
  await expect(button(page, "OrganicHomestead")).toHaveClass(/large-elevate/);
  await expect(button(page, "Farm")).toHaveClass(/small-elevate/);
});

test("a second click on the open category closes it", async ({ page }) => {
  await setup(page);
  await selectHomestead(page);
  await button(page, "FARM").click();
  await expect(button(page, "FARM")).toHaveAttribute("aria-expanded", "true");
  await button(page, "FARM").click();
  await expect(button(page, "FARM")).toHaveAttribute("aria-expanded", "false");
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
});

test("opening another category closes the open one", async ({ page }) => {
  await setup(page);
  await button(page, "FARM").click();
  await button(page, "RESIDENTIAL").click();
  await expect(button(page, "RESIDENTIAL")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(button(page, "FARM")).toHaveAttribute("aria-expanded", "false");
});

test("a click on the map closes the category and builds", async ({ page }) => {
  await setup(page);
  await selectHomestead(page);
  await button(page, "FARM").click();
  await expect(button(page, "FARM")).toHaveAttribute("aria-expanded", "true");
  await clickOrigin(page);
  await expect(button(page, "FARM")).toHaveAttribute("aria-expanded", "false");
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
});

test("Escape clears the selection", async ({ page }) => {
  await setup(page);
  await selectHomestead(page);
  await page.keyboard.press("Escape");
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("Forest");
});

test("a click on the selected type clears the selection", async ({ page }) => {
  await setup(page);
  await selectHomestead(page);
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("Forest");
});
