import { test, expect, type Page } from "@playwright/test";
import type { HexCoordinates } from "../src/board";

const origin = { q: 0, r: 0 };
const east = { q: 3, r: 0 };
const next = { q: 1, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  await page.getByRole("button", { name: "FARM", exact: true }).click();
  await page.getByRole("button", { name: "OrganicHomestead" }).click();
}

// pixel position of a tile in page coordinates
async function tilePosition(page: Page, coords: HexCoordinates) {
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

const buildingAt = (page: Page, coords: HexCoordinates) =>
  page.evaluate((c) => window.__solarpunk?.getBuildingType(c), coords);
const ringTile = (page: Page) =>
  page.evaluate(() => window.__solarpunk?.getRingTile());

test.describe("mouse", () => {
  test("hovering moves the ring without building", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await expect.poll(() => ringTile(page)).toEqual(origin);
    expect(await buildingAt(page, origin)).toBe("Forest");
  });

  test("clicking builds", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await page.mouse.click(x, y);
    await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  });

  test("dragging does not build", async ({ page }) => {
    await setup(page);
    const from = await tilePosition(page, origin);
    const to = await tilePosition(page, east);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    // wait longer than Babylon's double tap detection
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("Forest");
    expect(await buildingAt(page, east)).toBe("Forest");
  });

  test("right click does not build", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.click(x, y, { button: "right" });
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("Forest");
  });

  test("ring is hidden outside the board", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await expect.poll(() => ringTile(page)).toEqual(origin);
    const box = await page.locator("canvas").boundingBox();
    // the top of the canvas shows the sky
    await page.mouse.move(x, (box?.y ?? 0) + 2);
    await expect.poll(() => ringTile(page)).toBeNull();
  });
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("first tap moves the ring without building", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => ringTile(page)).toEqual(origin);
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("Forest");
  });

  test("second tap on the ring builds", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => ringTile(page)).toEqual(origin);
    // two quick taps would count as a double tap in Babylon
    await page.waitForTimeout(500);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  });

  test("tap on another tile moves the ring without building", async ({
    page,
  }) => {
    await setup(page);
    const first = await tilePosition(page, origin);
    const second = await tilePosition(page, next);
    await page.touchscreen.tap(first.x, first.y);
    await expect.poll(() => ringTile(page)).toEqual(origin);
    // Babylon counts two quick taps as a double tap even on different tiles
    await page.waitForTimeout(500);
    await page.touchscreen.tap(second.x, second.y);
    await expect.poll(() => ringTile(page)).toEqual(next);
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("Forest");
    expect(await buildingAt(page, next)).toBe("Forest");
  });
});
