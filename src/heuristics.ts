import path from "node:path";

import type { LanguageCount, TopLevelEntry } from "./types.js";

const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".py", "Python"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".swift", "Swift"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".cs", "C#"],
  [".cpp", "C++"],
  [".c", "C"],
  [".h", "C/C++ Header"],
  [".hpp", "C++ Header"],
  [".json", "JSON"],
  [".yml", "YAML"],
  [".yaml", "YAML"],
  [".toml", "TOML"],
  [".md", "Markdown"],
  [".sh", "Shell"]
]);

const FRAMEWORK_HINTS = [
  { pattern: /\bnext\b/i, name: "Next.js" },
  { pattern: /\breact\b/i, name: "React" },
  { pattern: /\bvue\b/i, name: "Vue" },
  { pattern: /\bsvelte\b/i, name: "Svelte" },
  { pattern: /\bexpress\b/i, name: "Express" },
  { pattern: /\bfastify\b/i, name: "Fastify" },
  { pattern: /\bhono\b/i, name: "Hono" },
  { pattern: /\bnest(js)?\b/i, name: "NestJS" },
  { pattern: /\bvitest\b/i, name: "Vitest" },
  { pattern: /\bjest\b/i, name: "Jest" },
  { pattern: /\bpytest\b/i, name: "Pytest" },
  { pattern: /\bflask\b/i, name: "Flask" },
  { pattern: /\bfastapi\b/i, name: "FastAPI" },
  { pattern: /\bdjango\b/i, name: "Django" },
  { pattern: /\btyper\b/i, name: "Typer" },
  { pattern: /\bcobra\b/i, name: "Cobra" }
];

const ENTRYPOINT_PRIORITY = [
  "src/index.ts",
  "src/main.ts",
  "src/cli.ts",
  "src/server.ts",
  "index.ts",
  "main.ts",
  "cli.ts",
  "app.py",
  "main.py",
  "src/tool/__main__.py"
];

const DOC_PATH_PATTERN = /(^|\/)(README|CHANGELOG|CONTRIBUTING|docs)(\.|\/|$)/i;
const TEST_PATH_PATTERN = /(^|\/)(tests?|__tests__)(\/|$)|(\.|_)(test|spec)\./i;

export const DEFAULT_IGNORED_DIRECTORIES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".cache",
  ".turbo",
  ".venv",
  "venv",
  "__pycache__"
];

const MANIFEST_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "tsconfig.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml"
]);

export interface PackageManifestInfo {
  packageName?: string;
  packageScripts: string[];
  packageBins: string[];
}

export function describeTopLevelEntry(name: string, kind: TopLevelEntry["kind"]): string {
  if (kind === "directory") {
    const descriptions: Record<string, string> = {
      src: "Primary source code",
      test: "Automated tests",
      tests: "Automated tests",
      docs: "Project documentation",
      examples: "Usage examples",
      scripts: "Automation scripts",
      packages: "Workspace packages",
      apps: "Application entrypoints",
      ".github": "GitHub workflows and templates"
    };

    return descriptions[name] ?? "Project directory";
  }

  const fileDescriptions: Record<string, string> = {
    "package.json": "Node package manifest",
    "pyproject.toml": "Python project manifest",
    "go.mod": "Go module manifest",
    "Cargo.toml": "Rust package manifest",
    "README.md": "Top-level documentation",
    "tsconfig.json": "TypeScript compiler settings"
  };

  return fileDescriptions[name] ?? "Project file";
}

export function detectLanguage(filePath: string): string | null {
  const baseName = path.basename(filePath);

  if (baseName === "Dockerfile") {
    return "Dockerfile";
  }

  if (baseName === "Makefile") {
    return "Makefile";
  }

  return LANGUAGE_BY_EXTENSION.get(path.extname(filePath).toLowerCase()) ?? null;
}

export function countLanguages(filePaths: string[]): LanguageCount[] {
  const counts = new Map<string, number>();

  for (const filePath of filePaths) {
    const language = detectLanguage(filePath);
    if (!language) {
      continue;
    }

    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, fileCount]) => ({ name, fileCount }));
}

export function detectManifests(filePaths: string[], rootEntryNames: Iterable<string>): string[] {
  const names = new Set<string>();

  for (const entry of rootEntryNames) {
    if (MANIFEST_NAMES.has(entry)) {
      names.add(entry);
    }
  }

  for (const filePath of filePaths) {
    const baseName = path.basename(filePath);
    if (MANIFEST_NAMES.has(baseName)) {
      names.add(baseName);
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

export function detectPackageManager(rootEntryNames: Iterable<string>): string | undefined {
  const names = new Set(rootEntryNames);

  if (names.has("pnpm-lock.yaml")) {
    return "pnpm";
  }

  if (names.has("yarn.lock")) {
    return "yarn";
  }

  if (names.has("package-lock.json")) {
    return "npm";
  }

  if (names.has("package.json")) {
    return "npm-compatible";
  }

  return undefined;
}

export function detectDocs(filePaths: string[], rootEntryNames: Iterable<string>): boolean {
  for (const entry of rootEntryNames) {
    if (DOC_PATH_PATTERN.test(entry)) {
      return true;
    }
  }

  return filePaths.some((filePath) => DOC_PATH_PATTERN.test(filePath));
}

export function countTests(filePaths: string[]): number {
  return filePaths.filter((filePath) => TEST_PATH_PATTERN.test(filePath)).length;
}

export function detectEntrypoints(filePaths: string[], packageInfo?: PackageManifestInfo): string[] {
  const explicitBins = packageInfo?.packageBins ?? [];
  const knownCandidates = new Set<string>(explicitBins);

  for (const priorityPath of ENTRYPOINT_PRIORITY) {
    if (filePaths.includes(priorityPath)) {
      knownCandidates.add(priorityPath);
    }
  }

  for (const filePath of filePaths) {
    const baseName = path.basename(filePath).toLowerCase();
    if (["index.ts", "main.ts", "cli.ts", "server.ts", "index.js", "main.py", "__main__.py"].includes(baseName)) {
      knownCandidates.add(filePath);
    }
  }

  return [...knownCandidates].sort((left, right) => left.localeCompare(right));
}

export function detectFrameworkClues(contents: string[]): string[] {
  const found = new Set<string>();

  for (const content of contents) {
    for (const hint of FRAMEWORK_HINTS) {
      if (hint.pattern.test(content)) {
        found.add(hint.name);
      }
    }
  }

  return [...found].sort((left, right) => left.localeCompare(right));
}

export function topLevelSourceLocations(entries: TopLevelEntry[]): string[] {
  const preferred = entries
    .filter((entry) => entry.kind === "directory" && ["src", "packages", "apps", "lib"].includes(entry.name))
    .map((entry) => entry.name);

  if (preferred.length > 0) {
    return preferred;
  }

  return entries
    .filter((entry) => entry.kind === "directory")
    .slice(0, 3)
    .map((entry) => entry.name);
}
