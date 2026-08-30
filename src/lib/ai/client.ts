import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/**
 * Server-only Anthropic client. The key lives in ANTHROPIC_API_KEY and is never
 * shipped to the browser.
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

/**
 * Pull the first JSON object out of a model response. Handles the common cases
 * where the model wraps JSON in ```json fences or adds a sentence around it.
 * Returns the parsed value or throws.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Prefer a fenced block if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the first balanced {...} span.
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("No JSON object found in model response");
  }
}
