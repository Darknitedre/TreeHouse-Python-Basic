import { describe, it, expect } from "vitest";
import { postToMarkdown, actionItemsToCsv, postsToCsv } from "@/lib/export";
import type { SavedPost, ActionItem } from "@/lib/types";

const post: SavedPost = {
  id: "1",
  user_id: "u",
  source_type: "url",
  original_url: "https://x.com/a",
  platform: "x",
  author: "@creator",
  title: "Title, with comma",
  caption: "raw",
  thumbnail_url: null,
  published_at: null,
  summary: "A summary.",
  main_points: ["one", "two"],
  key_takeaway: "Do the thing.",
  category_id: null,
  content_type: "post",
  priority: "high",
  sentiment: "positive",
  project_area: null,
  reviewed: false,
  archived: false,
  processing_status: "completed",
  processing_error: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

const items: ActionItem[] = [
  {
    id: "a",
    user_id: "u",
    post_id: "1",
    title: 'Task "quoted", with comma',
    description: "desc",
    priority: "high",
    estimated_effort: "15 min",
    due_date: "2026-08-10",
    status: "not_started",
    notes: null,
    completed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
];

describe("postToMarkdown", () => {
  it("includes summary, points, takeaway, action items", () => {
    const md = postToMarkdown(post, items);
    expect(md).toContain("# Title, with comma");
    expect(md).toContain("## Main Points");
    expect(md).toContain("- one");
    expect(md).toContain("> Do the thing.");
    expect(md).toContain("## Action Items");
  });
});

describe("csv escaping", () => {
  it("escapes commas and quotes", () => {
    const csv = actionItemsToCsv(items);
    expect(csv).toContain('"Task ""quoted"", with comma"');
  });
  it("escapes post titles with commas", () => {
    const csv = postsToCsv([post]);
    expect(csv).toContain('"Title, with comma"');
  });
});
