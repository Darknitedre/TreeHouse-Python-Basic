import type { SavedPost, ActionItem } from "./types";
import { formatDate } from "./utils";
import { STATUS_LABELS, PRIORITY_LABELS, type ActionStatus, type Priority } from "./constants";

export function postToMarkdown(post: SavedPost, actionItems: ActionItem[] = []): string {
  const lines: string[] = [];
  lines.push(`# ${post.title || "Saved Post"}`);
  lines.push("");
  if (post.author) lines.push(`**Author:** ${post.author}`);
  lines.push(`**Platform:** ${post.platform}`);
  if (post.original_url) lines.push(`**Original:** ${post.original_url}`);
  lines.push(`**Saved:** ${formatDate(post.created_at)}`);
  lines.push("");
  if (post.summary) {
    lines.push("## Summary");
    lines.push(post.summary);
    lines.push("");
  }
  if (post.main_points?.length) {
    lines.push("## Main Points");
    post.main_points.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
  }
  if (post.key_takeaway) {
    lines.push("## Key Takeaway");
    lines.push(`> ${post.key_takeaway}`);
    lines.push("");
  }
  if (actionItems.length) {
    lines.push("## Action Items");
    actionItems.forEach((a) => {
      const due = a.due_date ? ` (due ${a.due_date})` : "";
      lines.push(`- [${a.status === "completed" ? "x" : " "}] **${a.title}**${due}`);
      if (a.description) lines.push(`  - ${a.description}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

export function postToText(post: SavedPost, actionItems: ActionItem[] = []): string {
  return postToMarkdown(post, actionItems)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^>\s*/gm, "");
}

export function actionItemsToCsv(items: ActionItem[]): string {
  const header = ["title", "description", "priority", "status", "due_date", "estimated_effort"];
  const rows = items.map((i) =>
    [
      i.title,
      i.description ?? "",
      PRIORITY_LABELS[i.priority as Priority] ?? i.priority,
      STATUS_LABELS[i.status as ActionStatus] ?? i.status,
      i.due_date ?? "",
      i.estimated_effort ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function postsToCsv(posts: SavedPost[]): string {
  const header = ["title", "author", "platform", "category_id", "priority", "summary", "url", "saved"];
  const rows = posts.map((p) =>
    [
      p.title ?? "",
      p.author ?? "",
      p.platform,
      p.category_id ?? "",
      p.priority,
      p.summary ?? "",
      p.original_url ?? "",
      p.created_at,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string): string {
  const v = String(value ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
