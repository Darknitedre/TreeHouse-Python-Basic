// Pluggable embeddings for semantic search. If EMBEDDINGS_API_KEY is set we call
// a real provider; otherwise we fall back to a deterministic local hash-based
// embedding so the app runs (and semantic search degrades gracefully) without
// any embeddings credentials.

const DIM = 1536;

export async function embed(text: string): Promise<number[]> {
  const key = process.env.EMBEDDINGS_API_KEY;
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!clean) return zeros();
  if (!key) return localEmbed(clean);

  try {
    const res = await fetch(process.env.EMBEDDINGS_URL || "https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        input: clean,
        model: process.env.EMBEDDINGS_MODEL || "voyage-3",
      }),
    });
    if (!res.ok) return localEmbed(clean);
    const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const vec = json.data?.[0]?.embedding;
    if (!vec || vec.length === 0) return localEmbed(clean);
    return fit(vec);
  } catch {
    return localEmbed(clean);
  }
}

/** Format a JS number[] as a pgvector literal string, e.g. "[0.1,0.2,...]". */
export function toVectorLiteral(vec: number[]): string {
  return "[" + vec.map((n) => (Number.isFinite(n) ? n.toFixed(6) : "0")).join(",") + "]";
}

function zeros(): number[] {
  return new Array(DIM).fill(0);
}

/** Resize/normalize an arbitrary-length vector to DIM. */
function fit(vec: number[]): number[] {
  if (vec.length === DIM) return normalize(vec);
  const out = zeros();
  for (let i = 0; i < vec.length; i++) out[i % DIM] += vec[i];
  return normalize(out);
}

/**
 * Deterministic bag-of-words hashing embedding. Not semantically strong, but it
 * keeps cosine similarity meaningful for shared vocabulary and lets the whole
 * pipeline run offline.
 */
function localEmbed(text: string): number[] {
  const out = zeros();
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const tok of tokens) {
    const h = hash(tok);
    out[h % DIM] += 1;
  }
  return normalize(out);
}

function normalize(vec: number[]): number[] {
  let mag = 0;
  for (const v of vec) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  return vec.map((v) => v / mag);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
