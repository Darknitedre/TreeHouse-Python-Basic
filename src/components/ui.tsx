import * as React from "react";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type ActionStatus,
} from "@/lib/constants";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx("card", className)}>{children}</div>;
}

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs muted">{label}</span>
      <span className={cx("text-2xl font-semibold", accent && "text-brand")}>{value}</span>
    </div>
  );
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "bg-red-500/15 text-red-600 dark:text-red-300",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cx("badge", PRIORITY_COLORS[priority] ?? "bg-surface-2")}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

const STATUS_COLORS: Record<ActionStatus, string> = {
  not_started: "bg-surface-2 text-muted",
  in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  deferred: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  canceled: "bg-red-500/10 text-red-500",
};

export function StatusBadge({ status }: { status: ActionStatus }) {
  return (
    <span className={cx("badge", STATUS_COLORS[status] ?? "bg-surface-2")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="badge bg-surface-2 text-muted">#{children}</span>;
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="muted text-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {subtitle && <p className="muted mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
