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

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const buildButton = (page: Page) =>
  page.getByRole("button", { name: /^Build/ });
const cancelButton = (page: Page) =>
  page.getByRole("button", { name: /Cancel placement$/ });

async function clickOrigin(page: Page) {
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  // wait longer than Babylon's double click detection
  await page.waitForTimeout(500);
}

test("marks only the selected building and its open category", async ({
  page,
}) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  // selecting closes the list
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(button(page, "Farms")).toHaveAttribute("aria-expanded", "false");
  await openCategory(page, "Farms");
  await expect(button(page, "Organic homestead")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(button(page, "Farm")).toHaveAttribute("aria-pressed", "false");
  await expect(button(page, "Agro-industrial Farm")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(button(page, "Farms")).toHaveAttribute("aria-expanded", "true");
  await expect(button(page, "Residential")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("a category shows its buildings with the material cost, one at a time", async ({
  page,
}) => {
  await setup(page);
  await openCategory(page, "Residential");
  await expect(button(page, "Apartment building")).toBeVisible();
  await expect(button(page, "Farm")).toHaveCount(0);
  await expect(page.getByTestId("build-cost-AppartmentBuilding")).toHaveText(
    /6$/,
  );
  await expect(
    page.getByTestId("build-cost-AppartmentBuilding"),
  ).not.toHaveClass(/error/);
  await expect(button(page, "Wooden house")).toBeVisible();
  await expect(page.getByTestId("build-cost-WoodenHouse")).toHaveText(/10$/);
  await openCategory(page, "Production");
  await expect(button(page, "Sawmill")).toBeVisible();
  await expect(page.getByTestId("build-cost-Sawmill")).toHaveText(/15$/);
  await expect(button(page, "Apartment building")).toHaveCount(0);
  await expect(button(page, "Residential")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("a category button toggles its list on Enter and Space", async ({
  page,
}) => {
  await setup(page);
  const farms = button(page, "Farms");
  await farms.focus();
  await page.keyboard.press("Enter");
  await expect(farms).toHaveAttribute("aria-expanded", "true");
  await expect(button(page, "Farm")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(farms).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(button(page, "Residential")).toBeFocused();
});

test("desktop: the bar shows a button per category and Cancel placement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setup(page);
  const bar = page.getByTestId("build-bar");
  await expect(bar).toBeVisible();
  await expect(page.locator(".hud-build")).toHaveCount(0);
  await expect(bar.getByRole("button")).toHaveText([
    "Farms",
    "Residential",
    "Storage",
    "Production",
    "Energy",
    "Leisure",
  ]);
  await expect(cancelButton(page)).toHaveCount(0);
  await selectBuilding(page, "Residential", "Wooden house");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(page.getByTestId("building-details")).toBeVisible();
  await expect(cancelButton(page)).toBeVisible();
  await cancelButton(page).click();
  await expect(cancelButton(page)).toHaveCount(0);
  await expect(page.getByTestId("building-details")).toHaveCount(0);
  const box = (await bar.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  expect(box.y + box.height).toBeGreaterThan(800 - 24);
});

test("Escape clears the blueprint and closes the list", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await openCategory(page, "Farms");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(cancelButton(page)).toHaveCount(0);
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});

test("a click on the map builds and keeps the blueprint", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  await expect(cancelButton(page)).toBeVisible();
  // the building stays selected for the next copy
  await openCategory(page, "Farms");
  await expect(button(page, "Organic homestead")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test.describe("locked building types", () => {
  test.use({ unlockAll: false });

  test("the apartment building needs a sawmill, which needs a power plant", async ({
    page,
  }) => {
    await setup(page);
    await openCategory(page, "Residential");
    const apartment = button(page, "Apartment building");
    await expect(apartment).toHaveAttribute("aria-disabled", "true");
    await expect(
      page.getByTestId("build-lock-AppartmentBuilding"),
    ).toBeVisible();
    await expect(page.getByTestId("build-cost-AppartmentBuilding")).toHaveCount(
      0,
    );
    await expect(
      page.getByTestId("build-lock-reason-AppartmentBuilding"),
    ).toHaveText("Needs a sawmill");
    // a locked entry cannot be selected
    // (Playwright waits for aria-disabled buttons to be enabled, so force it)
    await apartment.click({ force: true });
    await expect(apartment).toHaveAttribute("aria-pressed", "false");
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(button(page, "Wooden house")).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await openCategory(page, "Production");
    await expect(page.getByTestId("build-lock-reason-Sawmill")).toHaveText(
      "Needs a power plant",
    );
    await openCategory(page, "Farms");
    await expect(
      page.getByTestId("build-lock-reason-AgroIndustrial"),
    ).toHaveText("Needs a sawmill and a power plant");

    // a power plant unlocks the sawmill, the sawmill the apartment building
    await page.evaluate(() => {
      window.__solarpunk?.addSolarField({ q: 5, r: 5 });
      window.__solarpunk?.finishConstruction();
    });
    await selectBuilding(page, "Production", "Sawmill");
    await clickOrigin(page);
    expect(await buildingAt(page, origin)).toBe("Sawmill");
    await page.evaluate(() => window.__solarpunk?.finishConstruction());
    await openCategory(page, "Residential");
    await expect(apartment).not.toHaveAttribute("aria-disabled", "true");
    await apartment.click();
    await expect(apartment).toHaveAttribute("aria-pressed", "true");
    await clickOrigin(page);
    expect(await buildingAt(page, origin)).toBe("AppartmentBuilding");
  });
});

test("all menu icons load and the farm types differ", async ({ page }) => {
  await setup(page);
  await openCategory(page, "Farms");
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
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(cancelButton(page)).toHaveCount(0);
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});

test("clicking the bar and its list builds nothing", async ({ page }) => {
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await openCategory(page, "Farms");
  const bar = (await page.getByTestId("build-bar").boundingBox())!;
  // the padding at the left edge of the bar, beside the first button
  await page.mouse.click(bar.x + 3, bar.y + bar.height / 2);
  const list = (await page.getByTestId("build-panel").boundingBox())!;
  // inset beyond the rounded corner, which does not take pointer events
  await page.mouse.click(list.x + list.width - 8, list.y + list.height - 8);
  await expect(cancelButton(page)).toBeVisible();
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
});

test("mobile: the Build menu is an accordion and closes on selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await expect(page.getByTestId("build-bar")).toHaveCount(0);
  await expect(buildButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(buildButton(page)).toHaveText(/^constructionBuild$/);
  await buildButton(page).click();
  await expect(buildButton(page)).toHaveAttribute("aria-expanded", "true");
  await button(page, "Residential").click();
  await expect(button(page, "Residential")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await button(page, "Farms").click();
  await expect(button(page, "Residential")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(button(page, "Wooden house")).toHaveCount(0);
  await button(page, "Residential").click();
  const box = (await page.getByTestId("build-panel").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y + box.height).toBeLessThanOrEqual(812);
  await button(page, "Wooden house").click();
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await expect(buildButton(page)).toHaveText(/Build: Wooden house$/);
  await expect(cancelButton(page)).toHaveText(/✕ Cancel placement$/);
  await expect(page.getByTestId("building-details")).toBeVisible();
  // the Build button opens and closes the whole menu
  await buildButton(page).click();
  await expect(page.getByTestId("build-panel")).toBeVisible();
  await buildButton(page).click();
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await cancelButton(page).click();
  await expect(buildButton(page)).toHaveText(/^constructionBuild$/);
  await expect(page.getByTestId("building-details")).toHaveCount(0);
});

test("mobile: places from the closed menu after hiding the details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await setup(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(buildButton(page)).toHaveText(/Build: Organic homestead$/);
  await button(page, "Hide building details").click();
  await clickOrigin(page);
  expect(await buildingAt(page, origin)).toBe("OrganicHomestead");
  await page.keyboard.press("Escape");
  await expect(cancelButton(page)).toHaveCount(0);
});
