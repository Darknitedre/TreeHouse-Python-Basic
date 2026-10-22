import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CollectionPosts } from "@/components/collection-posts";
import type { SavedPost } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CollectionDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!collection) notFound();

  const [{ data: links }, { data: all }] = await Promise.all([
    supabase
      .from("collection_posts")
      .select("post:saved_posts(*)")
      .eq("collection_id", params.id)
      .eq("user_id", user.id)
      .order("added_at", { ascending: false }),
    supabase
      .from("saved_posts")
      .select("id,title")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const posts = (links ?? []).map((l) => l.post).filter(Boolean) as unknown as SavedPost[];

  return (
    <div>
      <Link href="/collections" className="mb-3 inline-block text-sm text-brand">
        ← All collections
      </Link>
      <PageHeader title={collection.name} subtitle={collection.description ?? undefined} />
      <CollectionPosts
        collectionId={params.id}
        initialPosts={posts}
        allPosts={(all ?? []) as { id: string; title: string | null }[]}
      />
    </div>
  );
}
