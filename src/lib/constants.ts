// Shared enums / option lists used across the app and validated against the DB.

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "linkedin",
  "x",
  "youtube",
  "reddit",
  "threads",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const CONTENT_TYPES = [
  "video",
  "image",
  "article",
  "thread",
  "post",
  "carousel",
  "short",
  "reel",
  "podcast",
  "other",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const SOURCE_TYPES = ["url", "text", "screenshot", "transcript", "note"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative", "mixed"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTION_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "canceled",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const PROCESSING_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const DEFAULT_CATEGORIES = [
  "Business",
  "Marketing",
  "Personal Finance",
  "Investing",
  "Career",
  "Leadership",
  "Productivity",
  "Health",
  "Fitness",
  "Relationships",
  "Home",
  "Automotive",
  "Technology",
  "Artificial Intelligence",
  "Motivation",
  "Education",
  "Entertainment",
  "Other",
] as const;

export const STATUS_LABELS: Record<ActionStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
  deferred: "Deferred",
  canceled: "Canceled",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/save", label: "Save Post", icon: "plus" },
  { href: "/library", label: "Library", icon: "book" },
  { href: "/action-items", label: "Action Items", icon: "check" },
  { href: "/collections", label: "Collections", icon: "folder" },
  { href: "/weekly-review", label: "Weekly Review", icon: "calendar" },
  { href: "/settings", label: "Settings", icon: "cog" },
] as const;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
