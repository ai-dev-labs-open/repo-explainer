import type { DeterministicExplanation, RepositorySnapshot } from "./types.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-3-7-sonnet-latest";

interface AnthropicMessageResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
}

export interface AnthropicOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export async function generateAiRepositorySummary(
  snapshot: RepositorySnapshot,
  explanation: DeterministicExplanation,
  options: AnthropicOptions
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 300,
      system:
        "You summarize repositories for engineers. Be concise, practical, and architecture-focused. Avoid inventing files or dependencies.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildAiPrompt(snapshot, explanation)
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API request failed: ${response.status} ${errorText}`.trim());
  }

  const data = (await response.json()) as AnthropicMessageResponse;
  const text = data.content
    ?.filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic API returned an empty text response.");
  }

  return text;
}

function buildAiPrompt(snapshot: RepositorySnapshot, explanation: DeterministicExplanation): string {
  const promptPayload = {
    project: {
      name: snapshot.displayName,
      sourceKind: snapshot.sourceKind,
      languages: snapshot.languages,
      manifests: snapshot.manifests,
      frameworks: snapshot.frameworkClues,
      entrypoints: snapshot.entrypoints,
      topLevelEntries: snapshot.topLevelEntries.slice(0, 8),
      docsPresent: snapshot.docsPresent,
      testsPresent: snapshot.testsPresent,
      testFileCount: snapshot.testFileCount,
      maxFilesReached: snapshot.maxFilesReached
    },
    deterministicExplanation: explanation
  };

  return [
    "Write a short developer handoff summary for this repository.",
    "Focus on likely architecture, where a new maintainer should start, and any caveats from limited scan coverage.",
    "Keep it under 180 words.",
    "",
    JSON.stringify(promptPayload, null, 2)
  ].join("\n");
}
