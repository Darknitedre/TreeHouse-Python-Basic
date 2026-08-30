"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ActionItem } from "@/lib/types";
import {
  ACTION_STATUSES,
  PRIORITIES,
  STATUS_LABELS,
} from "@/lib/constants";
import { Card, PriorityBadge, StatusBadge, EmptyState, cx } from "./ui";
import { isOverdue } from "@/lib/utils";

type ItemWithPost = ActionItem & { post?: { id: string; title: string | null } | null };

export function ActionItemsManager() {
  const [items, setItems] = useState<ItemWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [sort, setSort] = useState("importance");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (due) params.set("due", due);
    params.set("sort", sort);
    const res = await fetch(`/api/action-items?${params.toString()}`);
    const json = await res.json();
    setItems(json.actionItems ?? []);
    setLoading(false);
  }, [status, priority, due, sort]);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/action-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok) {
      // Re-run the query so filters/sort stay consistent after the change.
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...json.actionItem } : i)));
      if (status || due) load();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this action item?")) return;
    const res = await fetch(`/api/action-items/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input max-w-[10rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input max-w-[9rem]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
        <select className="input max-w-[9rem]" value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due this week</option>
        </select>
        <select className="input max-w-[10rem]" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="importance">Sort: importance</option>
          <option value="due">Sort: due date</option>
        </select>
      </div>

      {loading ? (
        <p className="muted text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No action items"
          hint="Save a post — the AI generates concrete tasks automatically."
          action={
            <Link href="/save" className="btn-primary btn-sm mt-1">
              Save a post
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]"
                checked={item.status === "completed"}
                onChange={(e) =>
                  update(item.id, { status: e.target.checked ? "completed" : "not_started" })
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                  {item.estimated_effort && <span className="muted">{item.estimated_effort}</span>}
                  {item.post?.id && (
                    <Link href={`/library/${item.post.id}`} className="text-brand">
                      From post →
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <input
                  type="date"
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  value={item.due_date ?? ""}
                  onChange={(e) => update(item.id, { due_date: e.target.value || null })}
                />
                {item.due_date && isOverdue(item.due_date, item.status) && (
                  <span className="text-xs text-red-500">Overdue</span>
                )}
                <select
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  value={item.status}
                  onChange={(e) => update(item.id, { status: e.target.value })}
                >
                  {ACTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button className="text-xs text-red-500" onClick={() => remove(item.id)}>
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
