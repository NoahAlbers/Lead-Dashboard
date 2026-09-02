"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, FileSignature, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createOnboardingProfile, type MgmtType } from "@/actions/onboarding.actions";
import { OPEN_ONBOARDING_EMAIL_EVENT } from "@/components/leads/onboarding-panel";
import { toast } from "@/components/ui/use-toast";

interface OnboardingDialogProps {
  logoUrl?: string | null;
  logoDomain?: string | null;
  open: boolean;
  onClose: () => void;
  leadId: string;
  prefill: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    mgmtType: MgmtType;
  };
  /** An existing portal link, when a profile was already created. */
  existingPortalUrl?: string | null;
}

const inputCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

export function OnboardingDialog({ open, onClose, leadId, prefill, existingPortalUrl, logoUrl = null, logoDomain = null }: OnboardingDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState(prefill);
  const [result, setResult] = useState<{ portalUrl: string; emailed: boolean } | null>(null);
  const [showExisting, setShowExisting] = useState(!!existingPortalUrl);
  const [copied, setCopied] = useState(false);
  const [sendLogo, setSendLogo] = useState(!!logoUrl);
  const [logoBroken, setLogoBroken] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function create(sendEmail: boolean) {
    startTransition(async () => {
      const res = await createOnboardingProfile(leadId, { ...form, sendEmail, logoUrl: sendLogo && logoUrl && !logoBroken ? logoUrl : null });
      if (res.success && res.portalUrl) {
        setResult({ portalUrl: res.portalUrl, emailed: !!res.emailed });
        toast({
          title: sendEmail ? `Portal created and emailed to ${form.email}` : "Portal created. No email was sent.",
          variant: "success",
        });
        router.refresh();
      } else {
        toast({ title: res.error ?? "Could not create the onboarding portal", variant: "destructive" });
      }
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  const emailOk = /\S+@\S+\.\S+/.test(form.email.trim());
  const shownUrl = result?.portalUrl ?? (showExisting ? existingPortalUrl ?? null : null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending) onClose(); }}>
      <DialogContent size="lg" closeDisabled={isPending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-blue-500" />
            {shownUrl ? "Onboarding portal" : `Start onboarding${form.companyName ? ` for ${form.companyName}` : ""}`}
          </DialogTitle>
          <DialogDescription>
            {shownUrl
              ? "Their private onboarding portal is ready."
              : "This creates their private onboarding portal. Check the details; they'll appear on the agreement."}
          </DialogDescription>
        </DialogHeader>

        {shownUrl ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Portal link</p>
              <p className="mt-1 break-all text-sm font-medium">{shownUrl}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => copy(shownUrl)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a href={shownUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open portal
                </a>
              </div>
            </div>
            {result && (
              <p className="text-sm text-muted-foreground">
                {result.emailed
                  ? <>An email with this link went to <b>{form.email}</b> from the onboarding tool.</>
                  : <>No email was sent. Share the link however you like.</>}
              </p>
            )}
            {!result && existingPortalUrl && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                A portal already exists for this lead. Creating another one makes a second, separate portal.
                <button onClick={() => setShowExisting(false)} className="ml-2 underline underline-offset-2">Create another anyway</button>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              <button
                onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event(OPEN_ONBOARDING_EMAIL_EVENT)), 50); }}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                title="Opens the intro email with this link filled in, ready to copy into Outlook"
              >
                <Mail className="h-4 w-4" /> Write the intro email
              </button>
              <button onClick={onClose} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Done</button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm space-y-1 block">
                <span className="text-xs text-muted-foreground">Management company</span>
                <input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputCls} />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-xs text-muted-foreground">Management type</span>
                <select value={form.mgmtType} onChange={(e) => set("mgmtType", e.target.value as MgmtType)} className={inputCls}>
                  <option value="">Let them choose</option>
                  <option value="owner_operator">Owner operator</option>
                  <option value="third_party">Third-party management</option>
                </select>
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-xs text-muted-foreground">Contact name</span>
                <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputCls} />
              </label>
              <label className="text-sm space-y-1 block">
                <span className="text-xs text-muted-foreground">Phone</span>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
              </label>
              <label className="text-sm space-y-1 block sm:col-span-2">
                <span className="text-xs text-muted-foreground">Email</span>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
              </label>
            </div>

            {logoUrl && !logoBroken && (
              <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
                <input type="checkbox" checked={sendLogo} onChange={(e) => setSendLogo(e.target.checked)} className="h-4 w-4" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-md border bg-white object-contain p-0.5" onError={() => setLogoBroken(true)} />
                <span>
                  Put their logo on the onboarding portal
                  <span className="block text-xs text-muted-foreground">Pulled from {logoDomain ?? "their website"}. Uncheck if it looks wrong.</span>
                </span>
              </label>
            )}

            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-medium">Create &amp; Email</span> sends <b>{form.email.trim() || "their email"}</b> a message with their onboarding link right away.
              Use <span className="font-medium">Create only</span> if you'd rather send it yourself.
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <button onClick={onClose} disabled={isPending} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50">Cancel</button>
              <button onClick={() => create(false)} disabled={isPending} className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
                {isPending ? "Creating..." : "Create only"}
              </button>
              <button onClick={() => create(true)} disabled={isPending || !emailOk} title={emailOk ? undefined : "Add a valid email first"} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Mail className="h-4 w-4" />
                {isPending ? "Creating..." : "Create & Email"}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
