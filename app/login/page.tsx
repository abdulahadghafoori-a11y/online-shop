import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-muted/30 p-6">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
