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
- Print a concise terminal explanation.
- Optionally write a Markdown report for sharing or contributor onboarding.
- Keep AI optional so the tool remains useful without API credentials.

## CLI contract

```bash
repo-explainer explain <target> [--write <file>] [--no-ai] [--model <name>] [--max-files <n>]
```

Examples:

```bash
repo-explainer explain .
repo-explainer explain https://github.com/octocat/Hello-World --write reports/hello-world.md
repo-explainer explain ../another-repo --no-ai --max-files 150
```

## How it works

1. Resolve the target.
   - Local paths are analyzed in place.
   - Public GitHub URLs are shallow-cloned into a temporary directory and cleaned up after analysis.
2. Scan the repository deterministically.
   - Ignore common noise such as `.git`, `node_modules`, and build output.
   - Collect top-level structure, languages, manifests, docs/tests presence, likely entrypoints, and framework clues.
3. Build a static explanation.
   - Produce a project overview, architecture guess, technology signals, and testing/docs status from heuristics.
4. Optionally enrich with Anthropic.
   - If `ANTHROPIC_API_KEY` is present and `--no-ai` is not set, send the normalized snapshot to Anthropic for a short developer handoff note.
5. Render output.
   - Print a CLI summary.
   - Optionally write a Markdown report with stable section headings.

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
  Language, entrypoint, framework, and structure detection helpers.
- `src/explainer.ts`
  Deterministic narrative synthesis from the repository snapshot.
- `src/renderers.ts`
  Console and Markdown renderers.
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
8. Refine output quality and packaging.

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
```

Use AI enrichment:

```bash
export ANTHROPIC_API_KEY=your_key_here
npm run dev -- explain . --write report.md
```

## Roadmap

- Improve heuristics for monorepos and multi-language repos.
- Add richer framework detection outside the JavaScript ecosystem.
- Add JSON output for downstream automation.
- Add packaging and release automation once the core UX stabilizes.
