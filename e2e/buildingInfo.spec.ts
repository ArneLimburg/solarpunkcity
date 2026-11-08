import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { finishConstruction, tilePosition } from "./helpers";

const origin = { q: 0, r: 0 };
// the 800x600 viewport has the panels at the bottom left, keep the tiles above
const farm = { q: 0, r: -3 }; // center of the 7 tile farm
const farmEdge = { q: 1, r: -3 };
const house = { q: 3, r: -3 };
const forest = { q: -2, r: -2 };

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const info = (page: Page) => page.getByTestId("building-info");

async function click(page: Page, coords: { q: number; r: number }) {
  const { x, y } = await tilePosition(page, coords);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
}

async function place(
  page: Page,
  category: string,
  type: string,
  coords: { q: number; r: number },
  size = 1,
) {
  await button(page, category).click();
  await button(page, type).click();
  const { x, y } = await tilePosition(page, coords);
  await page.mouse.move(x, y, { steps: 5 });
  // the click builds on the hovered footprint, so wait until the ring covers it
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTiles().length))
    .toBe(size);
  await page.mouse.click(x, y);
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getBuildingType(c), coords),
    )
    .toBe(type);
  // placing deselects the type
  await expect(info(page)).toHaveCount(0);
}

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 200 }));
  await place(page, "FARM", "OrganicHomestead", origin);
  await place(page, "FARM", "Farm", farm, 7);
  await place(page, "RESIDENTIAL", "AppartmentBuilding", house);
}

test("opens, updates, switches and closes the building info", async ({
  page,
}) => {
  test.setTimeout(180_000); // software rendering makes every pointer move slow
  await setup(page);

  // placing did not open the panel; the site of the house has no data yet
  await click(page, house);
  await expect(info(page)).toContainText("Appartment Building");
  await expect(info(page).getByTestId("info-center")).toHaveText("3, -3");
  await expect(info(page).getByTestId("info-no-data")).toBeVisible();

  // after the construction and the next tick the last week is shown
  await finishConstruction(page);
  await expect(info(page).getByTestId("info-last-week")).toBeVisible();
  await expect(info(page).getByTestId("info-no-data")).toHaveCount(0);
  await expect(info(page).getByTestId("info-residents")).toHaveText(
    /Residents \d+ \/ 15 \(\d+ %\)/,
  );

  // the farm is more efficient, so the homestead is not needed
  await click(page, origin);
  await expect(info(page)).toContainText("Organic homestead");
  await expect(info(page).getByTestId("info-center")).toHaveText("0, 0");
  await expect(info(page).getByTestId("info-ecology")).toHaveText(/\+0\.5$/);
  await expect(info(page).getByTestId("info-workers")).toHaveText(
    "Workers 0 / 2",
  );
  await expect(info(page).getByTestId("info-status")).toHaveText("Not needed");

  // any footprint tile selects the farm; the panel shows its center
  await click(page, farmEdge);
  await expect(info(page)).toContainText("Farm");
  await expect(info(page).getByTestId("info-center")).toHaveText("0, -3");
  await expect(info(page).getByTestId("info-ecology")).toHaveText(/\+1\.4$/);
  await expect(info(page).getByTestId("info-workers")).toHaveText(
    /Workers \d+ \/ 4/,
  );
  await expect(
    info(page).getByTestId("info-produced").getByTestId("info-food"),
  ).toBeVisible();

  // switching to the apartment building
  await click(page, house);
  await expect(info(page)).toContainText("Appartment Building");

  // the same building again closes it
  await click(page, house);
  await expect(info(page)).toHaveCount(0);

  // forest never opens it and closes it
  await click(page, forest);
  await expect(info(page)).toHaveCount(0);
  await click(page, origin);
  await expect(info(page)).toBeVisible();
  await click(page, forest);
  await expect(info(page)).toHaveCount(0);

  // Escape closes it
  await click(page, origin);
  await expect(info(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(info(page)).toHaveCount(0);

  // selecting a building type closes it and builds instead of selecting
  await click(page, origin);
  await expect(info(page)).toBeVisible();
  await button(page, "FARM").click();
  await button(page, "OrganicHomestead").click();
  await expect(info(page)).toHaveCount(0);
  await click(page, forest);
  await expect(info(page)).toHaveCount(0);
});
