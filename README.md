# repo-explainer

`repo-explainer` is a TypeScript CLI that inspects a local repository or public GitHub URL and produces a deterministic architecture summary, with optional Anthropic-powered developer handoff notes.

## Why this exists

Open-source repos are easier to adopt when a new contributor can answer three questions quickly:

1. What kind of project is this?
2. Where does the important code live?
3. How should I approach it as a maintainer or contributor?

`repo-explainer` answers those questions from repository structure and common ecosystem signals first, then optionally asks Claude for a short higher-level narrative when `ANTHROPIC_API_KEY` is configured.

## MVP goals

- Accept either a local repository path or a public GitHub repository URL.
- Generate a deterministic summary from files, manifests, and top-level layout.
- Print a concise terminal explanation in text, Markdown, or JSON.
- Optionally write a report to disk in the selected format.
- Keep AI optional so the tool remains useful without API credentials.

## CLI contract

```bash
repo-explainer explain <target> [--format text|markdown|json] [--write <file>] [--no-ai] [--model <name>] [--max-files <n>]
```

### Options

| Option | Default | Description |
|---|---|---|
| `--format` | `text` | Output format: `text` (console), `markdown`, or `json` |
| `--write <file>` | — | Write the report to a file in the selected format |
| `--no-ai` | — | Skip Anthropic enrichment even if `ANTHROPIC_API_KEY` is set |
| `--model <name>` | `claude-3-7-sonnet-latest` | Anthropic model to use for enrichment |
| `--max-files <n>` | `250` | Maximum number of files to scan |

### Examples

```bash
# Plain text to terminal (default)
repo-explainer explain .

# JSON output for downstream tooling
repo-explainer explain . --format json

# Write a Markdown report
repo-explainer explain https://github.com/octocat/Hello-World --write reports/hello-world.md

# Write a JSON report for CI/automation
repo-explainer explain . --format json --write report.json

# Analyze without AI enrichment and limit scan depth
repo-explainer explain ../another-repo --no-ai --max-files 150
```

### JSON output shape

When `--format json` is used, the output is a stable JSON object suitable for downstream automation:

```json
{
  "name": "repo-name",
  "source": "/path/or/url",
  "sourceKind": "local",
  "fileCount": 42,
  "maxFilesReached": false,
  "isMonorepo": false,
  "workspacePackages": [],
  "languages": [{ "name": "TypeScript", "fileCount": 30 }],
  "primaryLanguage": "TypeScript",
  "manifests": ["package.json", "tsconfig.json"],
  "packageName": "my-package",
  "packageManager": "pnpm",
  "packageScripts": ["build", "lint", "test"],
  "packageBins": [],
  "frameworkClues": ["Express", "Vitest"],
  "entrypoints": ["src/index.ts"],
  "topLevelEntries": [{ "name": "src", "kind": "directory", "description": "Primary source code" }],
  "docsPresent": true,
  "testsPresent": true,
  "testFileCount": 3,
  "explanation": {
    "projectOverview": "...",
    "technologySignals": ["..."],
    "architectureSummary": "...",
    "testingAndDocsStatus": "...",
    "developerHandoffSummary": "..."
  },
  "aiSummary": null
}
```

## Monorepo detection

`repo-explainer` detects common workspace layouts automatically:

- `package.json` with a `workspaces` field (npm/Yarn workspaces)
- `pnpm-workspace.yaml` at the repository root
- Top-level `packages/` or `apps/` directories as a conventional fallback

Detected monorepos are flagged in all output formats via `isMonorepo: true` and `workspacePackages` lists the configured workspace globs.

## How it works

1. Resolve the target.
   - Local paths are analyzed in place.
   - Public GitHub URLs are shallow-cloned into a temporary directory and cleaned up after analysis.
2. Scan the repository deterministically.
   - Ignore common noise such as `.git`, `node_modules`, and build output.
   - Collect top-level structure, languages, manifests, docs/tests presence, likely entrypoints, framework clues, and workspace signals.
3. Build a static explanation.
   - Produce a project overview, architecture guess, technology signals, and testing/docs status from heuristics.
4. Optionally enrich with Anthropic.
   - If `ANTHROPIC_API_KEY` is present and `--no-ai` is not set, send the normalized snapshot to Anthropic for a short developer handoff note.
5. Render output.
   - Print to stdout in the selected format (text, Markdown, or JSON).
   - Optionally write to a file in the same format.

## Current architecture

- `src/cli.ts`
  CLI argument parsing and process exit handling.
- `src/main.ts`
  Orchestration for target resolution, scanning, explanation, AI enrichment, and rendering.
- `src/target.ts`
  Local-path and GitHub URL resolution, including shallow clone cleanup.
- `src/scanner.ts`
  Repository walk, manifest parsing, and snapshot creation.
- `src/heuristics.ts`
  Language, entrypoint, framework, monorepo, and structure detection helpers.
- `src/explainer.ts`
  Deterministic narrative synthesis from the repository snapshot.
- `src/renderers.ts`
  Console, Markdown, and JSON renderers.
- `src/anthropic.ts`
  Minimal Anthropic API client using the Messages API over `fetch`.

## Working with Claude Code

This repo is intended to be implemented in small, explicit tasks instead of one broad prompt.

Suggested task breakdown:

1. Scaffold the Node/TypeScript package, README, lint/test config, and CI.
2. Implement target resolution for local paths and public GitHub URLs.
3. Implement repository scanning and the normalized snapshot model.
4. Add heuristics for manifests, frameworks, entrypoints, tests, and docs.
5. Add deterministic console and Markdown renderers.
6. Add optional Anthropic enrichment with graceful fallback.
7. Add fixture-based tests for TypeScript and non-Node repositories.
8. Add JSON output format, monorepo detection, and README improvements.

Execution rules for Claude Code:

- Prefer deterministic heuristics over model calls for core behavior.
- Keep the CLI usable without credentials.
- Avoid over-engineering. This is a focused single-package tool.
- Add tests whenever a new heuristic changes user-facing output.

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

Run locally:

```bash
npm run dev -- explain .
npm run dev -- explain . --format json
```

Use AI enrichment:

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run dev -- explain . --write report.md
npm run dev -- explain . --format json --write report.json
```

## Roadmap

- Add richer framework detection outside the JavaScript ecosystem.
- Improve language detection for multi-language repos.
- Add packaging and release automation once the core UX stabilizes.
