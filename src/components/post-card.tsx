import Link from "next/link";
import type { SavedPost } from "@/lib/types";
import { PriorityBadge, cx } from "./ui";
import { formatDate, truncate } from "@/lib/utils";

export function PostCard({ post }: { post: SavedPost }) {
  const processing = post.processing_status === "pending" || post.processing_status === "processing";
  const failed = post.processing_status === "failed";
  return (
    <Link
      href={`/library/${post.id}`}
      className="card flex flex-col gap-2 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="badge bg-surface-2 text-muted capitalize">{post.platform}</span>
        <div className="flex items-center gap-1.5">
          {!post.reviewed && (
            <span className="badge bg-brand/10 text-brand">New</span>
          )}
          <PriorityBadge priority={post.priority} />
        </div>
      </div>

      <h3 className="line-clamp-2 font-medium leading-snug">
        {post.title || truncate(post.caption || "Untitled post", 80)}
      </h3>

      {processing ? (
        <p className="text-sm text-brand">Analyzing with AI…</p>
      ) : failed ? (
        <p className="text-sm text-red-500">Processing failed — open to retry.</p>
      ) : (
        <p className="line-clamp-3 text-sm muted">
          {post.summary || truncate(post.caption || "", 160)}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between pt-1 text-xs muted">
        <span>{post.author || "Unknown"}</span>
        <span>{formatDate(post.created_at)}</span>
      </div>
    </Link>
  );
}

export function PostCardGrid({ posts }: { posts: SavedPost[] }) {
  return (
    <div className={cx("grid gap-3 sm:grid-cols-2 lg:grid-cols-3")}>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
