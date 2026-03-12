export type TargetKind = "local" | "github";

export type OutputFormat = "text" | "markdown" | "json";

export interface CliOptions {
  target: string;
  writePath?: string;
  noAi: boolean;
  model?: string;
  maxFiles: number;
  format: OutputFormat;
}

export interface TopLevelEntry {
  name: string;
  kind: "file" | "directory";
  description: string;
}

export interface LanguageCount {
  name: string;
  fileCount: number;
}

export interface ResolvedTarget {
  kind: TargetKind;
  source: string;
  displayName: string;
  rootPath: string;
  cleanup: () => Promise<void>;
}

export interface RepositorySnapshot {
  sourceKind: TargetKind;
  source: string;
  displayName: string;
  rootPath: string;
  fileCount: number;
  maxFiles: number;
  maxFilesReached: boolean;
  ignoredDirectories: string[];
  topLevelEntries: TopLevelEntry[];
  languages: LanguageCount[];
  manifests: string[];
  packageName?: string;
  packageManager?: string;
  packageScripts: string[];
  packageBins: string[];
  frameworkClues: string[];
  entrypoints: string[];
  docsPresent: boolean;
  testsPresent: boolean;
  testFileCount: number;
  isMonorepo: boolean;
  workspacePackages: string[];
}

export interface DeterministicExplanation {
  projectOverview: string;
  technologySignals: string[];
  architectureSummary: string;
  testingAndDocsStatus: string;
  developerHandoffSummary: string;
}

export interface AnalysisReport {
  snapshot: RepositorySnapshot;
  explanation: DeterministicExplanation;
  aiSummary: string | null;
}

export interface AnalysisResult {
  report: AnalysisReport;
  consoleOutput: string;
  markdownOutput: string;
  jsonOutput: string;
  warnings: string[];
}
