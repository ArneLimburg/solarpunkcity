import { createCoverageReport } from "./coverage";

export default async function globalTeardown() {
  await createCoverageReport().generate();
}
