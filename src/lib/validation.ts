import { z } from "zod";
import {
  PLATFORMS,
  CONTENT_TYPES,
  SOURCE_TYPES,
  SENTIMENTS,
  PRIORITIES,
  ACTION_STATUSES,
} from "./constants";

// ---------------------------------------------------------------------
// AI output contract. The model must return JSON matching this schema.
// Coercions keep a slightly-off response usable instead of failing hard.
// ---------------------------------------------------------------------
export const AiActionItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  priority: z.enum(PRIORITIES).catch("medium"),
  estimated_effort: z.string().max(100).default(""),
  suggested_due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null)
    .default(null),
});

export const PostAnalysisSchema = z.object({
  title: z.string().max(300).default(""),
  // Only populated for screenshot/image sources: the visible text the model read.
  extracted_text: z.string().max(50000).optional(),
  summary: z.string().min(1).max(2000),
  main_points: z.array(z.string().min(1)).max(15).default([]),
  key_takeaway: z.string().max(600).default(""),
  category: z.string().max(60).default("Other"),
  tags: z.array(z.string().min(1).max(40)).max(15).default([]),
  sentiment: z.enum(SENTIMENTS).catch("neutral"),
  priority: z.enum(PRIORITIES).catch("medium"),
  content_type: z.enum(CONTENT_TYPES).catch("post"),
  project_area: z.string().max(120).default(""),
  action_items: z.array(AiActionItemSchema).min(1).max(5),
});

export type PostAnalysis = z.infer<typeof PostAnalysisSchema>;
export type AiActionItem = z.infer<typeof AiActionItemSchema>;

// ---------------------------------------------------------------------
// API request schemas
// ---------------------------------------------------------------------
export const CreatePostSchema = z
  .object({
    source_type: z.enum(SOURCE_TYPES),
    original_url: z.string().url().optional(),
    platform: z.enum(PLATFORMS).optional(),
    text: z.string().max(50000).optional(),
    attachment_path: z.string().max(500).optional(), // storage path of an uploaded screenshot
    author: z.string().max(200).optional(),
    title: z.string().max(300).optional(),
  })
  .refine(
    (v) =>
      v.source_type === "url"
        ? !!v.original_url
        : v.source_type === "screenshot"
          ? !!v.attachment_path
          : !!v.text && v.text.trim().length > 0,
    { message: "Provide the content for the selected source type." },
  );
export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  title: z.string().max(300).nullable().optional(),
  author: z.string().max(200).nullable().optional(),
  caption: z.string().max(50000).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  key_takeaway: z.string().max(600).nullable().optional(),
  main_points: z.array(z.string()).max(30).optional(),
  category_id: z.string().uuid().nullable().optional(),
  content_type: z.enum(CONTENT_TYPES).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  sentiment: z.enum(SENTIMENTS).nullable().optional(),
  project_area: z.string().max(120).nullable().optional(),
  platform: z.enum(PLATFORMS).optional(),
  reviewed: z.boolean().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
});
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

export const CreateActionItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  estimated_effort: z.string().max(100).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(ACTION_STATUSES).default("not_started"),
  post_id: z.string().uuid().nullable().optional(),
  post_ids: z.array(z.string().uuid()).max(50).optional(),
});
export type CreateActionItemInput = z.infer<typeof CreateActionItemSchema>;

export const UpdateActionItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimated_effort: z.string().max(100).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(ACTION_STATUSES).optional(),
  notes: z.string().max(4000).nullable().optional(),
  post_ids: z.array(z.string().uuid()).max(50).optional(),
});
export type UpdateActionItemInput = z.infer<typeof UpdateActionItemSchema>;

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const SearchSchema = z.object({
  q: z.string().max(500).default(""),
  mode: z.enum(["keyword", "semantic", "hybrid"]).default("hybrid"),
  category_id: z.string().uuid().optional(),
  status: z.enum(ACTION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
