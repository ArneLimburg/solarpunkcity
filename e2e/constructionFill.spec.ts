import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  finishConstruction,
  grantWood,
  installClockWithNativeFrames,
  selectBuilding,
  tilePosition,
} from "./helpers";

const home = { q: 0, r: 0 }; // single-hex site
const farm = { q: 0, r: -3 }; // center of the 7 tile farm

async function place(
  page: Page,
  type: string,
  label: string,
  coords: { q: number; r: number },
  size: number,
) {
  await selectBuilding(page, "Farms", label);
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
  await page.keyboard.press("Escape");
}

const fill = (page: Page, coords: { q: number; r: number }) =>
  page.evaluate((c) => window.__solarpunk?.getSiteFill(c), coords);

test("a single-hex and a multi-hex site fill up and give way to the model", async ({
  page,
}) => {
  test.setTimeout(180_000); // software rendering makes every pointer move slow
  // no week passes while the sites are placed (the slow pointer moves would
  // finish the homestead); the weeks are advanced by hand below
  await installClockWithNativeFrames(page);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await place(page, "OrganicHomestead", "Organic homestead", home, 1);
  await place(page, "Farm", "Farm", farm, 7);

  // every site has its own blueprint; nothing is built yet, so none is filled
  expect(await fill(page, home)).toBe(0);
  expect(await fill(page, farm)).toBe(0);
  // sites show the blueprint and no finished model
  expect(
    await page.evaluate((c) => window.__solarpunk?.getModelCount(c), home),
  ).toBe(0);

  // the workers fill the homestead from the ground up
  await page.clock.runFor(1000);
  await expect
    .poll(async () => (await fill(page, home)) ?? 1, { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(await fill(page, home)).toBeLessThan(1);

  // the homestead is older and takes the labor, so the farm is still empty
  expect(await fill(page, farm)).toBe(0);

  // a finished building replaces its blueprint
  await finishConstruction(page);
  await expect.poll(() => fill(page, home)).toBeUndefined();
  await expect.poll(() => fill(page, farm)).toBeUndefined();
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getModelCount(c), farm),
    )
    .toBe(1);
});

test("a multi-hex site is filled partly from the ground up", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await installClockWithNativeFrames(page);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  // alone on the map, the farm gets all workers of the week
  await place(page, "Farm", "Farm", farm, 7);
  expect(await fill(page, farm)).toBe(0);

  await page.clock.runFor(1000);
  await expect
    .poll(async () => (await fill(page, farm)) ?? 1, { timeout: 30_000 })
    .toBeGreaterThan(0);
  expect(await fill(page, farm)).toBeLessThan(1);
});
