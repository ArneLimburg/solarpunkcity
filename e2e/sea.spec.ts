import { test, expect } from "./fixtures";

test("the sea backdrop is two unpickable meshes and costs two draw calls", async ({
  page,
}) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);
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
    page.evaluate(() => window.__solarpunk!.getBackdropStats());

  await frames(2);
  const shown = await stats();
  expect(shown.meshes).toEqual(["sea", "beach"]);
  expect(shown.pickable).toBe(0);

  await page.evaluate(() => window.__solarpunk!.setBackdropVisible(false));
  await frames(2);
  const hidden = await stats();
  expect(shown.drawCalls - hidden.drawCalls).toBe(2);

  await page.evaluate(() => window.__solarpunk!.setBackdropVisible(true));
  await frames(2);
  expect((await stats()).drawCalls).toBe(shown.drawCalls);
});
