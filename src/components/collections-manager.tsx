"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/types";
import { Card, EmptyState } from "./ui";
import { Icon } from "./icons";

export function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/collections");
    const json = await res.json();
    setCollections(json.collections ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setName("");
      await load();
    }
    setCreating(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this collection? Saved posts are not deleted.")) return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (res.ok) setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div>
      <form onSubmit={create} className="mb-5 flex gap-2">
        <input
          className="input"
          placeholder="New collection (e.g. Business Ideas, Money Strategies)…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary btn-sm" disabled={creating}>
          <Icon name="plus" width={15} height={15} /> Create
        </button>
      </form>

      {loading ? (
        <p className="muted text-sm">Loading…</p>
      ) : collections.length === 0 ? (
        <EmptyState title="No collections yet" hint="Group related posts into custom collections." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Card key={c.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <Link href={`/collections/${c.id}`} className="font-medium hover:text-brand">
                  {c.name}
                </Link>
                <button className="text-xs text-red-500" onClick={() => remove(c.id)}>
                  Delete
                </button>
              </div>
              {c.description && <p className="text-sm muted">{c.description}</p>}
              <span className="mt-auto text-xs muted">{c.post_count ?? 0} posts</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
