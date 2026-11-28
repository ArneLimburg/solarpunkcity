import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  grantWood,
  openCategory,
  selectBuilding,
  tilePosition,
} from "./helpers";

const origin = { q: 0, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
}

const panel = (page: Page) => page.getByTestId("building-details");
const row = (page: Page, label: string) =>
  page.getByRole("button", { name: label, exact: true });
const chip = (page: Page, section: string, name: string) =>
  panel(page).getByTestId(section).getByTestId(`detail-${name}`);
const detail = (page: Page, name: string) =>
  panel(page).getByTestId(`detail-${name}`);

test("shows the organic homestead details", async ({ page }) => {
  await setup(page);
  await expect(panel(page)).toHaveCount(0);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toContainText("Organic homestead");
  await expect(panel(page)).toContainText("Produces food for the residents");
  await expect(detail(page, "size")).toHaveText(/1 tile$/);
  await expect(detail(page, "residents")).toHaveText(/3$/);
  await expect(detail(page, "ecology")).toHaveText(/\+0\.5$/);
  await expect(chip(page, "details-cost", "wood")).toHaveText(
    /4 during construction$/,
  );
  await expect(panel(page).getByTestId("details-wood-per-builder")).toHaveText(
    "Wood per builder-week: 0.1",
  );
  await expect(chip(page, "details-produces", "food")).toHaveText(/3$/);
  await expect(chip(page, "details-consumes", "labor")).toHaveText(/2$/);
  await expect(chip(page, "details-cost", "labor")).toHaveText(/32$/);
  await expect(chip(page, "details-cost", "labor")).not.toHaveClass(/error/);
  await expect(panel(page).getByTestId("details-builders")).toHaveText(
    "Builders per week: max 2",
  );
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
  await selectBuilding(page, "Farms", "Organic homestead");
  await selectBuilding(page, "Farms", "Agro-industrial Farm");
  await expect(panel(page)).toContainText("Agro-industrial Farm");
  await expect(detail(page, "size")).toHaveText(/19 tiles$/);
  await expect(detail(page, "residents")).toHaveText(/0$/);
  await expect(detail(page, "ecology")).toHaveText(/−5$/);
  await expect(chip(page, "details-cost", "planks")).toHaveText(
    /40 during construction$/,
  );
  await expect(chip(page, "details-cost", "wood")).toHaveCount(0);
  await expect(
    panel(page).getByTestId("details-planks-per-builder"),
  ).toHaveText("Planks per builder-week: 0.1");
  await expect(panel(page).getByTestId("details-wood-per-builder")).toHaveCount(
    0,
  );
  await expect(chip(page, "details-produces", "food")).toHaveText(/60$/);
  await expect(chip(page, "details-consumes", "labor")).toHaveText(/8$/);
});

test("omits empty sections for the apartment building", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Residential", "Apartment building");
  await expect(detail(page, "residents")).toHaveText(/15$/);
  await expect(detail(page, "ecology")).toHaveText(/0$/);
  await expect(chip(page, "details-cost", "planks")).toHaveText(
    /6 during construction$/,
  );
  await expect(
    panel(page).getByTestId("details-planks-per-builder"),
  ).toHaveText("Planks per builder-week: 0.0");
  await expect(panel(page).getByTestId("details-produces")).toHaveCount(0);
  await expect(panel(page).getByTestId("details-consumes")).toHaveCount(0);
});

test("hides after Escape and deselecting, stays while placing", async ({
  page,
}) => {
  test.slow();
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);

  await selectBuilding(page, "Farms", "Organic homestead");
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toHaveCount(0);

  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toBeVisible();
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  // the type stays selected for the next copy until Escape
  await expect(panel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});

test("sits at the bottom edge on mobile, fits the screen and keeps the selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await selectBuilding(page, "Residential", "Wooden house");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Build: Wooden house" }),
  ).toBeVisible();
  const details = (await panel(page).boundingBox())!;
  expect(details.x).toBeGreaterThanOrEqual(0);
  expect(details.x + details.width).toBeLessThanOrEqual(375);
  expect(details.width).toBeGreaterThan(375 * 0.9);
  expect(details.height).toBeLessThanOrEqual(812 / 2 + 1);
  expect(details.y + details.height).toBeGreaterThan(812 - 24);
  expect(details.y + details.height).toBeLessThanOrEqual(812);
});

test("sits above the bar at the left on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setup(page);
  await selectBuilding(page, "Residential", "Wooden house");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  const bar = (await page.getByTestId("build-bar").boundingBox())!;
  const details = (await panel(page).boundingBox())!;
  expect(details.y + details.height).toBeLessThanOrEqual(bar.y + 1);
  expect(details.x).toBeLessThan(400);
  expect(details.width).toBeLessThanOrEqual(360);
  await expect(
    page.getByRole("button", { name: "Cancel placement" }),
  ).toBeVisible();
});

test("has a close icon, a pointer cursor and an aria-label", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toHaveAttribute(
    "aria-label",
    "Hide building details",
  );
  await expect(panel(page)).toHaveCSS("cursor", "pointer");
  await expect(panel(page).locator("i", { hasText: "close" })).toHaveCount(1);
});

test("hides on click, keeps the selection and shows again on reselect", async ({
  page,
}) => {
  test.slow();
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  const homestead = row(page, "Organic homestead");
  await panel(page).click();
  await expect(panel(page)).toHaveCount(0);
  await openCategory(page, "Farms");
  await expect(homestead).toHaveAttribute("aria-pressed", "true");

  await homestead.click();
  await expect(panel(page)).toHaveCount(0);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(panel(page)).toBeVisible();

  await panel(page).click();
  await expect(panel(page)).toHaveCount(0);
  await selectBuilding(page, "Farms", "Agro-industrial Farm");
  await expect(panel(page)).toBeVisible();
});

test("hiding the details keeps the blueprint, Cancel placement clears it", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await panel(page).click();
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  // the building stays selected for the next copy until it is cancelled
  const cancel = page.getByRole("button", { name: "Cancel placement" });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(cancel).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
});

test("clicking the panel does not build below it, building still works", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await panel(page).click();
  await page.waitForTimeout(300);
  await expect(panel(page)).toHaveCount(0);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");

  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
});

test("shows the sawmill with its storage", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Production", "Sawmill");
  await expect(panel(page)).toContainText("Saws logs into planks");
  await expect(chip(page, "details-cost", "wood")).toHaveText(
    /15 during construction$/,
  );
  await expect(chip(page, "details-storage", "planks")).toHaveText(/20$/);
  await expect(chip(page, "details-produces", "planks")).toHaveText(/2$/);
  await expect(chip(page, "details-consumes", "wood")).toHaveText(/4$/);
  await expect(chip(page, "details-consumes", "labor")).toHaveText(/2$/);
  await expect(panel(page).getByTestId("details-builders")).toHaveText(
    "Builders per week: max 3",
  );
});

test("does not mark the materials of a construction site as unaffordable", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: -110 }));
  await selectBuilding(page, "Farms", "Agro-industrial Farm");
  await expect(chip(page, "details-cost", "planks")).toBeVisible();
  await expect(chip(page, "details-cost", "planks")).not.toHaveClass(/error/);
  await expect(chip(page, "details-produces", "food")).not.toHaveClass(/error/);
  await expect(chip(page, "details-consumes", "labor")).not.toHaveClass(
    /error/,
  );
});
