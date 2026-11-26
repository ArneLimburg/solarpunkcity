import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { buildingAt, grantWood, selectBuilding, tilePosition } from "./helpers";

const origin = { q: 0, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
}

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name, exact: true });
const buildButton = (page: Page) =>
  page.getByRole("button", { name: /^Build/ });

async function clickOrigin(page: Page) {
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  // wait longer than Babylon's double click detection
  await page.waitForTimeout(500);
}

test("marks only the selected building and its category tab", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(button(page, "Organic homestead")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(button(page, "Farm")).toHaveAttribute("aria-pressed", "false");
  await expect(button(page, "Agro-industrial Farm")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(tab(page, "Farms")).toHaveAttribute("aria-selected", "true");
  await expect(tab(page, "Residential")).toHaveAttribute(
    "aria-selected",
    "false",
  );
});

test("a tab shows its buildings with the wood cost", async ({ page }) => {
  await setup(page);
  await buildButton(page).click();
  await tab(page, "Residential").click();
  await expect(button(page, "Apartment building")).toBeVisible();
  await expect(button(page, "Farm")).toHaveCount(0);
  await expect(page.getByTestId("build-cost-AppartmentBuilding")).toHaveText(
    /10$/,
  );
  await expect(
    page.getByTestId("build-cost-AppartmentBuilding"),
  ).not.toHaveClass(/error/);
});

test("the Build button toggles the panel and shows the selection while collapsed", async ({
  page,
}) => {
  await setup(page);
  await expect(buildButton(page)).toHaveAttribute("aria-expanded", "false");
  await selectBuilding(page, "Farms", "Farm");
  await expect(buildButton(page)).toHaveAttribute("aria-expanded", "true");
  await expect(buildButton(page)).toHaveText(/^constructionBuild$/);
  await buildButton(page).click();
  await expect(buildButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(buildButton(page)).toHaveText(/Build: Farm$/);
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(page.getByTestId("building-details")).toBeVisible();
});

test("Escape clears the selection and collapses the panel", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(buildButton(page)).toHaveText(/Build$/);
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});

test("a click on the map builds and keeps the panel open", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  await expect(page.getByTestId("build-panel")).toBeVisible();
  await expect(button(page, "Organic homestead")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("placing works with the list collapsed", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await buildButton(page).click();
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
});

test("all menu icons load and the farm types differ", async ({ page }) => {
  await setup(page);
  await buildButton(page).click();
  const images = page.getByTestId("build-panel").locator("img");
  await expect(images).toHaveCount(3);
  await expect
    .poll(() =>
      images.evaluateAll((imgs) =>
        imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  const sources = await images.evaluateAll((imgs) =>
    imgs.map((img) => img.getAttribute("src")),
  );
  expect(new Set(sources).size).toBe(3);
});

test("a click on the selected building clears the selection", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await button(page, "Organic homestead").click();
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});

test("the build panel fits a narrow screen and places from the collapsed list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  const box = (await page.getByTestId("build-panel").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.height).toBeLessThanOrEqual(812 / 2 + 1);
  await buildButton(page).click();
  await expect(buildButton(page)).toHaveText(/Build: Organic homestead$/);
  // on a narrow screen the details panel covers the middle of the map
  await button(page, "Hide building details").click();
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
});
