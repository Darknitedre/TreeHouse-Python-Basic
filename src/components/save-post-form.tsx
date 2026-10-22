"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type SourceType } from "@/lib/constants";
import { Card, cx } from "./ui";
import { Icon } from "./icons";

const TABS: { id: SourceType; label: string }[] = [
  { id: "url", label: "URL" },
  { id: "text", label: "Paste Text" },
  { id: "screenshot", label: "Screenshot" },
  { id: "transcript", label: "Transcript" },
  { id: "note", label: "Note" },
];

export function SavePostForm({ initial }: { initial?: { url?: string; text?: string } }) {
  const router = useRouter();
  const [tab, setTab] = useState<SourceType>(initial?.url ? "url" : "text");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let attachment_path: string | undefined;

      if (tab === "screenshot") {
        if (!file) throw new Error("Choose an image to upload.");
        if (!ALLOWED_IMAGE_TYPES.includes(file.type))
          throw new Error("Unsupported image type.");
        if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image too large (max 8MB).");
        setStatus("Uploading screenshot…");
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Upload failed");
        attachment_path = upJson.path;
      }

      setStatus("Saving and analyzing with AI…");
      const payload: Record<string, unknown> = { source_type: tab, author: author || undefined };
      if (tab === "url") payload.original_url = url.trim();
      else if (tab === "screenshot") payload.attachment_path = attachment_path;
      else payload.text = text;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save post");

      router.push(`/library/${json.post.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
      setStatus(null);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              "btn btn-sm",
              tab === t.id ? "bg-brand text-brand-fg" : "border border-border bg-surface text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {tab === "url" && (
          <div>
            <label className="label" htmlFor="url">
              Post URL
            </label>
            <input
              id="url"
              type="url"
              required
              placeholder="https://www.tiktok.com/@user/video/..."
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="mt-1 text-xs muted">
              We fetch only publicly available metadata. Private posts and logins are never
              bypassed.
            </p>
          </div>
        )}

        {(tab === "text" || tab === "transcript" || tab === "note") && (
          <div>
            <label className="label" htmlFor="text">
              {tab === "transcript" ? "Transcript" : tab === "note" ? "Your notes" : "Content"}
            </label>
            <textarea
              id="text"
              required
              rows={8}
              placeholder="Paste the post text, transcript, or your notes…"
              className="input resize-y"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        {tab === "screenshot" && (
          <div>
            <label className="label" htmlFor="file">
              Screenshot
            </label>
            <input
              id="file"
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs muted">
              We read the visible text from your screenshot with AI vision (max 8MB).
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="author">
            Author / creator (optional)
          </label>
          <input
            id="author"
            type="text"
            className="input"
            placeholder="@creator"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button className="btn-primary" disabled={loading}>
          <Icon name="sparkles" width={16} height={16} />
          {loading ? status ?? "Working…" : "Save & analyze"}
        </button>
        {loading && (
          <p className="text-center text-xs muted">
            AI processing can take a few seconds — hang tight.
          </p>
        )}
      </form>
    </Card>
  );
}
