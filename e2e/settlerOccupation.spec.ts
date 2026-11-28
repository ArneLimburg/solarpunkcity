import { test, expect } from "./fixtures";
import {
  grantWood,
  installClockWithNativeFrames,
  selectBuilding,
  tilePosition,
} from "./helpers";

const site = { q: -2, r: -2 }; // forest tile near the camp

test("a builder's profile shows the occupation and the way to the construction site", async ({
  page,
}) => {
  test.setTimeout(420_000);
  // no week is calculated until the test runs one by hand: the site stays open
  await installClockWithNativeFrames(page);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  await grantWood(page);
  await page.evaluate(() => window.__solarpunk?.addResources({ wood: 100 }));
  await selectBuilding(page, "Production", "Sawmill");
  const { x, y } = await tilePosition(page, site);
  await page.mouse.move(x, y, { steps: 5 });
  await expect
    .poll(
      () => page.evaluate(() => window.__solarpunk?.getRingTiles().length),
      {
        timeout: 30_000,
      },
    )
    .toBe(1);
  await page.mouse.click(x, y);
  await expect
    .poll(
      () => page.evaluate((c) => window.__solarpunk?.getBuildingType(c), site),
      { timeout: 30_000 },
    )
    .toBe("Sawmill");
  await page.keyboard.press("Escape");

  // the weekly tick staffs the site: the first resident becomes a builder
  await page.clock.runFor(1000);
  const [first] = await page.evaluate(() => window.__solarpunk!.getSettlers());
  const canvas = (await page.locator("canvas").boundingBox())!;
  await expect
    .poll(
      async () => {
        const position = await page.evaluate(
          (id) => window.__solarpunk!.settlerToScreen(id, "body"),
          first.id,
        );
        if (position) {
          await page.mouse.move(canvas.x + position.x, canvas.y + position.y);
          await page.mouse.click(canvas.x + position.x, canvas.y + position.y);
        }
        return (
          await page.evaluate(() => window.__solarpunk!.getSettlerMarker())
        ).id;
      },
      { timeout: 120_000, intervals: [300] },
    )
    .toBe(first.id);

  await expect(page.getByTestId("settler-occupation")).toHaveText(
    "Occupation: Builder",
  );
  const activity = page.getByTestId("settler-activity");
  await expect(activity).toHaveText("Walking to construction site");
  // the arrival is not awaited: slow CI frames are capped per frame, so the
  // walk can take arbitrarily long there ("Building" is covered by unit tests)
});
