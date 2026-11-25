// Merges the raw e2e coverage of the CI shards (one directory each below the given root, default
// coverage/e2e-raw) into coverage/e2e and applies the threshold check of coverage.ts.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CoverageReport } from "monocart-coverage-reports";
import { coverageOptions } from "./coverage.ts";

const root = process.argv[2] ?? "coverage/e2e-raw";
const inputDir = existsSync(root)
  ? readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name))
  : [];
if (inputDir.length === 0) {
  console.error(`No raw e2e coverage found in ${root}`);
  process.exit(1);
}

try {
  await new CoverageReport({ ...coverageOptions, inputDir }).generate();
} catch (error) {
  console.error(error);
  process.exit(1);
}
