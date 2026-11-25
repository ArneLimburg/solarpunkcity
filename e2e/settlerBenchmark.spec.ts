import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

// Crowd benchmark of the settler renderer.
//
// Reproduce: `npm run test:e2e -- e2e/settlerBenchmark.spec.ts`. It measures the same
// map, camera and 800x600 viewport (Chromium with software rendering, see
// playwright.config.ts) with 0 and with 1,000 moving settlers, drops the population
// to 10 and 0 and lets it regrow to 1,000 in the same session. After 10 warm-up
// frames it records 40 frames per phase and prints the median and the 95th
// percentile of the frame times and the draw calls per frame.
// With SETTLER_BENCHMARK_STRICT=1 the p95 of 1,000 settlers may exceed the p95 of
// 0 settlers by at most 5 ms (reference setup: a quiet machine; shared CI runners
// are too noisy for a frame-time assertion).

const WARM_UP_FRAMES = 10;
const MEASURED_FRAMES = 40;
const MAX_P95_INCREASE_MS = 5;

type Measurement = {
  median: number;
  p95: number;
  drawCalls: number;
  figures: number;
};

async function measure(page: Page, count: number): Promise<Measurement> {
  return page.evaluate(
    async ({ count, warmUp, frames }) => {
      const hooks = window.__solarpunk!;
      hooks.showSettlers(count);
      const nextFrame = () =>
        new Promise<number>((resolve) => requestAnimationFrame(resolve));
      for (let i = 0; i < warmUp; i++) {
        await nextFrame();
      }
      const times: number[] = [];
      let last = await nextFrame();
      for (let i = 0; i < frames; i++) {
        const now = await nextFrame();
        times.push(now - last);
        last = now;
      }
      times.sort((a, b) => a - b);
      const stats = hooks.getSettlerStats();
      return {
        median: times[Math.floor(times.length / 2)],
        p95: times[Math.floor(times.length * 0.95)],
        drawCalls: stats.drawCalls,
        figures: stats.count,
      };
    },
    { count, warmUp: WARM_UP_FRAMES, frames: MEASURED_FRAMES },
  );
}

test("1,000 moving settlers cost at most two draw calls and no stale figures remain", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await page.goto("./");
  await page.waitForFunction(() => window.__solarpunk !== undefined);

  const baseline = await measure(page, 0);
  const crowd = await measure(page, 1000);
  const dropped = await measure(page, 10);
  const empty = await measure(page, 0);
  const regrown = await measure(page, 1000);

  const report = { baseline, crowd, dropped, empty, regrown };
  console.log(`settler benchmark ${JSON.stringify(report, null, 2)}`);
  await testInfo.attach("settler-benchmark.json", {
    body: JSON.stringify(report, null, 2),
    contentType: "application/json",
  });

  expect(baseline.figures).toBe(0);
  expect(crowd.figures).toBe(1000);
  expect(dropped.figures).toBe(10);
  expect(empty.figures).toBe(0);
  expect(regrown.figures).toBe(1000);
  expect(crowd.drawCalls - baseline.drawCalls).toBeLessThanOrEqual(2);
  expect(regrown.drawCalls - baseline.drawCalls).toBeLessThanOrEqual(2);
  expect(empty.drawCalls).toBe(baseline.drawCalls);

  if (process.env.SETTLER_BENCHMARK_STRICT) {
    expect(crowd.p95 - baseline.p95).toBeLessThanOrEqual(MAX_P95_INCREASE_MS);
    expect(regrown.p95 - baseline.p95).toBeLessThanOrEqual(MAX_P95_INCREASE_MS);
  }

  // the real roster is shown again afterwards
  await page.evaluate(() => window.__solarpunk!.showSettlers(undefined));
  expect(
    await page.evaluate(() => window.__solarpunk!.getSettlerStats().count),
  ).toBe(2);
});
