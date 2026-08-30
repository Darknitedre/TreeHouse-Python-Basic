"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { PRIORITIES } from "@/lib/constants";
import type { Category } from "@/lib/types";
import { cx } from "./ui";

export function LibraryControls({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", q.trim() || null);
  }

  const current = (key: string) => params.get(key) ?? "";

  return (
    <div className="mb-5 flex flex-col gap-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          className="input"
          placeholder="Search your saved posts (keyword + meaning)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-primary btn-sm">Search</button>
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          className="input max-w-[12rem]"
          value={current("category_id")}
          onChange={(e) => setParam("category_id", e.target.value || null)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="input max-w-[10rem]"
          value={current("priority")}
          onChange={(e) => setParam("priority", e.target.value || null)}
        >
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setParam("reviewed", current("reviewed") === "false" ? null : "false")}
          className={cx(
            "btn btn-sm border border-border",
            current("reviewed") === "false" ? "bg-brand text-brand-fg" : "bg-surface text-text",
          )}
        >
          Unreviewed only
        </button>

        <button
          type="button"
          onClick={() => setParam("archived", current("archived") === "true" ? null : "true")}
          className={cx(
            "btn btn-sm border border-border",
            current("archived") === "true" ? "bg-brand text-brand-fg" : "bg-surface text-text",
          )}
        >
          {current("archived") === "true" ? "Showing archived" : "Show archived"}
        </button>
      </div>
    </div>
  );
}
