-- =====================================================================
-- Social Action Vault — initial schema
-- Postgres (Supabase) with RLS, pgvector, and full-text search.
-- Every user-owned table is isolated by `user_id = auth.uid()`.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type platform as enum (
    'instagram','tiktok','facebook','linkedin','x','youtube','reddit','threads','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_type as enum (
    'video','image','article','thread','post','carousel','short','reel','podcast','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type source_type as enum ('url','text','screenshot','transcript','note');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sentiment as enum ('positive','neutral','negative','mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type priority_level as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type action_status as enum (
    'not_started','in_progress','completed','deferred','canceled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type processing_status as enum ('pending','processing','completed','failed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- users (app profile; 1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- Auto-provision a profile row + default categories/notification prefs
-- whenever a new auth user signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- categories (seeded defaults + user custom)
-- ---------------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

-- ---------------------------------------------------------------------
-- saved_posts (the core entity)
-- ---------------------------------------------------------------------
create table if not exists saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  -- Origin
  source_type source_type not null,
  original_url text,
  platform platform not null default 'other',
  author text,
  title text,
  caption text,               -- original caption / pasted text / transcript / OCR text
  thumbnail_url text,
  published_at timestamptz,

  -- AI-generated (editable)
  summary text,
  main_points jsonb not null default '[]'::jsonb,
  key_takeaway text,
  category_id uuid references categories(id) on delete set null,
  content_type content_type,
  priority priority_level not null default 'medium',
  sentiment sentiment,
  project_area text,

  -- Organisational / lifecycle
  reviewed boolean not null default false,
  archived boolean not null default false,
  processing_status processing_status not null default 'pending',
  processing_error text,

  -- Search
  search_vector tsvector,
  embedding vector(1536),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_saved_posts_updated before update on saved_posts
  for each row execute function set_updated_at();

create index if not exists idx_saved_posts_user on saved_posts(user_id);
create index if not exists idx_saved_posts_user_created on saved_posts(user_id, created_at desc);
create index if not exists idx_saved_posts_category on saved_posts(category_id);
create index if not exists idx_saved_posts_search on saved_posts using gin(search_vector);
create index if not exists idx_saved_posts_embedding
  on saved_posts using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Keep the full-text vector in sync from the text-bearing columns.
create or replace function saved_posts_search_refresh()
returns trigger language plpgsql as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.key_takeaway,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.author,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.summary,'')), 'B') ||
    setweight(to_tsvector('english',
      coalesce((select string_agg(value, ' ')
                from jsonb_array_elements_text(new.main_points)), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.caption,'')), 'D') ||
    setweight(to_tsvector('english', coalesce(new.project_area,'')), 'D');
  return new;
end $$;
create trigger trg_saved_posts_search before insert or update on saved_posts
  for each row execute function saved_posts_search_refresh();

-- ---------------------------------------------------------------------
-- post_sources (raw capture provenance; 1:N with a post)
-- ---------------------------------------------------------------------
create table if not exists post_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references saved_posts(id) on delete cascade,
  source_type source_type not null,
  raw_url text,
  raw_text text,
  fetched_metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_post_sources_post on post_sources(post_id);

-- ---------------------------------------------------------------------
-- post_summaries (AI run history; the latest is mirrored onto saved_posts)
-- ---------------------------------------------------------------------
create table if not exists post_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references saved_posts(id) on delete cascade,
  model text,
  summary text,
  main_points jsonb not null default '[]'::jsonb,
  key_takeaway text,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_post_summaries_post on post_summaries(post_id);

-- ---------------------------------------------------------------------
-- tags + post_tags (many-to-many)
-- ---------------------------------------------------------------------
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists post_tags (
  post_id uuid not null references saved_posts(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (post_id, tag_id)
);
create index if not exists idx_post_tags_tag on post_tags(tag_id);

-- ---------------------------------------------------------------------
-- action_items
-- ---------------------------------------------------------------------
create table if not exists action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid references saved_posts(id) on delete set null, -- primary source
  title text not null,
  description text,
  priority priority_level not null default 'medium',
  estimated_effort text,
  due_date date,
  status action_status not null default 'not_started',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_action_items_updated before update on action_items
  for each row execute function set_updated_at();
create index if not exists idx_action_items_user on action_items(user_id);
create index if not exists idx_action_items_status on action_items(user_id, status);
create index if not exists idx_action_items_due on action_items(user_id, due_date);

-- An action item may reference multiple saved posts (spec requirement).
create table if not exists action_item_posts (
  action_item_id uuid not null references action_items(id) on delete cascade,
  post_id uuid not null references saved_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (action_item_id, post_id)
);

-- ---------------------------------------------------------------------
-- collections + collection_posts (many-to-many)
-- ---------------------------------------------------------------------
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_collections_updated before update on collections
  for each row execute function set_updated_at();

create table if not exists collection_posts (
  collection_id uuid not null references collections(id) on delete cascade,
  post_id uuid not null references saved_posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);
create index if not exists idx_collection_posts_post on collection_posts(post_id);

-- ---------------------------------------------------------------------
-- personal_notes (free-form, attached to a post)
-- ---------------------------------------------------------------------
create table if not exists personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references saved_posts(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_personal_notes_updated before update on personal_notes
  for each row execute function set_updated_at();
create index if not exists idx_personal_notes_post on personal_notes(post_id);

-- ---------------------------------------------------------------------
-- attachments (uploaded screenshots / files in Supabase Storage)
-- ---------------------------------------------------------------------
create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid references saved_posts(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_attachments_post on attachments(post_id);

-- ---------------------------------------------------------------------
-- weekly_reviews
-- ---------------------------------------------------------------------
create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  report jsonb,            -- AI-generated knowledge-and-action report
  stats jsonb,             -- computed counts
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ---------------------------------------------------------------------
-- notification_preferences (1:1 with user)
-- ---------------------------------------------------------------------
create table if not exists notification_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  due_items boolean not null default true,
  overdue_items boolean not null default true,
  weekly_review boolean not null default true,
  unreviewed_posts boolean not null default false,
  unacted_high_priority boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger trg_notification_prefs_updated before update on notification_preferences
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- processing_jobs (audit/queue for AI runs)
-- ---------------------------------------------------------------------
create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid references saved_posts(id) on delete cascade,
  job_type text not null,             -- 'analyze' | 'reprocess' | 'weekly_report' | 'embed'
  status processing_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_processing_jobs_post on processing_jobs(post_id);

-- =====================================================================
-- Row-Level Security — enable + owner-only policies on every table
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','categories','saved_posts','post_sources','post_summaries',
    'tags','post_tags','action_items','action_item_posts','collections',
    'collection_posts','personal_notes','attachments','weekly_reviews',
    'notification_preferences','processing_jobs'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- `users` keys on id; everything else keys on user_id.
create policy users_select on users for select using (id = auth.uid());
create policy users_modify on users for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'categories','saved_posts','post_sources','post_summaries',
    'tags','post_tags','action_items','action_item_posts','collections',
    'collection_posts','personal_notes','attachments','weekly_reviews',
    'notification_preferences','processing_jobs'
  ] loop
    execute format(
      'create policy %1$s_owner on %1$s for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t);
  end loop;
end $$;

-- =====================================================================
-- Semantic search RPC (cosine similarity, RLS-scoped by user_id filter)
-- =====================================================================
create or replace function match_saved_posts(
  p_user_id uuid,
  query_embedding vector(1536),
  match_count int default 10
)
returns table (id uuid, similarity float)
language sql stable as $$
  select sp.id, 1 - (sp.embedding <=> query_embedding) as similarity
  from saved_posts sp
  where sp.user_id = p_user_id
    and sp.embedding is not null
    and sp.archived = false
  order by sp.embedding <=> query_embedding
  limit match_count;
$$;
