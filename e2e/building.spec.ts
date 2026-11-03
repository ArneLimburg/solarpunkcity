import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { buildingAt, tilePosition } from "./helpers";
import { GRID_RADIUS } from "../src/board";

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

  test("ring is hidden when the pointer leaves the canvas", async ({
    page,
  }) => {
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

test("hovering the ground outside the board hides the ring", async ({
  page,
}) => {
  await setup(page);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await expect.poll(() => ringTile(page)).toEqual(origin);
  // zoom out until the ground beyond the board is visible
  await page.mouse.wheel(0, 3000);
  const outside = { q: GRID_RADIUS + 3, r: 0 };
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.tileToScreen(c), outside),
    )
    .not.toBeNull();
  const target = await tilePosition(page, outside);
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await expect.poll(() => ringTile(page)).toBeNull();
});

test("tileToScreen returns null for a tile outside the visible area", async ({
  page,
}) => {
  await setup(page);
  const position = await page.evaluate(() =>
    window.__solarpunk?.tileToScreen({ q: 1000, r: 0 }),
  );
  expect(position).toBeNull();
});

test("resizing the viewport resizes the render size", async ({ page }) => {
  await setup(page);
  const width = () =>
    page.evaluate(() => document.querySelector("canvas")?.width ?? 0);
  const before = await width();
  await page.setViewportSize({ width: 700, height: 500 });
  await expect.poll(width).toBeLessThan(before);
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

  test("quick taps on two tiles move the ring to the second", async ({
    page,
  }) => {
    await setup(page);
    const first = await tilePosition(page, origin);
    const second = await tilePosition(page, next);
    // send both taps at once so they stay within Babylon's double tap delay
    await Promise.all([
      page.touchscreen.tap(first.x, first.y),
      page.touchscreen.tap(second.x, second.y),
    ]);
    await expect.poll(() => ringTile(page)).toEqual(next);
    expect(await buildingAt(page, origin)).toBe("Forest");
    expect(await buildingAt(page, next)).toBe("Forest");
  });

  test("quick double tap builds", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    // send both taps at once so they stay within Babylon's double tap delay
    await Promise.all([page.touchscreen.tap(x, y), page.touchscreen.tap(x, y)]);
    await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
    await expect
      .poll(() =>
        page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin),
      )
      .toBe(1);
  });
});

test("a double click builds exactly once", async ({ page }) => {
  await setup(page);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.dblclick(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  const modelCount = () =>
    page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin);
  await expect.poll(modelCount).toBe(1);
  await page.waitForTimeout(1000);
  expect(await modelCount()).toBe(1);
});

test("a click builds exactly once", async ({ page }) => {
  await setup(page);
  const first = await tilePosition(page, origin);
  await page.mouse.move(first.x, first.y, { steps: 5 });
  const modelCount = () =>
    page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin);
  expect(await modelCount()).toBe(0);
  await page.mouse.click(first.x, first.y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  await expect.poll(modelCount).toBe(1);
  await page.waitForTimeout(1000);
  expect(await modelCount()).toBe(1);

  // the selection was cleared, so a second click builds nothing
  const second = await tilePosition(page, next);
  await page.mouse.move(second.x, second.y, { steps: 5 });
  await page.mouse.click(second.x, second.y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, next)).toBe("Forest");
});
