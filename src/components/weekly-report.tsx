"use client";

import { useState } from "react";
import { Card } from "./ui";
import { Icon } from "./icons";

interface Report {
  headline?: string;
  top_lessons?: string[];
  themes?: string[];
  wins?: string[];
  focus_next_week?: string[];
  encouragement?: string;
}

export function WeeklyReport({ initial }: { initial: Report | null }) {
  const [report, setReport] = useState<Report | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-review", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate report");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-brand">
            <Icon name="sparkles" width={18} height={18} />
          </span>
          <h2 className="font-semibold">AI knowledge &amp; action report</h2>
        </div>
        <button className="btn-primary btn-sm" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : report ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!report ? (
        <p className="muted text-sm">
          Generate an AI summary of your week — the lessons that mattered and what to focus on next.
        </p>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          {report.headline && <p className="text-base font-medium">{report.headline}</p>}
          <Section title="Top lessons" items={report.top_lessons} />
          <Section title="Themes" items={report.themes} />
          <Section title="Wins" items={report.wins} />
          <Section title="Focus next week" items={report.focus_next_week} />
          {report.encouragement && (
            <p className="rounded-xl bg-surface-2 p-3 italic">{report.encouragement}</p>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h3 className="mb-1 font-medium">{title}</h3>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
