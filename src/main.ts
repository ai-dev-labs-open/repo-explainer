import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_ANTHROPIC_MODEL, generateAiRepositorySummary } from "./anthropic.js";
import { buildDeterministicExplanation } from "./explainer.js";
import { renderConsoleReport, renderJsonReport, renderMarkdownReport, renderReport } from "./renderers.js";
import { scanRepository } from "./scanner.js";
import { resolveTarget } from "./target.js";
import type { AnalysisResult, OutputFormat, ResolvedTarget } from "./types.js";

export const DEFAULT_MAX_FILES = 250;

export interface AnalyzeOptions {
  writePath?: string;
  noAi?: boolean;
  model?: string;
  maxFiles?: number;
  format?: OutputFormat;
}

export interface AnalyzeDependencies {
  resolveTarget?: (target: string) => Promise<ResolvedTarget>;
  generateAiSummary?: typeof generateAiRepositorySummary;
}

export async function analyzeRepositoryTarget(
  target: string,
  options: AnalyzeOptions = {},
  dependencies: AnalyzeDependencies = {}
): Promise<AnalysisResult> {
  const resolveTargetFn = dependencies.resolveTarget ?? resolveTarget;
  const generateAiSummary = dependencies.generateAiSummary ?? generateAiRepositorySummary;
  const resolvedTarget = await resolveTargetFn(target);

  try {
    const snapshot = await scanRepository(resolvedTarget, {
      maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES
    });
    const explanation = buildDeterministicExplanation(snapshot);
    const warnings: string[] = [];
    let aiSummary: string | null = null;

    if (!options.noAi && process.env.ANTHROPIC_API_KEY) {
      try {
        aiSummary = await generateAiSummary(snapshot, explanation, {
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: options.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL
        });
      } catch (error) {
        warnings.push(
          `AI enrichment skipped: ${error instanceof Error ? error.message : "Unknown Anthropic error."}`
        );
      }
    }

    const report = {
      snapshot,
      explanation,
      aiSummary
    };

    const consoleOutput = renderConsoleReport(report);
    const markdownOutput = renderMarkdownReport(report);
    const jsonOutput = renderJsonReport(report);

    if (options.writePath) {
      const format = options.format ?? "text";
      const fileContent = renderReport(report, format);
      const absoluteWritePath = path.resolve(options.writePath);
      await mkdir(path.dirname(absoluteWritePath), { recursive: true });
      await writeFile(absoluteWritePath, fileContent, "utf8");
    }

    return {
      report,
      consoleOutput,
      markdownOutput,
      jsonOutput,
      warnings
    };
  } finally {
    await resolvedTarget.cleanup();
  }
}
