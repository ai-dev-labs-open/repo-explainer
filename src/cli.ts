#!/usr/bin/env node

import { DEFAULT_ANTHROPIC_MODEL } from "./anthropic.js";
import { analyzeRepositoryTarget, DEFAULT_MAX_FILES } from "./main.js";
import type { CliOptions, OutputFormat } from "./types.js";

export async function run(argv: string[]): Promise<number> {
  try {
    const parsed = parseCliArgs(argv);

    if (parsed.help) {
      process.stdout.write(`${renderHelp()}\n`);
      return 0;
    }

    const result = await analyzeRepositoryTarget(parsed.options.target, {
      writePath: parsed.options.writePath,
      noAi: parsed.options.noAi,
      model: parsed.options.model,
      maxFiles: parsed.options.maxFiles,
      format: parsed.options.format
    });

    const format = parsed.options.format;
    const output = format === "json" ? result.jsonOutput : format === "markdown" ? result.markdownOutput : result.consoleOutput;
    process.stdout.write(`${output}\n`);

    for (const warning of result.warnings) {
      process.stderr.write(`Warning: ${warning}\n`);
    }

    if (parsed.options.writePath) {
      process.stdout.write(`Report written to ${parsed.options.writePath}\n`);
    }

    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
    process.stderr.write(`${renderHelp()}\n`);
    return 1;
  }
}

interface ParsedCliResult {
  help: boolean;
  options: CliOptions;
}

function parseCliArgs(argv: string[]): ParsedCliResult {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return {
      help: true,
      options: {
        target: "",
        noAi: false,
        maxFiles: DEFAULT_MAX_FILES,
        format: "text"
      }
    };
  }

  const [command, maybeTarget, ...rest] = argv;
  if (command !== "explain") {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (!maybeTarget) {
    throw new Error("Missing <target> argument.");
  }

  const options: CliOptions = {
    target: maybeTarget,
    noAi: false,
    maxFiles: DEFAULT_MAX_FILES,
    format: "text"
  };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];

    switch (value) {
      case "--write":
        index += 1;
        if (!rest[index]) {
          throw new Error("Missing value for --write.");
        }
        options.writePath = rest[index];
        break;
      case "--no-ai":
        options.noAi = true;
        break;
      case "--model":
        index += 1;
        if (!rest[index]) {
          throw new Error("Missing value for --model.");
        }
        options.model = rest[index];
        break;
      case "--max-files":
        index += 1;
        if (!rest[index]) {
          throw new Error("Missing value for --max-files.");
        }
        options.maxFiles = parsePositiveInteger(rest[index], "--max-files");
        break;
      case "--format":
        index += 1;
        if (!rest[index]) {
          throw new Error("Missing value for --format.");
        }
        options.format = parseOutputFormat(rest[index]);
        break;
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  return {
    help: false,
    options
  };
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseOutputFormat(value: string): OutputFormat {
  if (value === "text" || value === "markdown" || value === "json") {
    return value;
  }

  throw new Error(`--format must be one of: text, markdown, json. Got: ${value}`);
}

function renderHelp(): string {
  return [
    "Usage:",
    "  repo-explainer explain <target> [--format text|markdown|json] [--write <file>] [--no-ai] [--model <name>] [--max-files <n>]",
    "",
    "Examples:",
    "  repo-explainer explain .",
    "  repo-explainer explain . --format json",
    "  repo-explainer explain https://github.com/octocat/Hello-World --write report.md",
    "  repo-explainer explain https://github.com/octocat/Hello-World --format json --write report.json",
    "  repo-explainer explain ../another-repo --no-ai --max-files 150",
    "",
    "Environment:",
    `  ANTHROPIC_API_KEY enables optional AI enrichment. Default model: ${DEFAULT_ANTHROPIC_MODEL}`
  ].join("\n");
}

const exitCode = await run(process.argv.slice(2));
process.exit(exitCode);
