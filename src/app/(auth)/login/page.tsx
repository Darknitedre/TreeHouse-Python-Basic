import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center muted">Loading…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
