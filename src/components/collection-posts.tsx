"use client";

import { useState } from "react";
import type { SavedPost } from "@/lib/types";
import { PostCard } from "./post-card";
import { EmptyState } from "./ui";

export function CollectionPosts({
  collectionId,
  initialPosts,
  allPosts,
}: {
  collectionId: string;
  initialPosts: SavedPost[];
  allPosts: { id: string; title: string | null }[];
}) {
  const [posts, setPosts] = useState<SavedPost[]>(initialPosts);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  const inCollection = new Set(posts.map((p) => p.id));
  const options = allPosts.filter((p) => !inCollection.has(p.id));

  async function add() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/collections/${collectionId}/posts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ post_id: selected }),
    });
    if (res.ok) {
      const added = allPosts.find((p) => p.id === selected);
      // Refetch the single post for full card data.
      const detail = await fetch(`/api/posts/${selected}`).then((r) => r.json());
      if (detail.post) setPosts((prev) => [detail.post, ...prev]);
      else if (added) setPosts((prev) => [{ id: added.id, title: added.title } as SavedPost, ...prev]);
      setSelected("");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/collections/${collectionId}/posts?post_id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      <div className="mb-5 flex gap-2">
        <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Add a saved post…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title || "Untitled"}
            </option>
          ))}
        </select>
        <button className="btn-primary btn-sm" onClick={add} disabled={busy || !selected}>
          Add
        </button>
      </div>

      {posts.length === 0 ? (
        <EmptyState title="Empty collection" hint="Add saved posts using the picker above." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <div key={p.id} className="relative">
              <PostCard post={p} />
              <button
                onClick={() => remove(p.id)}
                className="absolute right-2 top-2 rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
