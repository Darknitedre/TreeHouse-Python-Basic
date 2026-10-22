import { PageHeader } from "@/components/ui";
import { CollectionsManager } from "@/components/collections-manager";

export const dynamic = "force-dynamic";

export default function CollectionsPage() {
  return (
    <div>
      <PageHeader title="Collections" subtitle="Group saved posts into custom lists." />
      <CollectionsManager />
    </div>
  );
}
