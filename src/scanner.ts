import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_IGNORED_DIRECTORIES,
  countLanguages,
  countTests,
  describeTopLevelEntry,
  detectDocs,
  detectEntrypoints,
  detectFrameworkClues,
  detectManifests,
  detectMonorepo,
  detectPackageManager,
  type PackageManifestInfo
} from "./heuristics.js";
import type { RepositorySnapshot, ResolvedTarget, TopLevelEntry } from "./types.js";

export interface ScanOptions {
  maxFiles: number;
}

interface PackageJsonShape {
  name?: string;
  scripts?: Record<string, string>;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

interface ManifestBundle {
  packageInfo?: PackageManifestInfo;
  frameworkSources: string[];
  workspacesFromPackageJson?: string[];
}

export async function scanRepository(
  resolvedTarget: ResolvedTarget,
  options: ScanOptions
): Promise<RepositorySnapshot> {
  const rootEntries = await readdir(resolvedTarget.rootPath, { withFileTypes: true });
  const visibleRootEntries = rootEntries
    .filter((entry) => !DEFAULT_IGNORED_DIRECTORIES.includes(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  const topLevelEntries: TopLevelEntry[] = visibleRootEntries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? "directory" : "file",
    description: describeTopLevelEntry(entry.name, entry.isDirectory() ? "directory" : "file")
  }));

  const filePaths: string[] = [];
  let maxFilesReached = false;

  async function walkDirectory(absoluteDir: string, relativeDir = ""): Promise<void> {
    if (filePaths.length >= options.maxFiles) {
      maxFilesReached = true;
      return;
    }

    const entries = (await readdir(absoluteDir, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name)
    );

    for (const entry of entries) {
      if (DEFAULT_IGNORED_DIRECTORIES.includes(entry.name)) {
        continue;
      }

      if (filePaths.length >= options.maxFiles) {
        maxFilesReached = true;
        return;
      }

      const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
      const absolutePath = path.join(absoluteDir, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(absolutePath, relativePath);
        continue;
      }

      if (entry.isFile()) {
        filePaths.push(relativePath);
      }
    }
  }

  await walkDirectory(resolvedTarget.rootPath);

  const manifestBundle = await collectManifestSignals(resolvedTarget.rootPath);
  const frameworkClues = detectFrameworkClues(manifestBundle.frameworkSources);
  const packageInfo = manifestBundle.packageInfo;
  const rootEntryNames = visibleRootEntries.map((entry) => entry.name);
  const testFileCount = countTests(filePaths);
  const monorepoInfo = detectMonorepo(rootEntryNames, manifestBundle.workspacesFromPackageJson);

  return {
    sourceKind: resolvedTarget.kind,
    source: resolvedTarget.source,
    displayName: resolvedTarget.displayName,
    rootPath: resolvedTarget.rootPath,
    fileCount: filePaths.length,
    maxFiles: options.maxFiles,
    maxFilesReached,
    ignoredDirectories: [...DEFAULT_IGNORED_DIRECTORIES],
    topLevelEntries,
    languages: countLanguages(filePaths),
    manifests: detectManifests(filePaths, rootEntryNames),
    packageName: packageInfo?.packageName,
    packageManager: detectPackageManager(rootEntryNames),
    packageScripts: packageInfo?.packageScripts ?? [],
    packageBins: packageInfo?.packageBins ?? [],
    frameworkClues,
    entrypoints: detectEntrypoints(filePaths, packageInfo),
    docsPresent: detectDocs(filePaths, rootEntryNames),
    testsPresent: testFileCount > 0,
    testFileCount,
    isMonorepo: monorepoInfo.isMonorepo,
    workspacePackages: monorepoInfo.workspacePackages
  };
}

async function collectManifestSignals(rootPath: string): Promise<ManifestBundle> {
  const frameworkSources: string[] = [];
  let packageInfo: PackageManifestInfo | undefined;
  let workspacesFromPackageJson: string[] | undefined;

  const packageJsonPath = path.join(rootPath, "package.json");
  const packageJson = await readOptionalJson(packageJsonPath);
  if (packageJson) {
    const dependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    };
    frameworkSources.push(JSON.stringify(dependencies));

    const packageBins = normalizePackageBin(packageJson.bin);
    packageInfo = {
      packageName: packageJson.name,
      packageScripts: Object.keys(packageJson.scripts ?? {}).sort((left, right) => left.localeCompare(right)),
      packageBins
    };

    workspacesFromPackageJson = normalizeWorkspacesField(packageJson.workspaces);
  }

  const pyprojectText = await readOptionalText(path.join(rootPath, "pyproject.toml"));
  if (pyprojectText) {
    frameworkSources.push(pyprojectText);
  }

  const requirementsText = await readOptionalText(path.join(rootPath, "requirements.txt"));
  if (requirementsText) {
    frameworkSources.push(requirementsText);
  }

  const goModText = await readOptionalText(path.join(rootPath, "go.mod"));
  if (goModText) {
    frameworkSources.push(goModText);
  }

  return {
    packageInfo,
    frameworkSources,
    workspacesFromPackageJson
  };
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function readOptionalJson(filePath: string): Promise<PackageJsonShape | undefined> {
  const text = await readOptionalText(filePath);
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as PackageJsonShape;
}

function normalizePackageBin(binField: PackageJsonShape["bin"]): string[] {
  if (!binField) {
    return [];
  }

  if (typeof binField === "string") {
    return [binField];
  }

  return Object.values(binField).sort((left, right) => left.localeCompare(right));
}

function normalizeWorkspacesField(workspaces: PackageJsonShape["workspaces"]): string[] | undefined {
  if (!workspaces) {
    return undefined;
  }

  if (Array.isArray(workspaces)) {
    return workspaces.length > 0 ? workspaces : undefined;
  }

  // Yarn-style { packages: string[] }
  if (Array.isArray(workspaces.packages) && workspaces.packages.length > 0) {
    return workspaces.packages;
  }

  return undefined;
}
