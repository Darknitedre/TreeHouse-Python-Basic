import { Sidebar, BottomNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSessionUser } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-brand">
              <Icon name="sparkles" width={18} height={18} />
            </span>
            <span className="text-sm font-semibold">Social Action Vault</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm muted sm:inline">{user?.email}</span>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button className="btn-ghost btn-sm" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
