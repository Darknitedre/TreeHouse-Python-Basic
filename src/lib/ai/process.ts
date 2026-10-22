import { getAnthropic, getModel, extractJson } from "./client";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildTextAnalysisPrompt,
  IMAGE_ANALYSIS_INSTRUCTION,
  WEEKLY_REPORT_SYSTEM_PROMPT,
} from "./prompts";
import { PostAnalysisSchema, type PostAnalysis } from "../validation";

export interface AnalysisResult {
  ok: boolean;
  analysis?: PostAnalysis;
  error?: string;
  raw?: string;
}

const MAX_TOKENS = 2000;

/**
 * Analyze text content (URL metadata, pasted text, transcript, or notes).
 * Always resolves — on any failure it returns { ok: false } so the caller can
 * mark the post `failed` and keep going.
 */
export async function analyzeText(input: {
  platform?: string;
  url?: string;
  author?: string;
  title?: string;
  content: string;
}): Promise<AnalysisResult> {
  try {
    const client = getAnthropic();
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: MAX_TOKENS,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildTextAnalysisPrompt(input) }],
    });
    return validate(collectText(message));
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

/**
 * Analyze a screenshot: the model reads visible text (OCR/vision) and returns
 * the same analysis JSON, with the transcribed text in `extracted_text`.
 */
export async function analyzeImage(input: {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  url?: string;
  author?: string;
}): Promise<AnalysisResult> {
  try {
    const client = getAnthropic();
    const meta: string[] = [];
    if (input.url) meta.push(`URL: ${input.url}`);
    if (input.author) meta.push(`Author: ${input.author}`);
    const text = (meta.length ? meta.join("\n") + "\n\n" : "") + IMAGE_ANALYSIS_INSTRUCTION;

    const message = await client.messages.create({
      model: getModel(),
      max_tokens: MAX_TOKENS,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: input.mediaType, data: input.base64 },
            },
            { type: "text", text },
          ],
        },
      ],
    });
    return validate(collectText(message));
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

/**
 * Generate the weekly knowledge-and-action report. Returns a plain object or
 * null on failure.
 */
export async function generateWeeklyReport(data: unknown): Promise<Record<string, unknown> | null> {
  try {
    const client = getAnthropic();
    const message = await client.messages.create({
      model: getModel(),
      max_tokens: 1500,
      system: WEEKLY_REPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(data) }],
    });
    const parsed = extractJson(collectText(message));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------
function collectText(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

function validate(text: string): AnalysisResult {
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch (e) {
    return { ok: false, error: "Model did not return valid JSON", raw: text };
  }
  const result = PostAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: "AI response failed validation: " + result.error.issues.map((i) => i.message).join("; "),
      raw: text,
    };
  }
  return { ok: true, analysis: result.data };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown AI error";
}
