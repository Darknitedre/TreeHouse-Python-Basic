import { PageHeader } from "@/components/ui";
import { ActionItemsManager } from "@/components/action-items-manager";

export const dynamic = "force-dynamic";

export default function ActionItemsPage() {
  return (
    <div>
      <PageHeader
        title="Action Items"
        subtitle="Everything you've decided to act on, in one place."
        action={
          <a href="/api/export?type=action-items&format=csv" className="btn-ghost btn-sm">
            Export CSV
          </a>
        }
      />
      <ActionItemsManager />
    </div>
  );
}
