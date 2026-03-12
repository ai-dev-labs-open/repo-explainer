import type { AnalysisReport } from "./types.js";

export function renderConsoleReport(report: AnalysisReport): string {
  const { snapshot, explanation, aiSummary } = report;
  const sections = [
    `Repo: ${snapshot.displayName}`,
    `Source: ${snapshot.source}`,
    `Overview: ${explanation.projectOverview}`,
    `Top level: ${formatTopLevel(snapshot.topLevelEntries.map((entry) => entry.name))}`,
    `Languages: ${formatPairs(snapshot.languages.map((language) => `${language.name} (${language.fileCount})`), "No languages detected")}`,
    `Technology signals: ${explanation.technologySignals.join(" | ")}`,
    `Architecture: ${explanation.architectureSummary}`,
    `Tests/docs: ${explanation.testingAndDocsStatus}`,
    `AI handoff: ${aiSummary ?? "Skipped. Set ANTHROPIC_API_KEY to enable optional enrichment."}`
  ];

  return sections.join("\n");
}

export function renderMarkdownReport(report: AnalysisReport): string {
  const { snapshot, explanation, aiSummary } = report;

  const topLevelLines =
    snapshot.topLevelEntries.length > 0
      ? snapshot.topLevelEntries.map((entry) => `- \`${entry.name}\` - ${entry.description}`).join("\n")
      : "- No visible top-level entries were detected.";

  const languageLines =
    snapshot.languages.length > 0
      ? snapshot.languages.map((language) => `- ${language.name}: ${language.fileCount} file(s)`).join("\n")
      : "- No recognized languages were detected.";

  const signalLines = explanation.technologySignals.map((signal) => `- ${signal}`).join("\n");
  const entrypointLines =
    snapshot.entrypoints.length > 0
      ? snapshot.entrypoints.map((entrypoint) => `- \`${entrypoint}\``).join("\n")
      : "- No canonical entrypoints detected.";

  return [
    `# Repo Explanation: ${snapshot.displayName}`,
    "",
    "## Project Overview",
    explanation.projectOverview,
    "",
    "## Repository Structure",
    topLevelLines,
    "",
    "## Technology Signals",
    signalLines,
    "",
    languageLines,
    "",
    "## Likely Architecture and Entrypoints",
    explanation.architectureSummary,
    "",
    entrypointLines,
    "",
    "## Testing and Docs Status",
    explanation.testingAndDocsStatus,
    "",
    "## Optional AI Developer Handoff Summary",
    aiSummary ?? "AI enrichment was skipped because no API key was configured, `--no-ai` was used, or the Anthropic request failed."
  ].join("\n");
}

function formatTopLevel(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "No visible top-level entries";
}

function formatPairs(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}
