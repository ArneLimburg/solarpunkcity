import {
  CoverageReport,
  type CoverageReportOptions,
} from "monocart-coverage-reports";

// minimum coverage in percent per file
const thresholds = {
  functions: 100,
  statements: 95,
  branches: 95,
  lines: 95,
} as const;

const requiredFiles = [
  "src/App.tsx",
  "src/Map.tsx",
  "src/Menu.tsx",
  "src/main.tsx",
];

// applied while adding, so raw shard data only holds the relevant entries
const entryFilter: CoverageReportOptions["entryFilter"] = (entry) =>
  /\/src\/.*\.tsx/.test(entry.url);

export const coverageOptions: CoverageReportOptions = {
  name: "Solar Punk City e2e coverage",
  outputDir: "coverage/e2e",
  reports: ["console-summary", "v8", "lcovonly"],
  entryFilter,
  sourceFilter: (sourcePath) => sourcePath.endsWith(".tsx"),
  sourcePath: (filePath) => `src/${filePath.split("/").pop()}`,
  onEnd: (coverageResults) => {
    const files = coverageResults?.files ?? [];
    const failures: string[] = [];
    for (const file of files) {
      for (const [metric, minimum] of Object.entries(thresholds)) {
        const { total, pct: actual } =
          file.summary[metric as keyof typeof thresholds];
        // a file without e.g. functions has nothing to cover
        if (total > 0 && (typeof actual !== "number" || actual < minimum)) {
          failures.push(
            `${file.sourcePath}: ${metric} coverage ${actual}% is below ${minimum}%`,
          );
        }
      }
    }
    const covered = new Set(files.map((file) => file.sourcePath));
    for (const name of requiredFiles) {
      if (!covered.has(name)) {
        failures.push(`${name}: not covered at all`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`e2e coverage too low:\n${failures.join("\n")}`);
    }
  },
};

// In a CI shard (E2E_COVERAGE_SHARD=1) a single shard cannot meet the thresholds. It only writes
// its raw data to coverage/e2e-shard/raw; `npm run test:e2e:merge` merges all shards and checks.
export const shardOptions: CoverageReportOptions = {
  name: coverageOptions.name,
  outputDir: "coverage/e2e-shard",
  reports: ["raw"],
  entryFilter,
};

export const createCoverageReport = () =>
  new CoverageReport(
    process.env.E2E_COVERAGE_SHARD ? shardOptions : coverageOptions,
  );
