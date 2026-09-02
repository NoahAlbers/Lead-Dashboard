"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { validateInviteToken, setPasswordWithInvite } from "@/actions/invite.actions";

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function SetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [checking, setChecking] = useState(true);
  const [invite, setInvite] = useState<{ name?: string; email?: string } | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    validateInviteToken(token)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) setInvite({ name: res.name, email: res.email });
        else setError(res.error ?? "This invite link is not valid.");
      })
      .catch(() => {
        if (!cancelled) setError("Could not verify this invite link.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await setPasswordWithInvite(token, password, confirm);
      if (res.success) setDone(true);
      else setError(res.error ?? "Could not set your password.");
    } catch {
      setError("Could not set your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/brand/acb-mark-black.svg" alt="Advanced Collection Bureau" className="h-16 w-16 mb-3" />
          <p className="text-sm font-semibold tracking-wide text-foreground">Advanced Collection Bureau</p>
          <h1 className="text-xl font-bold text-foreground">Set your password</h1>
          {invite?.email && (
            <p className="text-sm text-muted-foreground mt-1">
              {invite.name ? `${invite.name}, ` : ""}you are signing up as {invite.email}
            </p>
          )}
        </div>

        {checking ? (
          <p className="text-sm text-muted-foreground text-center">Checking your invite link...</p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Your password is set. You can sign in now.
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to sign in
            </Link>
          </div>
        ) : !invite ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            <Link href="/login" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="At least 10 characters"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm" className="text-sm font-medium">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Saving..." : "Set password"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Already have a password?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
