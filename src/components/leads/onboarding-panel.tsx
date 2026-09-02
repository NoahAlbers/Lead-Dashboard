import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, FileSignature } from "lucide-react";

interface Milestone {
  milestone: string;
  label: string;
  at: string;
}

interface OnboardingPanelProps {
  portalUrl: string;
  emailed: boolean;
  createdAt: string;
  milestones: Milestone[];
}

const STEPS: Array<{ key: string; label: string }> = [
  { key: "portal_opened", label: "Opened portal" },
  { key: "entity_added", label: "Added properties" },
  { key: "agreement_signed", label: "Signed agreement" },
  { key: "onboarding_complete", label: "Complete" },
];

/** Where the client is in onboarding, from the milestones the onboarding tool reports back. */
export function OnboardingPanel({ portalUrl, emailed, createdAt, milestones }: OnboardingPanelProps) {
  const reached = new Set(milestones.map((m) => m.milestone));
  const latest = milestones[0];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Onboarding</h3>
        <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          Portal <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <ol className="space-y-1.5">
        {STEPS.map((s) => {
          const done = reached.has(s.key);
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />}
              <span className={done ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] text-muted-foreground">
        <FileSignature className="mr-1 inline h-3 w-3" />
        Portal created {new Date(createdAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}
        {emailed ? ", link emailed" : ", link not emailed"}
        {latest ? ` · last activity ${new Date(latest.at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}` : ""}
      </p>
      {!reached.has("portal_opened") && (
        <p className="mt-1 text-[10px] text-muted-foreground">They haven't opened it yet. <Link href="#" className="hidden">resend</Link></p>
      )}
    </div>
  );
}
