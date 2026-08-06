"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SavedPost, ActionItem, Category, Tag } from "@/lib/types";
import {
  PRIORITIES,
  CONTENT_TYPES,
  ACTION_STATUSES,
  STATUS_LABELS,
} from "@/lib/constants";
import { Card, PriorityBadge, StatusBadge, Tag as TagChip, cx } from "./ui";
import { Icon } from "./icons";
import { formatDate, isOverdue } from "@/lib/utils";

interface Props {
  post: SavedPost & { category?: Category | null; tags?: Tag[] };
  actionItems: ActionItem[];
  note: string;
  categories: Category[];
  relatedPosts: SavedPost[];
}

export function PostDetail({ post: initial, actionItems: initialItems, note: initialNote, categories, relatedPosts }: Props) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [items, setItems] = useState(initialItems);
  const [note, setNote] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit-mode local fields
  const [form, setForm] = useState({
    title: post.title ?? "",
    summary: post.summary ?? "",
    key_takeaway: post.key_takeaway ?? "",
    main_points: (post.main_points ?? []).join("\n"),
    priority: post.priority,
    content_type: post.content_type ?? "post",
    category_id: post.category_id ?? "",
    tags: (post.tags ?? []).map((t) => t.name).join(", "),
    project_area: post.project_area ?? "",
  });

  async function patchPost(body: Record<string, unknown>, tag?: string) {
    setError(null);
    setBusy(tag ?? "save");
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPost(json.post);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveEdits() {
    const ok = await patchPost({
      title: form.title || null,
      summary: form.summary || null,
      key_takeaway: form.key_takeaway || null,
      main_points: form.main_points.split("\n").map((s) => s.trim()).filter(Boolean),
      priority: form.priority,
      content_type: form.content_type,
      category_id: form.category_id || null,
      project_area: form.project_area || null,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
    });
    if (ok) setEditing(false);
    router.refresh();
  }

  async function reprocess() {
    setBusy("reprocess");
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/reprocess`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.post) setPost(json.post);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reprocess failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm("Delete this post and its action items? This cannot be undone.")) return;
    setBusy("delete");
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/library");
      router.refresh();
    } else {
      setError("Delete failed");
      setBusy(null);
    }
  }

  async function saveNote() {
    setBusy("note");
    await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ post_id: post.id, body: note }),
    });
    setBusy(null);
  }

  async function shareSummary() {
    const text = `${post.title || "Saved post"}\n\n${post.summary ?? ""}\n\nKey takeaway: ${
      post.key_takeaway ?? ""
    }`;
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title ?? "Saved post", text });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    alert("Summary copied to clipboard.");
  }

  async function updateItem(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok) setItems((prev) => prev.map((i) => (i.id === id ? json.actionItem : i)));
  }

  const processing = post.processing_status === "processing" || post.processing_status === "pending";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-surface-2 text-muted capitalize">{post.platform}</span>
          {post.content_type && (
            <span className="badge bg-surface-2 text-muted capitalize">{post.content_type}</span>
          )}
          <PriorityBadge priority={post.priority} />
          {post.reviewed && <span className="badge bg-emerald-500/15 text-emerald-600">Reviewed</span>}
          {post.archived && <span className="badge bg-amber-500/15 text-amber-600">Archived</span>}
          {post.processing_status === "failed" && (
            <span className="badge bg-red-500/15 text-red-600">Processing failed</span>
          )}
        </div>
        {editing ? (
          <input
            className="input text-lg font-semibold"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        ) : (
          <h1 className="text-xl font-semibold sm:text-2xl">{post.title || "Untitled post"}</h1>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm muted">
          {post.author && <span>By {post.author}</span>}
          <span>Saved {formatDate(post.created_at)}</span>
          {post.published_at && <span>Published {formatDate(post.published_at)}</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {post.original_url && (
          <a href={post.original_url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            <Icon name="external" width={15} height={15} /> Open original
          </a>
        )}
        <button className="btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel edit" : "Edit"}
        </button>
        {editing && (
          <button className="btn-primary btn-sm" onClick={saveEdits} disabled={busy === "save"}>
            {busy === "save" ? "Saving…" : "Save changes"}
          </button>
        )}
        <button
          className="btn-ghost btn-sm"
          onClick={() => patchPost({ reviewed: !post.reviewed }, "review")}
          disabled={busy === "review"}
        >
          {post.reviewed ? "Mark unreviewed" : "Mark reviewed"}
        </button>
        <button className="btn-ghost btn-sm" onClick={reprocess} disabled={busy === "reprocess"}>
          <Icon name="sparkles" width={15} height={15} />
          {busy === "reprocess" ? "Reprocessing…" : "Reprocess"}
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={() => patchPost({ archived: !post.archived }, "archive")}
          disabled={busy === "archive"}
        >
          {post.archived ? "Unarchive" : "Archive"}
        </button>
        <button className="btn-ghost btn-sm" onClick={shareSummary}>
          Share summary
        </button>
        <a className="btn-ghost btn-sm" href={`/api/export?type=post&format=md&id=${post.id}`}>
          Export
        </a>
        <button className="btn-ghost btn-sm text-red-500" onClick={remove} disabled={busy === "delete"}>
          <Icon name="trash" width={15} height={15} /> Delete
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {processing && <p className="text-sm text-brand">AI is still analyzing this post…</p>}

      {/* AI content */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card>
            <h2 className="mb-2 font-semibold">Quick summary</h2>
            {editing ? (
              <textarea
                className="input resize-y"
                rows={3}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            ) : (
              <p className="text-sm leading-relaxed">{post.summary || "No summary yet."}</p>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Main points</h2>
            {editing ? (
              <textarea
                className="input resize-y"
                rows={5}
                placeholder="One point per line"
                value={form.main_points}
                onChange={(e) => setForm({ ...form, main_points: e.target.value })}
              />
            ) : post.main_points?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {post.main_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No main points yet.</p>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-brand">
                <Icon name="sparkles" width={16} height={16} />
              </span>
              <h2 className="font-semibold">Key takeaway</h2>
            </div>
            {editing ? (
              <input
                className="input"
                value={form.key_takeaway}
                onChange={(e) => setForm({ ...form, key_takeaway: e.target.value })}
              />
            ) : (
              <p className="text-sm font-medium">{post.key_takeaway || "—"}</p>
            )}
          </Card>

          <ActionItemsPanel
            postId={post.id}
            items={items}
            setItems={setItems}
            onUpdate={updateItem}
          />

          {(post.caption || post.source_type !== "url") && (
            <Card>
              <h2 className="mb-2 font-semibold">Original content</h2>
              <p className="whitespace-pre-wrap text-sm muted">{post.caption || "—"}</p>
            </Card>
          )}
        </div>

        {/* Sidebar: classification, notes, related */}
        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 font-semibold">Classification</h2>
            {editing ? (
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <label className="label">Category</label>
                  <select
                    className="input"
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="input capitalize"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Content type</label>
                  <select
                    className="input capitalize"
                    value={form.content_type}
                    onChange={(e) =>
                      setForm({ ...form, content_type: e.target.value as typeof form.content_type })
                    }
                  >
                    {CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Project / life area</label>
                  <input
                    className="input"
                    value={form.project_area}
                    onChange={(e) => setForm({ ...form, project_area: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Tags (comma-separated)</label>
                  <input
                    className="input"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                <Row label="Category" value={post.category?.name ?? "Uncategorized"} />
                <Row label="Sentiment" value={post.sentiment ?? "—"} />
                <Row label="Project area" value={post.project_area || "—"} />
                <div>
                  <dt className="muted mb-1 text-xs">Tags</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {post.tags?.length ? (
                      post.tags.map((t) => <TagChip key={t.id}>{t.name}</TagChip>)
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-semibold">Personal notes</h2>
            <textarea
              className="input resize-y"
              rows={4}
              placeholder="Your own notes about this post…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button className="btn-primary btn-sm mt-2" onClick={saveNote} disabled={busy === "note"}>
              {busy === "note" ? "Saving…" : "Save note"}
            </button>
          </Card>

          {relatedPosts.length > 0 && (
            <Card>
              <h2 className="mb-2 font-semibold">Related posts</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {relatedPosts.map((r) => (
                  <li key={r.id}>
                    <a href={`/library/${r.id}`} className="line-clamp-1 hover:text-brand">
                      {r.title || r.summary || "Untitled"}
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="muted text-xs">{label}</dt>
      <dd className="text-right capitalize">{value}</dd>
    </div>
  );
}

function ActionItemsPanel({
  postId,
  items,
  setItems,
  onUpdate,
}: {
  postId: string;
  items: ActionItem[];
  setItems: React.Dispatch<React.SetStateAction<ActionItem[]>>;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/action-items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim(), post_id: postId }),
    });
    const json = await res.json();
    if (res.ok) {
      setItems((prev) => [...prev, json.actionItem]);
      setTitle("");
      setAdding(false);
    }
    setSaving(false);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Action items</h2>
        <button className="btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>
          <Icon name="plus" width={14} height={14} /> Add
        </button>
      </div>

      {adding && (
        <div className="mb-3 flex gap-2">
          <input
            className="input"
            placeholder="Specific, achievable task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <button className="btn-primary btn-sm" onClick={add} disabled={saving}>
            Add
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="muted text-sm">No action items yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
                checked={item.status === "completed"}
                onChange={(e) =>
                  onUpdate(item.id, { status: e.target.checked ? "completed" : "not_started" })
                }
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cx(
                    "font-medium",
                    item.status === "completed" && "text-muted line-through",
                  )}
                >
                  {item.title}
                </p>
                {item.description && <p className="mt-0.5 text-sm muted">{item.description}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                  {item.estimated_effort && <span className="muted">{item.estimated_effort}</span>}
                  {item.due_date && (
                    <span className={isOverdue(item.due_date, item.status) ? "text-red-500" : "muted"}>
                      Due {item.due_date}
                    </span>
                  )}
                </div>
              </div>
              <select
                className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                value={item.status}
                onChange={(e) => onUpdate(item.id, { status: e.target.value })}
              >
                {ACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
