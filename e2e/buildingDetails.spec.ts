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
const panel = (page: Page) => page.getByTestId("building-details");
const chip = (page: Page, section: string, name: string) =>
  panel(page).getByTestId(section).getByTestId(`detail-${name}`);
const detail = (page: Page, name: string) =>
  panel(page).getByTestId(`detail-${name}`);

test("shows the organic homestead details", async ({ page }) => {
  await setup(page);
  await expect(panel(page)).toHaveCount(0);
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await expect(panel(page)).toContainText("Organic homestead");
  await expect(panel(page)).toContainText("Produces food for the residents");
  await expect(detail(page, "size")).toHaveText(/1 tile$/);
  await expect(detail(page, "residents")).toHaveText(/3$/);
  await expect(detail(page, "ecology")).toHaveText(/\+0\.5$/);
  await expect(chip(page, "details-cost", "wood")).toHaveText(/4$/);
  await expect(chip(page, "details-produces", "food")).toHaveText(/3$/);
  await expect(chip(page, "details-consumes", "labor")).toHaveText(/2$/);
  await expect(detail(page, "water")).toHaveCount(0);
  for (const side of ["Top", "Right", "Bottom", "Left"]) {
    await expect(panel(page)).toHaveCSS(
      `padding-${side.toLowerCase()}`,
      "16px",
    );
  }
});

test("updates when another type is selected", async ({ page }) => {
  await setup(page);
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await button(page, "FARM").click();
  await button(page, "AgroIndustrial").click();
  await expect(panel(page)).toContainText("Agro-industrial Farm");
  await expect(detail(page, "size")).toHaveText(/19 tiles$/);
  await expect(detail(page, "residents")).toHaveText(/0$/);
  await expect(detail(page, "ecology")).toHaveText(/−5$/);
  await expect(chip(page, "details-cost", "wood")).toHaveText(/65$/);
  await expect(chip(page, "details-produces", "food")).toHaveText(/60$/);
  await expect(chip(page, "details-consumes", "labor")).toHaveText(/8$/);
});

test("omits empty sections for the apartment building", async ({ page }) => {
  await setup(page);
  await button(page, "RESIDENTIAL").click();
  await button(page, "AppartmentBuilding").click();
  await expect(detail(page, "residents")).toHaveText(/15$/);
  await expect(detail(page, "ecology")).toHaveText(/0$/);
  await expect(chip(page, "details-cost", "wood")).toHaveText(/10$/);
  await expect(panel(page).getByTestId("details-produces")).toHaveCount(0);
  await expect(panel(page).getByTestId("details-consumes")).toHaveCount(0);
});

test("hides after Escape, deselecting and placing", async ({ page }) => {
  await setup(page);
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);

  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await expect(panel(page)).toHaveCount(0);

  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await expect(panel(page)).toBeVisible();
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  await expect(panel(page)).toHaveCount(0);
});

test("marks unaffordable costs and updates without reselecting", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: -110 }));
  await button(page, "FARM").click();
  await button(page, "AgroIndustrial").click();
  await expect(chip(page, "details-cost", "wood")).toHaveClass(/error/);
  await expect(chip(page, "details-produces", "food")).not.toHaveClass(/error/);
  await expect(chip(page, "details-consumes", "labor")).not.toHaveClass(
    /error/,
  );
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  await expect(chip(page, "details-cost", "wood")).not.toHaveClass(/error/);
});
