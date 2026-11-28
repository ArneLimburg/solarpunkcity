import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  installClockWithNativeFrames,
  isUnderConstruction,
  openDropdown,
  selectBuilding,
  tilePosition,
} from "./helpers";
import { GRID_RADIUS, getRiverCourse, isOnBoard } from "../src/board";
import {
  BuildingCategories,
  getLabel,
  type BuildingType,
} from "../src/gameDefinitions";

const origin = { q: 0, r: 0 };
const east = { q: 3, r: 0 };
const next = { q: 1, r: 0 };

async function setup(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Farms", "Organic homestead");
}

const ringTile = (page: Page) =>
  page.evaluate(() => window.__solarpunk?.getRingTile());

test.describe("mouse", () => {
  test("hovering moves the ring without building", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await expect.poll(() => ringTile(page)).toEqual(origin);
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
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
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    // wait longer than Babylon's double tap detection
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
    expect(await buildingAt(page, east)).toBe("Forest");
  });

  test("right click does not build", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.click(x, y, { button: "right" });
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
  });

  test("ring is hidden when the pointer leaves the canvas", async ({
    page,
  }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await expect.poll(() => ringTile(page)).toEqual(origin);
    const box = await page.locator("main canvas").boundingBox();
    // the top right corner hits no mesh (not even the skybox), unlike the top centre
    await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) - 1, box?.y ?? 0);
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
  // zoom out so the ground beyond the board comes into view
  await page.mouse.wheel(0, 3000);
  // The zoom is inertial and slow with software rendering, and which side of the board becomes
  // visible first depends on the viewport, so take the off-board tile closest to the centre of
  // the canvas in any of the six directions instead of waiting for one fixed tile.
  const distance = GRID_RADIUS + 3;
  const candidates = [
    { q: distance, r: 0 },
    { q: -distance, r: 0 },
    { q: 0, r: distance },
    { q: 0, r: -distance },
    { q: distance, r: -distance },
    { q: -distance, r: distance },
  ];
  let target: { x: number; y: number } | undefined;
  await expect
    .poll(async () => {
      const box = await page.locator("main canvas").boundingBox();
      const positions = await page.evaluate(
        (tiles) => tiles.map((c) => window.__solarpunk?.tileToScreen(c)),
        candidates,
      );
      const centre = { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
      const visible = positions
        .filter((p) => p != null)
        .sort(
          (a, b) =>
            Math.hypot(a.x - centre.x, a.y - centre.y) -
            Math.hypot(b.x - centre.x, b.y - centre.y),
        );
      target = visible[0] && {
        x: (box?.x ?? 0) + visible[0].x,
        y: (box?.y ?? 0) + visible[0].y,
      };
      return target;
    })
    .toBeDefined();
  if (!target) throw new Error("no tile outside the board is visible");
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
    page.evaluate(
      () =>
        document.querySelector<HTMLCanvasElement>("main canvas")?.width ?? 0,
    );
  const before = await width();
  await page.setViewportSize({ width: 700, height: 500 });
  await expect.poll(width, { timeout: 20_000 }).toBeLessThan(before);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("first tap moves the ring without building", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    await page.touchscreen.tap(x, y);
    await expect.poll(() => ringTile(page)).toEqual(origin);
    await page.waitForTimeout(500);
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
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
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
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
    expect(await buildingAt(page, origin)).toBe("SettlersCamp");
    expect(await buildingAt(page, next)).toBe("Forest");
  });

  test("touch places repeatedly with two taps per copy", async ({ page }) => {
    await setup(page);
    for (const coords of row.slice(0, 2)) {
      const { x, y } = await tilePosition(page, coords);
      await page.touchscreen.tap(x, y);
      await expect.poll(() => ringTile(page)).toEqual(coords);
      // two quick taps would count as a double tap in Babylon
      await page.waitForTimeout(500);
      await page.touchscreen.tap(x, y);
      await expect
        .poll(() => buildingAt(page, coords))
        .toBe("OrganicHomestead");
      await page.waitForTimeout(500);
    }
  });

  test("quick double tap builds", async ({ page }) => {
    await setup(page);
    const { x, y } = await tilePosition(page, origin);
    // send both taps at once so they stay within Babylon's double tap delay
    await Promise.all([page.touchscreen.tap(x, y), page.touchscreen.tap(x, y)]);
    await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
    await finishConstruction(page);
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
  await finishConstruction(page);
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
  // the settlers' camp stands on the origin at the start
  expect(await modelCount()).toBe(1);
  await page.mouse.click(first.x, first.y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  // a construction site has bare soil and no model
  expect(await isUnderConstruction(page, origin)).toBe(true);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("soil");
  expect(await modelCount()).toBe(0);
  await finishConstruction(page);
  expect(await isUnderConstruction(page, origin)).toBe(false);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("farmland");
  await expect.poll(modelCount).toBe(1);
  await page.waitForTimeout(1000);
  expect(await modelCount()).toBe(1);

  // after Escape a second click builds nothing
  await page.keyboard.press("Escape");
  const second = await tilePosition(page, next);
  await page.mouse.move(second.x, second.y, { steps: 5 });
  await page.mouse.click(second.x, second.y);
  await page.waitForTimeout(500);
  expect(await buildingAt(page, next)).toBe("Forest");
});

// forest tiles right of the camp: off the river and not behind the details panel
const row = [0, -1, -2, -3].map((q) => ({ q, r: -2 }));

// the construction sites row of the More dropdown (opened if needed)
const constructionSites = async (page: Page) =>
  (await openDropdown(page, "more")).getByTestId("row-Construction sites");

async function clickTile(page: Page, coords: { q: number; r: number }) {
  const { x, y } = await tilePosition(page, coords);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
}

test("four copies are placed in a row with one selection", async ({ page }) => {
  // many software-rendered mouse moves, slow on the CI runners
  test.slow();
  // no week passes, so no construction site is finished in between
  await installClockWithNativeFrames(page);
  await setup(page);
  for (const coords of row) {
    await clickTile(page, coords);
    await expect.poll(() => buildingAt(page, coords)).toBe("OrganicHomestead");
  }
  await expect(await constructionSites(page)).toHaveText(/sites4$/);
  // the type is still selected
  await expect(page.getByTestId("building-details")).toBeVisible();
});

test("a click on an invalid tile keeps the selection and builds nothing", async ({
  page,
}) => {
  // many software-rendered mouse moves, slow on the CI runners
  test.slow();
  await installClockWithNativeFrames(page);
  await setup(page);
  await clickTile(page, row[0]);
  await expect.poll(() => buildingAt(page, row[0])).toBe("OrganicHomestead");
  // the same tile is occupied now
  await clickTile(page, row[0]);
  await expect.poll(() => ringBlocked(page)).toBe(true);
  await expect(await constructionSites(page)).toHaveText(/sites1$/);
  // close the dropdown, it covers the middle of the map
  await page.getByTestId("hud-more-button").click();
  // the selection is still active
  await clickTile(page, row[1]);
  await expect.poll(() => buildingAt(page, row[1])).toBe("OrganicHomestead");
});

test("Escape and the building icon exit blueprint mode", async ({ page }) => {
  // many software-rendered mouse moves, slow on the CI runners
  test.slow();
  await setup(page);
  await clickTile(page, row[0]);
  await expect.poll(() => buildingAt(page, row[0])).toBe("OrganicHomestead");
  await page.keyboard.press("Escape");
  await clickTile(page, row[1]);
  await page.waitForTimeout(300);
  expect(await buildingAt(page, row[1])).toBe("Forest");

  await selectBuilding(page, "Farms", "Organic homestead");
  await clickTile(page, row[1]);
  await expect.poll(() => buildingAt(page, row[1])).toBe("OrganicHomestead");
  // a click on the selected building deselects it
  await page
    .getByRole("button", { name: "Organic homestead", exact: true })
    .click();
  await clickTile(page, row[2]);
  await page.waitForTimeout(300);
  expect(await buildingAt(page, row[2])).toBe("Forest");

  // placed sites keep receiving work after exiting
  await expect
    .poll(() => isUnderConstruction(page, row[0]), { timeout: 15000 })
    .toBe(false);
});

test("the More dropdown counts the construction sites", async ({ page }) => {
  // no weekly tick runs by itself, so a slow runner cannot finish the site
  // before the dropdown is read
  await installClockWithNativeFrames(page);
  await page.clock.pauseAt(Date.now() + 1000);
  await setup(page);
  // a click on the map closes the dropdown, so it is opened again each time
  const sites = async () =>
    (await openDropdown(page, "more")).getByTestId("row-Construction sites");
  await expect(await sites()).toHaveText(/sites0$/);
  // the open dropdown covers the middle of the map
  await page.getByTestId("hud-more-button").click();
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => isUnderConstruction(page, origin)).toBe(true);
  await expect(await sites()).toHaveText(/sites1$/);
  await finishConstruction(page);
  // the next weekly tick updates the dropdown
  await page.clock.runFor(1000);
  await expect(await sites()).toHaveText(/sites0$/);
});

test("a finished building replaces its construction site after its weeks of work", async ({
  page,
}) => {
  await setup(page);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  // 32 worker-weeks with 2 workers take 16 weeks: skip them, the next
  // weekly tick completes the building
  await expect.poll(() => isUnderConstruction(page, origin)).toBe(true);
  await finishConstruction(page);
  await expect
    .poll(() => isUnderConstruction(page, origin), { timeout: 15000 })
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin),
    )
    .toBe(1);
});

test("every board tile except the camp and the river starts as forest floor", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const river = getRiverCourse(GRID_RADIUS);
  const isRiver = (q: number, r: number) =>
    river.some((tile) => tile.q === q && tile.r === r);
  const tiles = [];
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (isOnBoard({ q, r }) && (q !== 0 || r !== 0) && !isRiver(q, r)) {
        tiles.push({ q, r });
      }
    }
  }
  const materials = await page.evaluate(
    (list) => list.map((c) => window.__solarpunk?.getTileMaterial(c)),
    tiles,
  );
  expect(materials).toHaveLength(tiles.length);
  expect(materials.every((m) => m === "forestFloor")).toBe(true);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("meadow");
});

test("the river is water without trees and cannot be built on", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const river = getRiverCourse(GRID_RADIUS);
  const materials = await page.evaluate(
    (list) => list.map((c) => window.__solarpunk?.getTileMaterial(c)),
    river,
  );
  expect(materials).toHaveLength(2 * GRID_RADIUS + 1);
  expect(materials.every((m) => m === "water")).toBe(true);
  const trees = await page.evaluate(
    (list) => list.map((c) => window.__solarpunk?.getTreeCount(c)),
    river,
  );
  expect(trees.every((count) => count === 0)).toBe(true);

  // the ring is red on the river even with enough wood; the details panel is
  // dismissed (the selection stays) because it covers the river tile
  await grantWood(page);
  await selectBuilding(page, "Farms", "Farm");
  await page.getByRole("button", { name: "Hide building details" }).click();
  // the collapsed list no longer covers the map either
  await page.getByRole("button", { name: /^Build/ }).click();
  const tile = river.find(({ r }) => r === 0)!;
  const { x, y } = await tilePosition(page, tile);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTile()))
    .toEqual(tile);
  expect(await page.evaluate(() => window.__solarpunk?.isRingBlocked())).toBe(
    true,
  );
});

test("the camp is shown as one model and disappears when built over", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const modelCount = () =>
    page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin);
  const triangles = () =>
    page.evaluate((c) => window.__solarpunk?.getModelTriangleCount(c), origin);
  expect(await buildingAt(page, origin)).toBe("SettlersCamp");
  expect(await modelCount()).toBe(1);
  expect(await triangles()).toBeGreaterThan(0);
  expect(await triangles()).toBeLessThan(1000);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTreeCount(c), origin),
  ).toBe(0);

  // the page is already loaded, so it is not loaded a second time
  await grantWood(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  expect(await modelCount()).toBe(0);
});

test("a residential building turns the tile into meadow", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("meadow"); // the camp
  await selectBuilding(page, "Residential", "Apartment building");
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("AppartmentBuilding");
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("soil");
  await finishConstruction(page);
  expect(
    await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), origin),
  ).toBe("meadow");
});

test("a farm occupies 7 tiles with one model and farmland", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Farms", "Farm");

  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTiles().length))
    .toBe(7);
  await page.mouse.click(x, y);

  const footprint = [
    origin,
    { q: 1, r: 0 },
    { q: -1, r: 0 },
    { q: 0, r: 1 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: -1, r: 1 },
  ];
  const modelCount = (c: { q: number; r: number }) =>
    page.evaluate((t) => window.__solarpunk?.getModelCount(t), c);
  for (const tile of footprint) {
    await expect.poll(() => buildingAt(page, tile)).toBe("Farm");
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("soil");
  }
  await finishConstruction(page);
  for (const tile of footprint) {
    expect(
      await page.evaluate((c) => window.__solarpunk?.getTileMaterial(c), tile),
    ).toBe("farmland");
  }
  await expect.poll(() => modelCount(origin)).toBe(1);
  for (const tile of footprint.slice(1)) {
    expect(await modelCount(tile)).toBe(0);
  }
});

test("building replaces the trees of a tile with one model", async ({
  page,
}) => {
  await setup(page);
  const treeCount = (c: { q: number; r: number }) =>
    page.evaluate((t) => window.__solarpunk?.getTreeCount(t), c);
  const modelCount = (c: { q: number; r: number }) =>
    page.evaluate((t) => window.__solarpunk?.getModelCount(t), c);
  expect(await treeCount(origin)).toBe(0); // the camp has no trees
  expect(await treeCount(next)).toBe(5);

  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect.poll(() => buildingAt(page, origin)).toBe("OrganicHomestead");
  expect(await treeCount(origin)).toBe(0);
  await finishConstruction(page);
  await expect.poll(() => modelCount(origin)).toBe(1);
  expect(await treeCount(next)).toBe(5);
});

const FARM_BUDGETS = [
  { type: "OrganicHomestead", budget: 1000 },
  { type: "Farm", budget: 3000 },
  { type: "AgroIndustrial", budget: 8000 },
];

for (const { type, budget } of FARM_BUDGETS) {
  test(`a ${type} is one low-poly model within its triangle budget`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.waitForFunction(() => window.__solarpunk !== undefined);
    await grantWood(page);
    await selectBuilding(page, "Farms", getLabel(type as BuildingType)!);
    const { x, y } = await tilePosition(page, origin);
    await page.mouse.move(x, y, { steps: 5 });
    await page.mouse.click(x, y);
    await expect
      .poll(() => buildingAt(page, origin), { timeout: 30_000 })
      .toBe(type);
    await finishConstruction(page);

    const modelCount = () =>
      page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin);
    const triangles = (tile: { q: number; r: number }) =>
      page.evaluate((c) => window.__solarpunk?.getModelTriangleCount(c), tile);
    await expect.poll(modelCount).toBe(1);
    expect(await triangles(origin)).toBeGreaterThan(0);
    expect(await triangles(origin)).toBeLessThanOrEqual(budget);
    expect(await triangles({ q: 5, r: 5 })).toBe(0);
  });
}

async function buildAtOrigin(
  page: Page,
  category: "FARM" | "RESIDENTIAL",
  type: BuildingType,
) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  const { label } = BuildingCategories[category];
  await selectBuilding(page, label, getLabel(type)!);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  // under CI load the first click can be swallowed, so click again until built
  await expect
    .poll(
      async () => {
        if ((await buildingAt(page, origin)) !== type) {
          await page.mouse.click(x, y);
        }
        return buildingAt(page, origin);
      },
      { timeout: 30_000 },
    )
    .toBe(type);
  await finishConstruction(page);
}

test("an apartment building is one low-poly model within budget", async ({
  page,
}) => {
  await buildAtOrigin(page, "RESIDENTIAL", "AppartmentBuilding");
  const modelCount = () =>
    page.evaluate((c) => window.__solarpunk?.getModelCount(c), origin);
  await expect.poll(modelCount).toBe(1);
  const triangles = await page.evaluate(
    (c) => window.__solarpunk?.getModelTriangleCount(c),
    origin,
  );
  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThanOrEqual(1000);
});

const BUILDABLE: {
  category: "FARM" | "RESIDENTIAL";
  type: BuildingType;
  size: number;
}[] = [
  { category: "FARM", type: "OrganicHomestead", size: 1 },
  { category: "FARM", type: "Farm", size: 7 },
  { category: "FARM", type: "AgroIndustrial", size: 19 },
  { category: "RESIDENTIAL", type: "AppartmentBuilding", size: 1 },
  { category: "RESIDENTIAL", type: "WoodenHouse", size: 1 },
];

for (const { category, type, size } of BUILDABLE) {
  test(`${type} stays within 1,000 triangles per tile`, async ({ page }) => {
    await buildAtOrigin(page, category, type);
    await expect
      .poll(() =>
        page.evaluate(
          (c) => window.__solarpunk?.getModelTriangleCount(c),
          origin,
        ),
      )
      .toBeGreaterThan(0);
    const triangles = await page.evaluate(
      (c) => window.__solarpunk?.getModelTriangleCount(c),
      origin,
    );
    expect(triangles).toBeLessThanOrEqual(1000 * size);
  });
}

const ringBlocked = (page: Page) =>
  page.evaluate(() => window.__solarpunk?.isRingBlocked());

async function selectFarm(page: Page) {
  await selectBuilding(page, "Farms", "Farm");
}

test("the farm ring is not blocked on free forest", async ({ page }) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await selectFarm(page);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  await expect.poll(() => ringTile(page)).toEqual(origin);
  expect(await ringBlocked(page)).toBe(false);
});

test("the ring turns red when the footprint leaves the board", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await selectFarm(page);
  const corners = [
    { q: GRID_RADIUS, r: 0 },
    { q: -GRID_RADIUS, r: 0 },
    { q: 0, r: GRID_RADIUS },
    { q: 0, r: -GRID_RADIUS },
    { q: GRID_RADIUS, r: -GRID_RADIUS },
    { q: -GRID_RADIUS, r: GRID_RADIUS },
  ];
  // zoom out until a board corner is visible, then hover it
  const box = await page.locator("main canvas").boundingBox();
  await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 10);
  await page.mouse.wheel(0, 3000);
  await expect
    .poll(async () => {
      const positions = await page.evaluate(
        (tiles) => tiles.map((c) => window.__solarpunk?.tileToScreen(c)),
        corners,
      );
      const position = positions.find((p) => p != null);
      if (!position) return undefined;
      await page.mouse.move(
        (box?.x ?? 0) + position.x,
        (box?.y ?? 0) + position.y,
      );
      return (await ringTile(page)) ? await ringBlocked(page) : undefined;
    })
    .toBe(true);
});

test("the ring is red over a building, and never without selection", async ({
  page,
}) => {
  test.slow();
  await setup(page);
  const { x, y } = await tilePosition(page, origin);
  await page.mouse.move(x, y, { steps: 5 });
  // click only once the slow software-rendered scene has picked the tile under the pointer
  await expect.poll(() => ringTile(page)).toEqual(origin);
  await expect.poll(() => ringBlocked(page)).toBe(false);
  await page.mouse.click(x, y);
  await expect
    .poll(() => buildingAt(page, origin), { timeout: 15000 })
    .toBe("OrganicHomestead");

  // the building stays selected, so its own site blocks the ring
  // (move again on every poll: the software-rendered scene can be slow to pick)
  let offset = 0;
  await expect
    .poll(
      async () => {
        offset = (offset + 1) % 3;
        await page.mouse.move(x, y + offset);
        return ringBlocked(page);
      },
      { timeout: 15000 },
    )
    .toBe(true);

  // without selection the ring is never red
  await page.keyboard.press("Escape");
  await page.mouse.move(x, y);
  await expect.poll(() => ringBlocked(page)).toBe(false);

  await selectFarm(page);
  const neighbour = await tilePosition(page, next);
  await page.mouse.move(neighbour.x, neighbour.y, { steps: 5 });
  await expect.poll(() => ringTile(page)).toEqual(next);
  expect(await ringBlocked(page)).toBe(true);
});

test("the corner fills around a new farm follow the grounds of the tiles", async ({
  page,
}) => {
  test.slow();
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  const fill = (tile: { q: number; r: number }, corner: number) =>
    page.evaluate(([c, i]) => window.__solarpunk?.getCornerMaterial(c, i), [
      tile,
      corner,
    ] as const);
  const farmEdge = { q: 1, r: 0 };
  const houseTile = { q: 2, r: 0 };

  // the outermost corner of the board has a single tile and no fill
  expect(await fill({ q: GRID_RADIUS, r: 0 }, 0)).toBeUndefined();
  expect(await fill({ q: -5, r: 0 }, 0)).toBe("forestFloor");

  await selectFarm(page);
  const farm = await tilePosition(page, origin);
  await page.mouse.move(farm.x, farm.y, { steps: 5 });
  await page.mouse.click(farm.x, farm.y);
  await expect.poll(() => buildingAt(page, origin)).toBe("Farm");
  await finishConstruction(page);
  // farmland, forest, forest: the forest wins; farmland, forest, farmland: the farmland wins
  expect(await fill(farmEdge, 0)).toBe("forestFloor");
  expect(await fill(farmEdge, 1)).toBe("farmland");

  // farmland, meadow, forest: three different grounds
  await selectBuilding(page, "Residential", "Apartment building");
  const house = await tilePosition(page, houseTile);
  await page.mouse.move(house.x, house.y, { steps: 5 });
  await page.mouse.click(house.x, house.y);
  await expect
    .poll(() => buildingAt(page, houseTile))
    .toBe("AppartmentBuilding");
  await finishConstruction(page);
  expect(await fill(farmEdge, 0)).toBe("cornerMixed");
  expect(await fill(farmEdge, 1)).toBe("farmland");
});
