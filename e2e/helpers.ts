import type { Page } from "@playwright/test";
import type { HexCoordinates } from "../src/board";

// pixel position of a tile in page coordinates
export async function tilePosition(page: Page, coords: HexCoordinates) {
  const box = await page.locator("canvas").boundingBox();
  const position = await page.evaluate(
    (c) => window.__solarpunk?.tileToScreen(c),
    coords,
  );
  if (!box || !position) {
    throw new Error(`tile ${coords.q},${coords.r} is not visible`);
  }
  return { x: box.x + position.x, y: box.y + position.y };
}

// room for 300 wood (three wood storages far away from the tiles the tests
// use) and 100 wood on top of the 9 wood from clearing the storage tiles
export async function grantWood(page: Page) {
  await page.evaluate(() => {
    for (const r of [2, 4, 6]) {
      window.__solarpunk?.addWoodStorage({ q: -8, r });
    }
    window.__solarpunk?.addResources({ wood: 100 });
  });
}

// skips the weeks of construction work
export const finishConstruction = (page: Page) =>
  page.evaluate(() => window.__solarpunk?.finishConstruction());

export const isUnderConstruction = (page: Page, coords: HexCoordinates) =>
  page.evaluate((c) => window.__solarpunk?.isUnderConstruction(c), coords);

export const buildingAt = (page: Page, coords: HexCoordinates) =>
  page.evaluate((c) => window.__solarpunk?.getBuildingType(c), coords);
