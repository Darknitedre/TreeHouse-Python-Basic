import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center muted">Loading…</div>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
