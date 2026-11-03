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

export const coverageOptions: CoverageReportOptions = {
  name: "Solar Punk City e2e coverage",
  outputDir: "coverage/e2e",
  reports: ["console-summary", "v8", "lcovonly"],
  entryFilter: (entry) => /\/src\/.*\.tsx/.test(entry.url),
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

export const createCoverageReport = () => new CoverageReport(coverageOptions);
