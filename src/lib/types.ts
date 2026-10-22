import type {
  Platform,
  ContentType,
  SourceType,
  Sentiment,
  Priority,
  ActionStatus,
  ProcessingStatus,
} from "./constants";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  is_default: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  slug: string;
}

export interface SavedPost {
  id: string;
  user_id: string;
  source_type: SourceType;
  original_url: string | null;
  platform: Platform;
  author: string | null;
  title: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  summary: string | null;
  main_points: string[];
  key_takeaway: string | null;
  category_id: string | null;
  content_type: ContentType | null;
  priority: Priority;
  sentiment: Sentiment | null;
  project_area: string | null;
  reviewed: boolean;
  archived: boolean;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedPostWithRelations extends SavedPost {
  category?: Category | null;
  tags?: Tag[];
}

export interface ActionItem {
  id: string;
  user_id: string;
  post_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  estimated_effort: string | null;
  due_date: string | null;
  status: ActionStatus;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  post_count?: number;
}

export interface DashboardStats {
  totalPosts: number;
  postsThisWeek: number;
  openActionItems: number;
  overdueActionItems: number;
  completedActionItems: number;
  unreviewedPosts: number;
  topCategories: { name: string; count: number }[];
  recentPosts: SavedPost[];
  highPriorityPosts: SavedPost[];
  knowledgeIntoAction: ActionItem[];
}
