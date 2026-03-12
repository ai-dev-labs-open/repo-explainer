import { topLevelSourceLocations } from "./heuristics.js";
import type { DeterministicExplanation, RepositorySnapshot } from "./types.js";

export function buildDeterministicExplanation(snapshot: RepositorySnapshot): DeterministicExplanation {
  const primaryLanguage = snapshot.languages[0]?.name ?? "source";
  const topLevelNames = snapshot.topLevelEntries.slice(0, 5).map((entry) => entry.name);
  const sourceLocations = topLevelSourceLocations(snapshot.topLevelEntries);
  const frameworkLine =
    snapshot.frameworkClues.length > 0
      ? `Framework signals include ${joinHumanList(snapshot.frameworkClues)}.`
      : "No strong framework signature was detected from the available manifests.";
  const packageManagerLine = snapshot.packageManager
    ? `Package management appears to use ${snapshot.packageManager}.`
    : "No package manager could be inferred from the top-level manifests.";
  const entrypointLine =
    snapshot.entrypoints.length > 0
      ? `Likely entrypoints include ${joinHumanList(snapshot.entrypoints.slice(0, 3))}.`
      : "No canonical entrypoint was detected from common file names.";

  const monorepoLine = snapshot.isMonorepo
    ? snapshot.workspacePackages.length > 0
      ? ` This appears to be a monorepo with workspaces: ${joinHumanList(snapshot.workspacePackages)}.`
      : " This appears to be a monorepo."
    : "";

  const projectOverview =
    `${snapshot.displayName} looks like a ${primaryLanguage.toLowerCase()} repository with ` +
    `${snapshot.topLevelEntries.length} visible top-level entries. ` +
    `${topLevelNames.length > 0 ? `The top level is anchored by ${joinHumanList(topLevelNames)}.` : ""}${monorepoLine}`.trim();

  const technologySignals = [
    `Primary language: ${primaryLanguage}`,
    snapshot.packageName ? `Package name: ${snapshot.packageName}` : undefined,
    snapshot.manifests.length > 0 ? `Manifests: ${snapshot.manifests.join(", ")}` : undefined,
    packageManagerLine,
    frameworkLine
  ].filter((signal): signal is string => Boolean(signal));

  const architectureSummary =
    sourceLocations.length > 0
      ? `Most implementation work is likely centered in ${joinHumanList(sourceLocations)}. ${entrypointLine}`
      : `The repo does not expose a conventional source directory at the top level. ${entrypointLine}`;

  const docsLine = snapshot.docsPresent
    ? "Documentation signals are present."
    : "Documentation appears limited from the scanned files.";
  const testsLine = snapshot.testsPresent
    ? `Tests are present with ${snapshot.testFileCount} detected test file${snapshot.testFileCount === 1 ? "" : "s"}.`
    : "No obvious tests were detected in the scanned file set.";
  const scanLimitLine = snapshot.maxFilesReached
    ? `The scan hit the configured limit of ${snapshot.maxFiles} files, so some deeper files may not be represented.`
    : "The scan completed within the configured file limit.";

  const testingAndDocsStatus = `${docsLine} ${testsLine} ${scanLimitLine}`;

  const developerHandoffSummary =
    `${architectureSummary} ${frameworkLine} ${testsLine} ` +
    `${snapshot.docsPresent ? "Start with the README/docs before tracing entrypoints." : "Start from the entrypoints and manifests before inferring contributor workflows."}`;

  return {
    projectOverview,
    technologySignals,
    architectureSummary,
    testingAndDocsStatus,
    developerHandoffSummary
  };
}

function joinHumanList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}
