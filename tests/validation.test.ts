import { describe, it, expect } from "vitest";
import { PostAnalysisSchema, CreatePostSchema } from "@/lib/validation";

const validAnalysis = {
  title: "How to start a TikTok Shop",
  summary: "A short guide to launching a TikTok shop with minimal upfront cost.",
  main_points: ["Pick a niche", "Set up the shop", "Post daily"],
  key_takeaway: "Consistency beats perfection.",
  category: "Business",
  tags: ["ecommerce", "tiktok"],
  sentiment: "positive",
  priority: "high",
  content_type: "video",
  project_area: "Side business",
  action_items: [
    {
      title: "Register a TikTok Shop seller account",
      description: "Complete verification with a business email.",
      priority: "high",
      estimated_effort: "30 min",
      suggested_due_date: "2026-08-10",
    },
  ],
};

describe("PostAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    const r = PostAnalysisSchema.safeParse(validAnalysis);
    expect(r.success).toBe(true);
  });

  it("coerces unknown enum values to safe defaults", () => {
    const r = PostAnalysisSchema.safeParse({
      ...validAnalysis,
      sentiment: "ecstatic",
      priority: "critical",
      content_type: "meme",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sentiment).toBe("neutral");
      expect(r.data.priority).toBe("medium");
      expect(r.data.content_type).toBe("post");
    }
  });

  it("requires at least one action item", () => {
    const r = PostAnalysisSchema.safeParse({ ...validAnalysis, action_items: [] });
    expect(r.success).toBe(false);
  });

  it("requires a summary", () => {
    const { summary, ...withoutSummary } = validAnalysis;
    void summary;
    const r = PostAnalysisSchema.safeParse(withoutSummary);
    expect(r.success).toBe(false);
  });

  it("nulls an invalid suggested_due_date instead of failing", () => {
    const r = PostAnalysisSchema.safeParse({
      ...validAnalysis,
      action_items: [{ ...validAnalysis.action_items[0], suggested_due_date: "next week" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.action_items[0].suggested_due_date).toBeNull();
  });
});

describe("CreatePostSchema", () => {
  it("requires a url for url source", () => {
    expect(CreatePostSchema.safeParse({ source_type: "url" }).success).toBe(false);
    expect(
      CreatePostSchema.safeParse({ source_type: "url", original_url: "https://x.com/a" }).success,
    ).toBe(true);
  });
  it("requires text for text source", () => {
    expect(CreatePostSchema.safeParse({ source_type: "text" }).success).toBe(false);
    expect(CreatePostSchema.safeParse({ source_type: "text", text: "hi" }).success).toBe(true);
  });
  it("requires an attachment for screenshot source", () => {
    expect(CreatePostSchema.safeParse({ source_type: "screenshot" }).success).toBe(false);
    expect(
      CreatePostSchema.safeParse({ source_type: "screenshot", attachment_path: "u/x.png" }).success,
    ).toBe(true);
  });
});
