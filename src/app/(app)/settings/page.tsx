import { PageHeader } from "@/components/ui";
import { SettingsPanel } from "@/components/settings-panel";
import { getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Preferences, export, and account." />
      <SettingsPanel email={user?.email ?? ""} />
    </div>
  );
}
