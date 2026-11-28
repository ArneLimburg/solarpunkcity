import { test, expect } from "./fixtures";

test("a gardener without work walks to the community garden and tends a bed", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
  // resident 1 has the hobby Gardening and no work: there is no workplace
  const [first] = await page.evaluate(() => window.__solarpunk!.getSettlers());
  await page.evaluate(
    (garden) => window.__solarpunk!.addCommunityGarden(garden),
    { q: -2, r: 3 },
  );

  // click the settler where it is until the profile shows (it keeps walking)
  const box = (await page.locator("canvas").boundingBox())!;
  await expect
    .poll(
      async () => {
        const position = await page.evaluate(
          (id) => window.__solarpunk!.settlerToScreen(id, "head"),
          first.id,
        );
        if (position) {
          await page.mouse.move(box.x + position.x, box.y + position.y);
          await page.mouse.click(box.x + position.x, box.y + position.y);
        }
        return (
          await page.evaluate(() => window.__solarpunk!.getSettlerMarker())
        ).id;
      },
      { timeout: 120_000, intervals: [300] },
    )
    .toBe(first.id);

  const activity = page.getByTestId("settler-activity");
  await expect(activity).toHaveText("Walking to the community garden", {
    timeout: 60_000,
  });
  await expect(activity).toHaveText("Tending the community garden", {
    timeout: 120_000,
  });
  expect(errors).toEqual([]);
});
