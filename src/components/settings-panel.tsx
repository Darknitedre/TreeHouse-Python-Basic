"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "./ui";

interface Prefs {
  due_items: boolean;
  overdue_items: boolean;
  weekly_review: boolean;
  unreviewed_posts: boolean;
  unacted_high_priority: boolean;
}

const PREF_LABELS: Record<keyof Prefs, string> = {
  due_items: "Action items due soon",
  overdue_items: "Overdue action items",
  weekly_review: "Weekly review reminder",
  unreviewed_posts: "Saved posts not yet reviewed",
  unacted_high_priority: "High-priority ideas not acted on",
};

export function SettingsPanel({ email }: { email: string }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => j.preferences && setPrefs(j.preferences));
  }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    setSaving(false);
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and ALL data? This cannot be undone.")) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (res.ok) {
      await fetch("/auth/signout", { method: "POST" });
      router.push("/login");
    } else {
      alert("Account deletion failed.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h2 className="mb-1 font-semibold">Account</h2>
        <p className="text-sm muted">{email}</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Notifications</h2>
        <p className="mb-3 text-sm muted">
          Choose which reminders you want. (Delivery is configured at deploy time via a scheduled
          job.)
        </p>
        {!prefs ? (
          <p className="muted text-sm">Loading…</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {(Object.keys(PREF_LABELS) as (keyof Prefs)[]).map((key) => (
              <li key={key} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{PREF_LABELS[key]}</span>
                <button
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => toggle(key)}
                  disabled={saving}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    prefs[key] ? "bg-brand" : "bg-surface-2"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      prefs[key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Export your data</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost btn-sm" href="/api/export?type=all&format=json">
            All data (JSON)
          </a>
          <a className="btn-ghost btn-sm" href="/api/export?type=posts&format=csv">
            Posts (CSV)
          </a>
          <a className="btn-ghost btn-sm" href="/api/export?type=posts&format=md">
            Posts (Markdown)
          </a>
          <a className="btn-ghost btn-sm" href="/api/export?type=action-items&format=csv">
            Action items (CSV)
          </a>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-red-500">Danger zone</h2>
        <p className="mb-3 text-sm muted">
          Permanently delete your account and everything in it.
        </p>
        <button className="btn btn-sm border border-red-500/40 text-red-500" onClick={deleteAccount}>
          Delete account
        </button>
      </Card>
    </div>
  );
}
