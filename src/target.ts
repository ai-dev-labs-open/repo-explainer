import { spawn } from "node:child_process";
import { access, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ResolvedTarget } from "./types.js";

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

export interface ResolveTargetOptions {
  cloneRepo?: (url: string, displayName: string) => Promise<ResolvedTarget>;
}

export function isGitHubRepoUrl(target: string): boolean {
  return GITHUB_URL_PATTERN.test(target);
}

export async function resolveTarget(
  target: string,
  options: ResolveTargetOptions = {}
): Promise<ResolvedTarget> {
  if (isGitHubRepoUrl(target)) {
    const match = target.match(GITHUB_URL_PATTERN);
    if (!match) {
      throw new Error(`Unsupported GitHub URL: ${target}`);
    }

    const owner = match[1];
    const repo = match[2];
    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    const displayName = `${owner}/${repo}`;

    return (options.cloneRepo ?? shallowCloneRepo)(cloneUrl, displayName);
  }

  const resolvedPath = path.resolve(target);
  await access(resolvedPath);

  const stats = await stat(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`Target must be a directory or GitHub repository URL: ${target}`);
  }

  return {
    kind: "local",
    source: resolvedPath,
    displayName: path.basename(resolvedPath),
    rootPath: resolvedPath,
    cleanup: async () => {}
  };
}

export async function shallowCloneRepo(url: string, displayName: string): Promise<ResolvedTarget> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "repo-explainer-"));
  const checkoutPath = path.join(tempRoot, "repo");

  try {
    await runGit(["clone", "--depth", "1", "--quiet", url, checkoutPath]);

    return {
      kind: "github",
      source: url,
      displayName,
      rootPath: checkoutPath,
      cleanup: async () => {
        await rm(tempRoot, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function runGit(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `git ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}
