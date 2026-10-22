import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/ai/client";
import { embed, toVectorLiteral } from "@/lib/ai/embeddings";

describe("extractJson", () => {
  it("parses bare JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it("parses JSON with surrounding prose", () => {
    expect(extractJson('Here you go: {"a":3} — done')).toEqual({ a: 3 });
  });
  it("throws on no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("embeddings (local fallback)", () => {
  it("is deterministic and normalized", async () => {
    delete process.env.EMBEDDINGS_API_KEY;
    const a = await embed("starting a tiktok shop");
    const b = await embed("starting a tiktok shop");
    expect(a).toEqual(b);
    expect(a).toHaveLength(1536);
    const mag = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(mag).toBeCloseTo(1, 5);
  });

  it("similar text scores higher than unrelated text", async () => {
    delete process.env.EMBEDDINGS_API_KEY;
    const base = await embed("credit card debt payoff strategy");
    const similar = await embed("strategy to pay off credit card debt");
    const different = await embed("best hiking trails in the mountains");
    const dot = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0);
    expect(dot(base, similar)).toBeGreaterThan(dot(base, different));
  });

  it("toVectorLiteral formats a pgvector literal", () => {
    expect(toVectorLiteral([0.5, -1])).toBe("[0.500000,-1.000000]");
  });
});
