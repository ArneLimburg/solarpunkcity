import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { seedRandom } from "./helpers";

const profile = (page: Page) => page.getByTestId("settler-profile");
const preview = (page: Page) => page.getByTestId("settler-preview");
const stats = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getPreviewStats());
const marker = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getSettlerMarker());
const getSettlers = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getSettlers());
const frameStats = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getFrameStats());

async function start(page: Page) {
  await seedRandom(page, 2);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await expect(page.getByTestId("status-population")).toContainText("2");
}

// clicks the settler where it is until the profile shows them
async function select(page: Page, id: number) {
  await expect
    .poll(
      async () => {
        const box = (await page.locator("main canvas").boundingBox())!;
        const position = await page.evaluate(
          (i) => window.__solarpunk!.settlerToScreen(i, "head"),
          id,
        );
        if (position) {
          await page.mouse.click(box.x + position.x, box.y + position.y);
        }
        return (await marker(page)).id;
      },
      { timeout: 120_000, intervals: [300] },
    )
    .toBe(id);
}

// the number of frames the engine rendered since the call
async function frames(page: Page, count: number) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }, count);
}

async function expectInsideCard(page: Page) {
  const card = (await profile(page).boundingBox())!;
  const canvas = (await preview(page).boundingBox())!;
  expect(canvas.x).toBeGreaterThanOrEqual(card.x - 0.5);
  expect(canvas.x + canvas.width).toBeLessThanOrEqual(
    card.x + card.width + 0.5,
  );
  expect(canvas.y).toBeGreaterThanOrEqual(card.y - 0.5);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(
    card.y + card.height + 0.5,
  );
  expect(canvas.width / canvas.height).toBeCloseTo(4 / 3, 1);
}

test("the preview follows the selected settler without touching the map camera", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await start(page);
  const [first, second] = await getSettlers(page);
  const closed = await stats(page);
  expect(closed).toMatchObject({ views: 0, cameras: 0 });
  await frames(page, 3);
  const before = await frameStats(page);
  expect(before.passes).toBe(1);

  await select(page, first.id);
  await expect(preview(page)).toBeVisible();
  await expectInsideCard(page);
  await expect.poll(async () => (await stats(page)).views).toBe(1);
  let open = await stats(page);
  expect(open.cameras).toBe(1);
  expect(open.mainCamera).toEqual(closed.mainCamera);
  // the marker is drawn by the map, not by the preview, the route by both
  expect(open).toMatchObject({
    markerOnMain: true,
    markerOnPreview: false,
    routeOnMain: true,
    routeOnPreview: true,
  });

  // the camera looks at the settler
  await expect
    .poll(
      async () => {
        const target = (await stats(page)).target;
        const settler = (await getSettlers(page)).find(
          (s) => s.id === first.id,
        )!;
        return (
          target !== undefined &&
          Math.hypot(target.x - settler.x, target.z - settler.z)
        );
      },
      { timeout: 60_000 },
    )
    .toBeLessThan(1.5);
  // a preview frame costs at most as many draw calls as the map
  await expect
    .poll(async () => (await frameStats(page)).passes, { timeout: 60_000 })
    .toBe(2);
  const total = await frameStats(page);
  const mapCalls = await page.evaluate(
    () => window.__solarpunk!.getSettlerStats().drawCalls,
  );
  expect(total.drawCalls).toBeLessThanOrEqual(2 * mapCalls);

  // a click on the preview selects nobody and places nothing
  const ring = await page.evaluate(() => window.__solarpunk!.getRingTile());
  await preview(page).click();
  expect((await marker(page)).id).toBe(first.id);
  expect(await page.evaluate(() => window.__solarpunk!.getRingTile())).toEqual(
    ring,
  );

  // another settler: one view, one camera, the camera moves to them
  await select(page, second.id);
  await expect(profile(page)).toHaveCount(1);
  await expect.poll(async () => (await stats(page)).views).toBe(1);
  open = await stats(page);
  expect(open.cameras).toBe(1);
  expect(open.mainCamera).toEqual(closed.mainCamera);

  // closing leaves nothing behind: one pass again, the same draw calls
  await page.getByRole("button", { name: "Close settler profile" }).click();
  await expect(profile(page)).toHaveCount(0);
  await expect.poll(async () => (await stats(page)).views).toBe(0);
  const after = await stats(page);
  expect(after.cameras).toBe(0);
  expect(after.observers).toBe(closed.observers);
  expect(after.mainCamera).toEqual(closed.mainCamera);
  await frames(page, 3);
  expect(await frameStats(page)).toEqual(before);

  // opening, switching and closing again and again accumulates nothing
  for (let i = 0; i < 3; i++) {
    await select(page, first.id);
    await select(page, second.id);
    await page.keyboard.press("Escape");
    await expect(profile(page)).toHaveCount(0);
  }
  const end = await stats(page);
  expect(end).toMatchObject({ views: 0, cameras: 0 });
  expect(end.observers).toBe(closed.observers);
  expect(end.mainCamera).toEqual(closed.mainCamera);
});

test("the preview keeps its shape at 375 × 812 and after a resize", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page);
  const [first] = await getSettlers(page);
  await select(page, first.id);
  await expect(preview(page)).toBeVisible();
  await expectInsideCard(page);
  await page.setViewportSize({ width: 320, height: 600 });
  await expectInsideCard(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expectInsideCard(page);
  const canvas = (await preview(page).boundingBox())!;
  expect(canvas.width).toBeLessThan(400);
  // the map still fills the viewport and works
  expect(await page.locator("main canvas").boundingBox()).toMatchObject({
    width: 1280,
  });
});

test("the profile works without the preview when it cannot be set up", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  const [first] = await getSettlers(page);
  await page.evaluate(() => window.__solarpunk!.failPreviews(true));
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await select(page, first.id);
  await expect(profile(page)).toBeVisible();
  await expect(preview(page)).toBeHidden();
  await expect(page.getByTestId("settler-name")).toBeVisible();
  expect((await stats(page)).views).toBe(0);
  expect((await stats(page)).cameras).toBe(0);
  expect(errors.join("\n")).toContain("preview failed on purpose");
  // the map keeps rendering
  await frames(page, 3);
  expect((await frameStats(page)).passes).toBe(1);
});
