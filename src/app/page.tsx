import Link from "next/link";
import { Icon } from "@/components/icons";

// Middleware redirects signed-in users to /dashboard and signed-out users on
// protected routes to /login. This landing renders for signed-out visitors.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="text-brand">
        <Icon name="sparkles" width={40} height={40} />
      </span>
      <h1 className="text-3xl font-bold sm:text-4xl">Social Action Vault</h1>
      <p className="muted max-w-md text-lg">
        Stop hoarding saved posts. Save anything from Instagram, TikTok, X, YouTube and more —
        and turn it into summaries, lessons, and concrete action items you actually follow
        through on.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn-primary">
          Get started
        </Link>
        <Link href="/login" className="btn-ghost">
          Sign in
        </Link>
      </div>
    </main>
  );
}
