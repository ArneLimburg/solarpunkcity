import { test, expect } from "./fixtures";
import {
  grantWood,
  installClockWithNativeFrames,
  openDropdown,
  selectBuilding,
  tilePosition,
} from "./helpers";
import { GRID_RADIUS } from "../src/board";
import {
  BuildingCategories,
  BuildingTypes,
  getLabel,
} from "../src/gameDefinitions";

test("app loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  await page.goto("./");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  // let model preloading finish so that late errors are caught as well
  await page.waitForLoadState("networkidle");

  expect(errors).toEqual([]);
});

test("the tile layers hold exactly one finite matrix per board tile", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const stats = await page.evaluate(() =>
    window.__solarpunk!.getTileInstanceStats(),
  );
  const tileCount = 3 * GRID_RADIUS * (GRID_RADIUS + 1) + 1;
  expect(stats.instances).toBe(tileCount);
  expect(Number.isInteger(stats.instances)).toBe(true);
  expect(stats.finiteMatrices).toBe(tileCount);
});

test("one mountain mesh stands behind the board, visible and not pickable", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const stats = await page.evaluate(() =>
    window.__solarpunk!.getMountainStats(),
  );
  expect(stats.meshes).toBe(1);
  expect(stats.triangles).toBeGreaterThan(0);
  expect(stats.triangles).toBeLessThan(4000);
  expect(stats.pickable).toBe(false);
  expect(stats.inView).toBe(true);
});

test("the build panel shows a tab per category and the buildings of a tab", async ({
  page,
}) => {
  await page.goto("./");
  const build = page.getByRole("button", { name: "Build", exact: true });
  await expect(build).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("build-panel")).toHaveCount(0);
  await build.click();
  await expect(build).toHaveAttribute("aria-expanded", "true");
  const categories = Object.values(BuildingCategories).filter(
    (category) => category.buildable,
  );
  await expect(page.getByRole("tab")).toHaveText(
    categories.map((category) => category.label),
  );
  const expected = Object.entries(BuildingTypes)
    .filter(([, building]) => building.category === "FARM")
    .map(([type]) => getLabel(type as keyof typeof BuildingTypes));
  await expect(page.getByTestId("build-panel").getByRole("button")).toHaveText(
    expected.map((label) => new RegExp(`^${label}`)),
  );
  await expect(page.getByTestId("build-cost-Farm")).toContainText("25");
});

test("the HUD shows population, food and wood and no status bar remains", async ({
  page,
}) => {
  // freeze timers so that no week is calculated before the initial state is checked
  await installClockWithNativeFrames(page);
  await page.goto("./");
  await expect(page.getByTestId("hud")).toBeVisible();
  await expect(page.getByTestId("status-bar")).toHaveCount(0);
  await expect(page.getByTestId("status-population")).toContainText("2");
  const food = page.getByTestId("status-food");
  await expect(food).toHaveText(/^restaurant10 \(\+0\/wk\)$/);
  await expect(food).not.toHaveClass(/error/);
  const wood = page.getByTestId("status-wood");
  await expect(wood).toContainText("0 / 0");
  // without storage the capacity is 0
  await expect(wood).toHaveClass(/error/);
});

test("food entry is marked as error when the balance is negative", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  const food = page.getByTestId("status-food");
  // the settlers' camp feeds the 2 residents
  await expect(food).not.toHaveClass(/error/);
  // building over the camp removes the food production
  await selectBuilding(page, "Farms", "Organic homestead");
  const { x, y } = await tilePosition(page, { q: 0, r: 0 });
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.click(x, y);
  await expect(food).toContainText("(−2/wk)");
  await expect(food).toHaveClass(/error/);
});

test("the More dropdown shows ecology and satisfaction", async ({ page }) => {
  // freeze timers so that no week changes the labor factor
  await installClockWithNativeFrames(page);
  await page.goto("./");
  const more = page.getByTestId("hud-more-button");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("hud-more")).toHaveCount(0);
  const panel = await openDropdown(page, "more");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  // the camp tile has no ecology, so it is just below 100 %
  await expect(panel.getByTestId("row-Ecology")).toContainText("99 %");
  const satisfaction = panel.getByTestId("row-Satisfaction");
  await expect(satisfaction).toContainText("99 %");
  await expect(satisfaction).toContainText("ecology 99 %, work 100 %");
  await expect(panel.getByTestId("row-Construction sites")).toContainText("0");
  await expect(more).not.toHaveClass(/error/);
});

test("the More dropdown shows a stock resource once it is available", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  const panel = await openDropdown(page, "more");
  await expect(panel.getByTestId("row-ore")).toHaveCount(0);
  await page.evaluate(() => window.__solarpunk?.addResources({ ore: 5 }));
  await expect(panel.getByTestId("row-ore")).toContainText("5");
});

test("the Workers dropdown shows no report before the first week", async ({
  page,
}) => {
  await installClockWithNativeFrames(page);
  await page.goto("./");
  const button = page.getByTestId("hud-workers-button");
  await expect(button).toHaveText("Workers: 0 free");
  const panel = await openDropdown(page, "workers");
  await expect(panel).toContainText("Last week");
  await expect(panel).toContainText("No weekly report yet");
  // opening a dropdown does not advance the week
  await expect(page.getByTestId("status-food")).toContainText("10 (+0/wk)");
});

test("the Workers dropdown lists the workforce of the last week", async ({
  page,
}) => {
  await page.goto("./");
  // without storage no forest works, so all labor stays free after a week
  const button = page.getByTestId("hud-workers-button");
  await expect(button).toHaveText("Workers: 2 free");
  await expect(button).toHaveClass(/error/);
  const panel = await openDropdown(page, "workers");
  await expect(panel.getByTestId("row-Food production")).toContainText("0");
  await expect(panel.getByTestId("row-Construction")).toContainText("0");
  await expect(panel.getByTestId("row-Production")).toContainText("0");
  await expect(panel.getByTestId("row-Forestry")).toContainText("0");
  await expect(panel.getByTestId("row-Free")).toContainText("2 (100 %)");
});

test("only one dropdown is open, it closes with Escape and outside clicks", async ({
  page,
}) => {
  await installClockWithNativeFrames(page);
  await page.goto("./");
  const workers = page.getByTestId("hud-workers-button");
  const more = page.getByTestId("hud-more-button");
  await workers.focus();
  await page.keyboard.press("Enter");
  await expect(workers).toHaveAttribute("aria-expanded", "true");
  await more.focus();
  await page.keyboard.press("Space");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(workers).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.mouse.click(5, 400);
  await expect(more).toHaveAttribute("aria-expanded", "false");
  // a second click on the button closes the dropdown
  await workers.click();
  await workers.click();
  await expect(workers).toHaveAttribute("aria-expanded", "false");
});

test("the date dropdown shows the date, the week and the session time", async ({
  page,
}) => {
  await installClockWithNativeFrames(page);
  await page.clock.pauseAt(Date.now() + 1000); // nothing runs by itself
  await page.goto("./");
  const button = page.getByTestId("hud-date-button");
  await expect(button).toHaveText("1 Jan 2030");
  const panel = await openDropdown(page, "date");
  await expect(panel).toContainText("Tuesday, 1 January 2030");
  await expect(panel).toContainText("Week 0 since founding");
  await expect(panel).toContainText("0:00:00");
  // the wall clock advances without completing a tick (no timer fires)
  const start = await page.evaluate(() => Date.now());
  await page.clock.setSystemTime(start + 247_000);
  // closing and reopening reads the clock anew
  await button.click();
  await button.click();
  await expect(panel).toContainText("0:04:07");
  await expect(panel).toContainText("Week 0 since founding");
  await expect(button).toHaveText("1 Jan 2030");
  await button.click();
  await page.clock.setSystemTime(start + 307_000);
  await button.click();
  await expect(panel).toContainText("0:05:07");
  // the open dropdown refreshes every second; the first tick completes a week
  await page.clock.setSystemTime(start + 308_000);
  await page.clock.runFor(1000);
  await expect(panel).toContainText("0:05:09");
  await expect(button).toHaveText("8 Jan 2030");
  await expect(panel).toContainText("Tuesday, 8 January 2030");
  await expect(panel).toContainText("Week 1 since founding");
});

test("the date dropdown toggles with the keyboard, Escape and outside clicks", async ({
  page,
}) => {
  await installClockWithNativeFrames(page);
  await page.goto("./");
  const date = page.getByTestId("hud-date-button");
  const workers = page.getByTestId("hud-workers-button");
  await date.focus();
  await page.keyboard.press("Enter");
  await expect(date).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(date).toHaveAttribute("aria-expanded", "false");
  await date.click();
  await workers.click();
  await expect(date).toHaveAttribute("aria-expanded", "false");
  await expect(workers).toHaveAttribute("aria-expanded", "true");
  await date.click();
  await expect(workers).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(date).toHaveAttribute("aria-expanded", "false");
  await date.click();
  await page.mouse.click(5, 400);
  await expect(date).toHaveAttribute("aria-expanded", "false");
});

test("clicking in the HUD, a dropdown or a panel builds nothing", async ({
  page,
}) => {
  test.slow();
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await selectBuilding(page, "Farms", "Organic homestead");
  // the HUD, the dropdown and the panel cover buildable tiles of the map
  for (const id of ["hud", "hud-more", "build-panel"]) {
    await openDropdown(page, "more");
    const box = (await page.getByTestId(id).boundingBox())!;
    // inset beyond the rounded corner, which does not take pointer events
    await page.mouse.click(box.x + box.width - 8, box.y + box.height - 8);
  }
  // a placement would have cleared the selection
  await expect(page.getByTestId("building-details")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__solarpunk?.getBuildingType({ q: 0, r: 0 }),
    ),
  ).toBe("SettlersCamp");
});

test("the HUD and the panels have a translucent background and fit the viewport", async ({
  page,
}) => {
  test.setTimeout(180_000); // loads the page twice with software rendering
  // freeze timers: every tick changes the width of the centered HUD and moves its buttons, so a
  // click on a slow runner never finds them stable
  await installClockWithNativeFrames(page);
  for (const size of [
    { width: 1280, height: 800 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(size);
    await page.goto("./");
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await page.getByTestId("hud-more-button").click();
    for (const id of ["hud", "build-panel", "hud-more"]) {
      const element = page.getByTestId(id);
      await expect(element).toBeVisible();
      const box = (await element.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    await page.getByTestId("hud-date-button").click();
    for (const id of ["hud", "hud-date"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    }
    await page.getByTestId("hud-more-button").click();
    for (const id of ["hud", "build-panel", "hud-more"]) {
      const element = page.getByTestId(id);
      await expect(element).toBeVisible();
      const box = (await element.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await expect(element).toHaveCSS(
        "background-color",
        "rgba(186, 222, 255, 0.75)",
      );
    }
  }
});
