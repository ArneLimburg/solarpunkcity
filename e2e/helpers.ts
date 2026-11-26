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

// opens the build panel if needed and selects a building by category tab and label
export async function selectBuilding(
  page: Page,
  category: string,
  label: string,
) {
  const build = page.getByRole("button", { name: /^Build/ });
  if ((await build.getAttribute("aria-expanded")) !== "true") {
    await build.click();
  }
  await page.getByRole("tab", { name: category, exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

// opens a HUD dropdown ("Workers" or "More") and returns its panel
export async function openDropdown(
  page: Page,
  id: "workers" | "more" | "date",
) {
  const button = page.getByTestId(`hud-${id}-button`);
  if ((await button.getAttribute("aria-expanded")) !== "true") {
    await button.click();
  }
  return page.getByTestId(`hud-${id}`);
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

type NativeFrames = {
  __nativeRequestAnimationFrame: typeof requestAnimationFrame;
  __nativeCancelAnimationFrame: typeof cancelAnimationFrame;
};

// Freezes the timers (no week is calculated) but keeps the browser's own animation frames.
// The fake requestAnimationFrame of page.clock fires every 16 ms whether or not the GPU has
// finished the last frame; with software rendering the frames pile up until the page no longer
// responds and closing it times out.
export async function installClockWithNativeFrames(page: Page) {
  await page.addInitScript(() => {
    const native = window as unknown as NativeFrames;
    native.__nativeRequestAnimationFrame =
      window.requestAnimationFrame.bind(window);
    native.__nativeCancelAnimationFrame =
      window.cancelAnimationFrame.bind(window);
  });
  await page.clock.install({ time: 0 });
  // install() lets the fake time flow; pausing stops the weekly interval for good
  await page.clock.pauseAt(1000);
  await page.addInitScript(() => {
    const native = window as unknown as NativeFrames;
    window.requestAnimationFrame = native.__nativeRequestAnimationFrame;
    window.cancelAnimationFrame = native.__nativeCancelAnimationFrame;
  });
}

// Replaces Math.random by a seeded generator (mulberry32) before the page
// loads, so the settler roster and their walks are the same in every run.
export const seedRandom = (page: Page, seed: number) =>
  page.addInitScript((initial) => {
    let state = initial;
    Math.random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
