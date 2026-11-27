import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  finishConstruction,
  grantWood,
  installClockWithNativeFrames,
  selectBuilding,
  tilePosition,
} from "./helpers";

const origin = { q: 0, r: 0 };
// the 800x600 viewport has the panels at the bottom left, keep the tiles above
const farm = { q: 0, r: -3 }; // center of the 7 tile farm
const farmEdge = { q: 1, r: -3 };
const house = { q: 3, r: -3 };
const forest = { q: -2, r: -2 };

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
  label: string,
  coords: { q: number; r: number },
  size = 1,
) {
  await selectBuilding(page, category, label);
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
  // the type stays selected after placing, Escape ends the build mode
  await page.keyboard.press("Escape");
  await expect(info(page)).toHaveCount(0);
}

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page); // the wood storages raise the cap of the wood
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  await place(page, "Farms", "OrganicHomestead", "Organic homestead", origin);
  await place(page, "Farms", "Farm", "Farm", farm, 7);
  await place(
    page,
    "Residential",
    "AppartmentBuilding",
    "Apartment building",
    house,
  );
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
  await expect(info(page).getByTestId("info-no-data")).toHaveCount(0);
  await expect(info(page).getByTestId("info-progress")).toHaveText(
    /^\d+% complete$/,
  );
  await expect(info(page).getByTestId("info-remaining-work")).toContainText(
    "worker-weeks",
  );
  await expect(info(page).getByTestId("info-builders")).toContainText("/ 4");
  await expect(info(page).getByTestId("info-residents")).toHaveCount(0);
  const percent = (await info(page)
    .getByTestId("info-progress")
    .textContent())!.replace(/% complete$/, "");
  // the map label shows the same value
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getProgressLabel()))
    .toBe(`${percent}%`);

  // the house needs planks that do not exist, so nobody builds it
  await expect(info(page).getByTestId("info-waiting")).toHaveText(
    "Waiting for builders",
  );
  await expect(info(page).getByTestId("info-progress")).toHaveText(
    "0% complete",
  );

  // after the construction and the next tick the last week is shown
  await finishConstruction(page);
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getProgressLabel()))
    .toBeUndefined();
  await expect(info(page).getByTestId("info-last-week")).toBeVisible();
  await expect(info(page).getByTestId("info-no-data")).toHaveCount(0);
  await expect(info(page).getByTestId("info-residents-count")).toHaveText(
    "0 / 15",
  );
  await expect(info(page).getByTestId("info-no-residents")).toBeVisible();

  // the farm is more efficient, so the homestead is not needed
  await click(page, origin);
  await expect(info(page)).toContainText("Organic homestead");
  await expect(info(page).getByTestId("info-center")).toHaveText("0, 0");
  await expect(info(page).getByTestId("info-ecology")).toHaveText(/\+0\.5$/);
  await expect(info(page).getByTestId("info-workers")).toHaveText(
    "Workers 0 / 2",
  );
  await expect(info(page).getByTestId("info-status")).toHaveText("Not needed");
  await expect(info(page).getByTestId("info-field-efficiency")).toHaveText(
    "Field efficiency 100%",
  );

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
  await selectBuilding(page, "Farms", "Organic homestead");
  await expect(info(page)).toHaveCount(0);
  await click(page, forest);
  await expect(info(page)).toHaveCount(0);
});

test("the building info is a bottom panel on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await click(page, origin);
  await expect(info(page)).toContainText("Settlers' camp");
  const box = (await info(page).boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(812 - 20);
  expect(box.height).toBeLessThanOrEqual(812 * 0.4 + 1);
});

test("the close button closes the building info on the right", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await click(page, origin);
  await expect(info(page)).toContainText("Settlers' camp");
  const box = (await info(page).boundingBox())!;
  expect(box.x + box.width / 2).toBeGreaterThan(400);
  await page.getByRole("button", { name: "Close building info" }).click();
  await expect(info(page)).toHaveCount(0);
});

for (const size of [
  { width: 800, height: 600 },
  { width: 375, height: 812 },
]) {
  test(`building, profile and home link are connected at ${size.width} x ${size.height}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(size);
    await page.goto("./");
    await page.waitForFunction(() => window.__solarpunk !== undefined);
    await click(page, origin);
    await expect(info(page).getByTestId("info-residents-count")).toHaveText(
      "2 / 2",
    );
    const links = info(page).getByTestId("info-resident-list").locator("a");
    await expect(links).toHaveCount(2);
    const name = (await links.first().textContent())!;

    // a name opens the profile instead of the building
    await links.first().click();
    await expect(page.getByTestId("settler-name")).toHaveText(name);
    await expect(info(page)).toHaveCount(0);
    await expect(page.getByTestId("settler-home-link")).toHaveText(
      "Settlers' camp",
    );

    // the home link switches back
    await page.getByTestId("settler-home-link").click();
    await expect(page.getByTestId("settler-profile")).toHaveCount(0);
    await expect(info(page).getByTestId("info-center")).toHaveText("0, 0");
  });
}

test("the profile shows a settler without a home as unhoused", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  // building over the camp leaves the settlers without a home
  await selectBuilding(page, "Production", "Sawmill");
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTiles().length))
    .toBe(1);
  await page.mouse.click(x, y);
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getBuildingType(c), origin),
    )
    .toBe("Sawmill");
  await page.keyboard.press("Escape");

  // tap a settler until the profile opens (they keep walking)
  const canvas = (await page.locator("canvas").boundingBox())!;
  const [settler] = await page.evaluate(() =>
    window.__solarpunk!.getSettlers(),
  );
  await expect
    .poll(
      async () => {
        const at = await page.evaluate(
          (id) => window.__solarpunk!.settlerToScreen(id, "body"),
          settler.id,
        );
        if (at) {
          await page.mouse.move(canvas.x + at.x, canvas.y + at.y);
          await page.mouse.click(canvas.x + at.x, canvas.y + at.y);
        }
        return page.getByTestId("settler-profile").count();
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBe(1);
  await expect(page.getByTestId("settler-home")).toContainText("Unhoused");
  await expect(page.getByTestId("settler-home-link")).toHaveCount(0);
});

test("the info shows the wood stock and the weeks left of a construction", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await place(page, "Storage", "WoodStorage", "Wood storage", forest);
  await click(page, forest);
  await expect(info(page).getByTestId("info-wood-stock")).toContainText(
    "Wood stock",
  );
  await page.keyboard.press("Escape");

  // the settlers work on the sawmill, so the estimate appears
  await place(page, "Production", "Sawmill", "Sawmill", farm);
  await click(page, farm);
  await expect(info(page).getByTestId("info-weeks")).toContainText("left", {
    timeout: 60_000,
  });
});

test("the info panel reflects a housing change", async ({ page }) => {
  test.setTimeout(180_000);
  // no week is calculated: with the camp replaced by a site nothing produces
  // food, and hunger would shrink the population while the test is slow
  await installClockWithNativeFrames(page);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  await place(
    page,
    "Residential",
    "AppartmentBuilding",
    "Apartment building",
    house,
  );
  await finishConstruction(page);
  await click(page, house);
  const count = info(page).getByTestId("info-residents-count");
  await expect(count).toHaveText("0 / 15");
  await page.keyboard.press("Escape");

  // building over the camp moves both settlers into the apartment building
  await place(page, "Farms", "OrganicHomestead", "Organic homestead", origin);
  await click(page, house);
  await expect(count).toHaveText("2 / 15");
  const links = info(page).getByTestId("info-resident-list").locator("a");
  await expect(links).toHaveCount(2);

  // the profile links to the apartment building
  await links.first().click();
  await expect(page.getByTestId("settler-home-link")).toHaveText(
    "Appartment Building",
  );
});
