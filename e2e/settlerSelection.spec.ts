import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  finishConstruction,
  grantWood,
  installClockWithNativeFrames,
  seedRandom,
  selectBuilding,
} from "./helpers";

const profile = (page: Page) => page.getByTestId("settler-profile");
const marker = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getSettlerMarker());
const getSettlers = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getSettlers());
const ringTile = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getRingTile());

// page position of the head or the body of a settler right now
async function settlerPosition(
  page: Page,
  id: number,
  part: "head" | "body" = "body",
) {
  const box = (await page.locator("canvas").boundingBox())!;
  const position = await page.evaluate(
    ([i, p]) => window.__solarpunk!.settlerToScreen(i as number, p as never),
    [id, part] as const,
  );
  if (!position) {
    throw new Error(`settler ${id} is not visible`);
  }
  return { x: box.x + position.x, y: box.y + position.y };
}

async function start(page: Page) {
  // with this seed settlers pause early, see settlers.spec.ts
  await seedRandom(page, 2);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await expect(page.getByTestId("status-population")).toContainText("2");
}

// the ID of a settler that stands still right now (pauses last 1 to 3 seconds)
async function waitForPause(page: Page, not?: number) {
  let id = 0;
  await expect
    .poll(
      async () => {
        const found = (await getSettlers(page)).find(
          (s) => s.pausing && s.id !== not,
        );
        id = found?.id ?? 0;
        return id;
      },
      { timeout: 120_000, intervals: [100] },
    )
    .not.toBe(0);
  return id;
}

// clicks the settler where it is until the marker is on it (it keeps walking)
async function clickUntilSelected(
  page: Page,
  id: number,
  part: "head" | "body",
  tap: (x: number, y: number) => Promise<void>,
) {
  await expect
    .poll(
      async () => {
        const { x, y } = await settlerPosition(page, id, part);
        await tap(x, y);
        return (await marker(page)).id;
      },
      { timeout: 120_000, intervals: [300] },
    )
    .toBe(id);
}

const mouseClick = async (page: Page, x: number, y: number) => {
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
};

test("a click on a settler opens the profile, marks them and follows them", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  const [first, second] = await getSettlers(page);
  const click = (x: number, y: number) => mouseClick(page, x, y);

  await clickUntilSelected(page, first.id, "head", click);
  await expect(profile(page)).toBeVisible();
  expect(await marker(page)).toEqual({ id: first.id, visible: true });
  const name = (await page.getByTestId("settler-name").textContent())!;
  const born = (await page.getByTestId("settler-born").textContent())!;
  expect(born).toMatch(/^Born \d{1,2} [A-Z][a-z]{2} \d{4}$/);
  expect(await page.getByTestId("settler-age").textContent()).toMatch(
    /^Age \d+$/,
  );
  await expect(page.getByTestId("settler-activity")).toHaveText(
    /^(Walking|Working|Idle|Gardening|Observing a butterfly)$/,
  );

  // the marker stays on the settler while the settler moves
  const before = (await getSettlers(page)).find((s) => s.id === first.id)!;
  await expect
    .poll(
      async () => {
        const now = (await getSettlers(page)).find((s) => s.id === first.id)!;
        return now.x !== before.x || now.z !== before.z;
      },
      { timeout: 60_000, intervals: [200] },
    )
    .toBe(true);

  // another settler: same card, new contents, one marker
  await clickUntilSelected(page, second.id, "body", click);
  await expect(profile(page)).toHaveCount(1);
  expect(await marker(page)).toEqual({ id: second.id, visible: true });
  await expect(page.getByTestId("settler-name")).not.toHaveText(name);

  // the close button closes card and marker; the first one is the same again
  await page.getByRole("button", { name: "Close settler profile" }).click();
  await expect(profile(page)).toHaveCount(0);
  expect(await marker(page)).toEqual({ id: undefined, visible: false });
  await clickUntilSelected(page, first.id, "body", click);
  await expect(page.getByTestId("settler-name")).toHaveText(name);
  await expect(page.getByTestId("settler-born")).toHaveText(born);

  // the activity changes with the pauses
  await expect(page.getByTestId("settler-activity")).toHaveText(
    /^(Gardening|Observing a butterfly)$/,
    { timeout: 120_000 },
  );
  await expect(page.getByTestId("settler-activity")).toHaveText("Walking", {
    timeout: 120_000,
  });

  // keyboard: the close button works with Enter, Escape closes as well
  await page.getByRole("button", { name: "Close settler profile" }).focus();
  await page.keyboard.press("Enter");
  await expect(profile(page)).toHaveCount(0);
  await clickUntilSelected(page, first.id, "body", click);
  await page.keyboard.press("Escape");
  await expect(profile(page)).toHaveCount(0);
  expect(await marker(page)).toEqual({ id: undefined, visible: false });
});

test("the profile and the marker go when the resident leaves", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  const newest = (await getSettlers(page)).at(-1)!;
  await clickUntilSelected(page, newest.id, "body", (x, y) =>
    mouseClick(page, x, y),
  );
  await expect(profile(page)).toBeVisible();
  // famine: the newest resident leaves with the next weekly tick
  await page.evaluate(() => window.__solarpunk!.addResources({ food: -10000 }));
  await expect(profile(page)).toHaveCount(0);
  expect((await marker(page)).visible).toBe(false);
});

test("an open profile shows the new age on the birthday", async ({ page }) => {
  test.setTimeout(240_000);
  await installClockWithNativeFrames(page); // the weekly ticks are run by hand
  await start(page);
  const [first] = await getSettlers(page);
  await clickUntilSelected(page, first.id, "body", (x, y) =>
    mouseClick(page, x, y),
  );
  const age = page.getByTestId("settler-age");
  await expect(age).toHaveText(/^Age \d+$/);
  const years = Number((await age.textContent())!.slice(4));
  const born = (await page.getByTestId("settler-born").textContent())!.slice(5);
  const today = (await page.getByTestId("hud-date-button").textContent())!;
  const day = 24 * 60 * 60 * 1000;
  const birth = new Date(`${born} UTC`);
  // the next birthday (29 February counts as 28 February in other years)
  const year = new Date(`${today} UTC`).getUTCFullYear();
  let birthday = Date.UTC(year, birth.getUTCMonth(), birth.getUTCDate());
  if (new Date(birthday).getUTCMonth() !== birth.getUTCMonth()) {
    birthday -= day;
  }
  const ticks = (from: string, to: number) =>
    Math.ceil((to - new Date(`${from} UTC`).getTime()) / (7 * day));
  let weeks = ticks(today, birthday);
  if (weeks <= 0) {
    // the birthday of this year has passed: the next one is in the next year
    const next = new Date(birthday);
    birthday = Date.UTC(year + 1, next.getUTCMonth(), next.getUTCDate());
    weeks = ticks(today, birthday);
  }
  expect(weeks).toBeGreaterThan(0);

  // the tick before the birthday keeps the age, the next one is older
  if (weeks > 1) {
    await page.clock.runFor((weeks - 1) * 1000);
  }
  await expect(age).toHaveText(`Age ${years}`);
  await page.clock.runFor(1000);
  await expect(age).toHaveText(`Age ${years + 1}`);
  await expect(profile(page)).toBeVisible();
});

test("dragging does not select a settler, the build mode does not either", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await start(page);
  await grantWood(page);
  // the storages are construction sites that keep the settlers busy
  await finishConstruction(page);
  const id = await waitForPause(page);
  const { x, y } = await settlerPosition(page, id, "body");

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 10, { steps: 5 });
  await page.mouse.up();
  await expect(profile(page)).toHaveCount(0);

  // a placement with a settler over the target tile builds, one click
  await selectBuilding(page, "Farms", "Organic homestead");
  await page.getByTestId("building-details").click();
  const target = await waitForPause(page);
  const spot = await settlerPosition(page, target, "body");
  await page.mouse.move(spot.x, spot.y, { steps: 5 });
  await expect.poll(() => ringTile(page)).not.toBeNull();
  const tile = (await ringTile(page))!;
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(() => buildingAt(page, tile)).toBe("OrganicHomestead");
  await expect(profile(page)).toHaveCount(0);
  expect((await marker(page)).id).toBeUndefined();
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("a tap selects a settler, in the build mode two taps place", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await start(page);
    await grantWood(page);
    // the storages are construction sites that keep the settlers busy
    await finishConstruction(page);
    const [first] = await getSettlers(page);
    await clickUntilSelected(page, first.id, "head", (x, y) =>
      page.touchscreen.tap(x, y),
    );
    await expect(profile(page)).toBeVisible();
    await page.getByRole("button", { name: "Close settler profile" }).tap();
    await expect(profile(page)).toHaveCount(0);

    // entering the build mode closes the profile
    await clickUntilSelected(page, first.id, "body", (x, y) =>
      page.touchscreen.tap(x, y),
    );
    await selectBuilding(page, "Farms", "Organic homestead");
    await expect(profile(page)).toHaveCount(0);
    await page.getByTestId("building-details").tap();

    // the first tap previews although a settler stands there, the second builds
    const target = await waitForPause(page);
    const spot = await settlerPosition(page, target, "body");
    await page.touchscreen.tap(spot.x, spot.y);
    await expect.poll(() => ringTile(page)).not.toBeNull();
    const tile = (await ringTile(page))!;
    expect(await buildingAt(page, tile)).toBe("Forest");
    expect((await marker(page)).id).toBeUndefined();
    await page.waitForTimeout(500);
    await page.touchscreen.tap(spot.x, spot.y);
    await expect.poll(() => buildingAt(page, tile)).toBe("OrganicHomestead");
  });
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 375, height: 812 },
]) {
  test(`the profile fits the ${size.width} x ${size.height} viewport and shields the map behind it`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);
    await start(page);
    const [first] = await getSettlers(page);
    await clickUntilSelected(page, first.id, "body", (x, y) =>
      mouseClick(page, x, y),
    );
    const card = profile(page);
    await expect(card).toBeVisible();
    const box = (await card.boundingBox())!;
    const menu = (await page.locator(".hud-top").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);
    expect(box.y).toBeGreaterThanOrEqual(menu.y + menu.height - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.getByTestId("status-population")).toBeVisible();
    // the exposed map is the canvas, the card is not
    const top = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => document.elementFromPoint(px, py)?.tagName,
        [x, y],
      );
    expect(await top(box.x + box.width / 2, box.y + box.height / 2)).not.toBe(
      "CANVAS",
    );
    expect(await top(size.width / 2, size.height / 2)).toBe("CANVAS");

    // a click on the card reaches neither the map nor a building
    const marked = await marker(page);
    await page.mouse.click(box.x + 4, box.y + box.height - 4);
    await expect(profile(page)).toBeVisible();
    expect(await marker(page)).toEqual(marked);
    await expect(page.getByTestId("building-info")).toHaveCount(0);
  });
}
