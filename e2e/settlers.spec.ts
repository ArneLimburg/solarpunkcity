import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  buildingAt,
  grantWood,
  seedRandom,
  selectBuilding,
  tilePosition,
} from "./helpers";

const getSettlers = (page: Page) =>
  page.evaluate(() => window.__solarpunk!.getSettlers());

const hexDistance = (
  a: { q: number; r: number },
  b: { q: number; r: number },
) =>
  Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - b.q - b.r),
  );

async function start(page: Page) {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await expect(page.getByTestId("status-population")).toContainText("2");
}

test("a fresh game shows two settlers near the camp that walk, turn and pause", async ({
  page,
}) => {
  // slow CI renders few frames and the settlers' time per frame is capped
  test.setTimeout(180_000);
  // Pauses are random (a chance per reached tile) and the walk only advances
  // with the frames, which are slow on CI runners. With this seed a settler
  // pauses within its first tile, so the test does not depend on luck.
  await seedRandom(page, 2);
  await start(page);
  const first = await getSettlers(page);
  expect(first).toHaveLength(2);
  for (const settler of first) {
    expect(hexDistance(settler.tile, { q: 0, r: 0 })).toBeLessThanOrEqual(3);
  }
  expect(first[0].phase).not.toBe(first[1].phase);
  expect(`${first[0].x},${first[0].z}`).not.toBe(`${first[1].x},${first[1].z}`);

  // they walk (positions change), turn (headings change) and pause now and then
  const seen = { moved: false, turned: false, paused: false };
  await expect
    .poll(
      async () => {
        const now = await getSettlers(page);
        now.forEach((settler, i) => {
          seen.moved ||= settler.x !== first[i].x || settler.z !== first[i].z;
          seen.turned ||= settler.heading !== first[i].heading;
          seen.paused ||= settler.pausing;
        });
        return seen.moved && seen.turned && seen.paused;
      },
      { timeout: 140_000, intervals: [250] },
    )
    .toBe(true);
});

test("a figure is cheap: few triangles and two draw calls at most", async ({
  page,
}) => {
  await start(page);
  const stats = await page.evaluate(() =>
    window.__solarpunk!.getSettlerStats(),
  );
  expect(stats.count).toBe(2);
  expect(stats.trianglesPerFigure).toBeGreaterThan(0);
  expect(stats.trianglesPerFigure).toBeLessThanOrEqual(200);
  expect(stats.meshes).toBe(2);
});

test("generated settlers cost at most two draw calls and the roster comes back", async ({
  page,
}) => {
  await start(page);
  const frames = (count: number) =>
    page.evaluate(
      (n) =>
        new Promise<void>((resolve) => {
          let left = n;
          const tick = () =>
            --left <= 0 ? resolve() : requestAnimationFrame(tick);
          requestAnimationFrame(tick);
        }),
      count,
    );
  const stats = () =>
    page.evaluate(() => window.__solarpunk!.getSettlerStats());

  await frames(2);
  const roster = await stats();
  expect(roster.count).toBe(2);

  await page.evaluate(() => window.__solarpunk!.showSettlers(0));
  await frames(2);
  const baseline = await stats();
  expect(baseline.count).toBe(0);

  await page.evaluate(() => window.__solarpunk!.showSettlers(10));
  await frames(2);
  // at least one game tick passes: it must not replace the generated settlers
  await page.waitForTimeout(1500);
  const crowd = await stats();
  expect(crowd.count).toBe(10);
  expect(crowd.drawCalls - baseline.drawCalls).toBeLessThanOrEqual(2);

  // a weekly tick (1 s) hands the roster over again but must not replace the crowd
  await page.waitForTimeout(2500);
  expect((await stats()).count).toBe(10);

  await page.evaluate(() => window.__solarpunk!.showSettlers(undefined));
  await frames(2);
  expect((await stats()).count).toBe(2);
});

test("figures do not take part in picking: hovering and building work beneath them", async ({
  page,
}) => {
  await start(page);
  await grantWood(page);
  const [settler] = await getSettlers(page);
  const { x, y } = await tilePosition(page, settler.tile);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTile()))
    .toEqual(settler.tile);

  // build on the tile of the settler: it is no longer walkable, nobody stays
  await selectBuilding(page, "Farms", "Organic homestead");
  // the details panel could cover the tile; clicking it hides it
  await page.getByTestId("building-details").click();
  await expect(page.getByTestId("building-details")).toHaveCount(0);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(() => page.evaluate(() => window.__solarpunk?.getRingTile()))
    .toEqual(settler.tile);
  await page.mouse.click(x, y);
  await expect
    .poll(() => buildingAt(page, settler.tile))
    .toBe("OrganicHomestead");
  await expect
    .poll(
      async () =>
        (await getSettlers(page)).some(
          ({ tile }) => tile.q === settler.tile.q && tile.r === settler.tile.r,
        ),
      // the settler walks off from where it stands, which takes a while on slow runners
      { timeout: 20_000 },
    )
    .toBe(false);
  expect(await getSettlers(page)).toHaveLength(2);
});
