import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeRepositoryTarget } from "../src/main.js";
import { renderJsonReport, renderMarkdownReport, renderConsoleReport, renderReport } from "../src/renderers.js";
import { resolveTarget } from "../src/target.js";

const fixturesRoot = fileURLToPath(new URL("./fixtures", import.meta.url));
const tsFixture = path.join(fixturesRoot, "ts-app");
const pythonFixture = path.join(fixturesRoot, "python-tool");
const monorepoFixture = path.join(fixturesRoot, "monorepo-workspace");
const pnpmMonorepoFixture = path.join(fixturesRoot, "pnpm-monorepo");

describe("analyzeRepositoryTarget", () => {
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  it("analyzes a local TypeScript repo and exports stable markdown", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, {
      noAi: true,
      maxFiles: 50
    });

    expect(result.report.snapshot.frameworkClues).toEqual(["Express", "Vitest"]);
    expect(result.report.snapshot.testsPresent).toBe(true);
    expect(result.report.snapshot.docsPresent).toBe(true);
    expect(result.report.snapshot.topLevelEntries.some((entry) => entry.name === "node_modules")).toBe(false);

    expect(result.markdownOutput).toMatchInlineSnapshot(`
      "# Repo Explanation: ts-app

      ## Project Overview
      ts-app looks like a typescript repository with 5 visible top-level entries. The top level is anchored by docs, package.json, README.md, src, and tests.

      ## Repository Structure
      - \`docs\` - Project documentation
      - \`package.json\` - Node package manifest
      - \`README.md\` - Top-level documentation
      - \`src\` - Primary source code
      - \`tests\` - Automated tests

      ## Technology Signals
      - Primary language: TypeScript
      - Package name: ts-app
      - Manifests: package.json
      - Package management appears to use npm-compatible.
      - Framework signals include Express and Vitest.

      - TypeScript: 3 file(s)
      - Markdown: 2 file(s)
      - JSON: 1 file(s)

      ## Likely Architecture and Entrypoints
      Most implementation work is likely centered in src. Likely entrypoints include ./src/index.ts, src/index.ts, and src/server.ts.

      - \`./src/index.ts\`
      - \`src/index.ts\`
      - \`src/server.ts\`

      ## Testing and Docs Status
      Documentation signals are present. Tests are present with 1 detected test file. The scan completed within the configured file limit.

      ## Optional AI Developer Handoff Summary
      AI enrichment was skipped because no API key was configured, \`--no-ai\` was used, or the Anthropic request failed."
    `);
  });

  it("analyzes a non-Node repo and detects Python signals", async () => {
    const result = await analyzeRepositoryTarget(pythonFixture, {
      noAi: true,
      maxFiles: 50
    });

    expect(result.report.snapshot.languages[0]?.name).toBe("Python");
    expect(result.report.snapshot.frameworkClues).toEqual(["Pytest", "Typer"]);
    expect(result.report.snapshot.entrypoints).toContain("src/tool/__main__.py");
    expect(result.report.snapshot.packageManager).toBeUndefined();
  });

  it("respects the scan limit", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, {
      noAi: true,
      maxFiles: 1
    });

    expect(result.report.snapshot.fileCount).toBe(1);
    expect(result.report.snapshot.maxFilesReached).toBe(true);
  });

  it("skips AI when there is no API key", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, {
      maxFiles: 50
    });

    expect(result.report.aiSummary).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("does not call AI when --no-ai is set", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const generateAiSummary = vi.fn();

    await analyzeRepositoryTarget(
      tsFixture,
      {
        noAi: true,
        maxFiles: 50
      },
      {
        generateAiSummary
      }
    );

    expect(generateAiSummary).not.toHaveBeenCalled();
  });

  it("uses the clone abstraction for GitHub URLs", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const cloneRepo = vi.fn().mockResolvedValue({
      kind: "github",
      source: "https://github.com/example/repo.git",
      displayName: "example/repo",
      rootPath: tsFixture,
      cleanup
    });

    const result = await analyzeRepositoryTarget(
      "https://github.com/example/repo",
      {
        noAi: true,
        maxFiles: 50
      },
      {
        resolveTarget: (target) => resolveTarget(target, { cloneRepo })
      }
    );

    expect(cloneRepo).toHaveBeenCalledWith("https://github.com/example/repo.git", "example/repo");
    expect(result.report.snapshot.sourceKind).toBe("github");
    expect(cleanup).toHaveBeenCalled();
  });

  it("records an AI warning instead of failing the run", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const generateAiSummary = vi.fn().mockRejectedValue(new Error("invalid credentials"));

    const result = await analyzeRepositoryTarget(
      tsFixture,
      {
        maxFiles: 50
      },
      {
        generateAiSummary
      }
    );

    expect(result.report.aiSummary).toBeNull();
    expect(result.warnings[0]).toContain("AI enrichment skipped");
  });

  it("non-monorepo repo has isMonorepo=false", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, { noAi: true });

    expect(result.report.snapshot.isMonorepo).toBe(false);
    expect(result.report.snapshot.workspacePackages).toEqual([]);
  });

  it("detects monorepo via package.json workspaces field", async () => {
    const result = await analyzeRepositoryTarget(monorepoFixture, { noAi: true });

    expect(result.report.snapshot.isMonorepo).toBe(true);
    expect(result.report.snapshot.workspacePackages).toEqual(["apps/*", "packages/*"]);
    expect(result.report.explanation.projectOverview).toContain("monorepo");
  });

  it("detects monorepo via pnpm-workspace.yaml", async () => {
    const result = await analyzeRepositoryTarget(pnpmMonorepoFixture, { noAi: true });

    expect(result.report.snapshot.isMonorepo).toBe(true);
  });
});

describe("JSON output format", () => {
  it("produces valid parseable JSON with stable shape", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, { noAi: true, maxFiles: 50 });

    const parsed = JSON.parse(result.jsonOutput) as Record<string, unknown>;

    expect(parsed.name).toBe("ts-app");
    expect(parsed.sourceKind).toBe("local");
    expect(Array.isArray(parsed.languages)).toBe(true);
    expect(Array.isArray(parsed.frameworkClues)).toBe(true);
    expect(Array.isArray(parsed.entrypoints)).toBe(true);
    expect(typeof parsed.isMonorepo).toBe("boolean");
    expect(Array.isArray(parsed.workspacePackages)).toBe(true);
    expect(parsed.aiSummary).toBeNull();
    expect(typeof parsed.explanation).toBe("object");
    const explanation = parsed.explanation as Record<string, unknown>;
    expect(typeof explanation.projectOverview).toBe("string");
    expect(Array.isArray(explanation.technologySignals)).toBe(true);
  });

  it("renderJsonReport includes monorepo fields", async () => {
    const result = await analyzeRepositoryTarget(monorepoFixture, { noAi: true });
    const parsed = JSON.parse(renderJsonReport(result.report)) as Record<string, unknown>;

    expect(parsed.isMonorepo).toBe(true);
    expect(parsed.workspacePackages).toEqual(["apps/*", "packages/*"]);
  });

  it("renderReport dispatches correctly for each format", async () => {
    const result = await analyzeRepositoryTarget(tsFixture, { noAi: true, maxFiles: 50 });
    const { report } = result;

    expect(renderReport(report, "text")).toBe(renderConsoleReport(report));
    expect(renderReport(report, "markdown")).toBe(renderMarkdownReport(report));
    expect(renderReport(report, "json")).toBe(renderJsonReport(report));
  });
});
