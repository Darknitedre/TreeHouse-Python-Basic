-- =====================================================================
-- Seed default categories per new user + Storage bucket for screenshots.
-- =====================================================================

create or replace function seed_default_categories(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cat text;
  cats text[] := array[
    'Business','Marketing','Personal Finance','Investing','Career','Leadership',
    'Productivity','Health','Fitness','Relationships','Home','Automotive',
    'Technology','Artificial Intelligence','Motivation','Education',
    'Entertainment','Other'
  ];
begin
  foreach cat in array cats loop
    insert into public.categories (user_id, name, slug, is_default)
    values (
      p_user_id,
      cat,
      regexp_replace(lower(cat), '[^a-z0-9]+', '-', 'g'),
      true
    )
    on conflict (user_id, slug) do nothing;
  end loop;
end $$;

-- Extend the new-user handler to also seed categories.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id)
    on conflict (user_id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Storage: private per-user bucket for screenshots / uploads.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-uploads', 'post-uploads', false)
on conflict (id) do nothing;

-- Files are stored under `<user_id>/<...>`; users may only touch their prefix.
create policy "uploads_read_own"
  on storage.objects for select
  using (bucket_id = 'post-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'post-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "uploads_delete_own"
  on storage.objects for delete
  using (bucket_id = 'post-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
