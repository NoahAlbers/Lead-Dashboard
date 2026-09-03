"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Sparkles, Globe } from "lucide-react";
import { autoResearchLead } from "@/actions/research.actions";
import type { AutoResearchResult } from "@/services/research.service";
import { EnrichmentButtons } from "@/components/leads/enrichment-buttons";
import { LocationMap } from "@/components/leads/location-map";
import { toast } from "@/components/ui/use-toast";

interface ResearchPanelProps {
  leadId: string;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  state?: string | null;
  city?: string | null;
  companyWebsite?: string | null;
  hasResearchLog: boolean;
  initialAutoResearch: {
    domain?: string;
    siteTitle?: string | null;
    siteDescription?: string | null;
    profiles?: Array<{ kind: string; url: string }>;
    fetchedAt?: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    geoPrecision?: "address" | "area" | null;
    addressFrom?: string | null;
    logoUrl?: string | null;
    logoSource?: string | null;
  } | null;
}

export function ResearchPanel({
  leadId,
  companyName,
  fullName,
  firstName,
  lastName,
  state,
  city,
  companyWebsite,
  hasResearchLog,
  initialAutoResearch,
}: ResearchPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [research, setResearch] = useState(initialAutoResearch);

  function runAutoResearch() {
    startTransition(async () => {
      try {
        const res: AutoResearchResult = await autoResearchLead(leadId);
        if (res.success) {
          setResearch({
            domain: res.domain,
            siteTitle: res.siteTitle,
            siteDescription: res.siteDescription,
            profiles: res.profiles,
            fetchedAt: new Date().toISOString(),
            address: res.address,
            lat: res.lat,
            lng: res.lng,
            geoPrecision: res.geoPrecision,
            addressFrom: res.addressFrom,
            logoUrl: res.logoUrl,
            logoSource: res.logoSource,
          });
          const found = res.profiles?.length ?? 0;
          toast({
            title: found > 0 ? `Found their website and ${found} profile${found !== 1 ? "s" : ""}` : "Read their website; no social profiles linked",
            variant: "success",
          });
        } else {
          toast({ title: res.error ?? "Auto research failed", variant: "destructive" });
        }
      } catch {
        toast({ title: "Auto research failed", variant: "destructive" });
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Research</h3>

      <button
        onClick={runAutoResearch}
        disabled={isPending}
        className="mb-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {isPending ? "Reading their website..." : research ? "Re-run Auto Research" : "Auto Research"}
      </button>

      {research && (
        <div className="mb-2 rounded-md border bg-muted/40 p-2 space-y-1.5">
          <div className="flex items-start gap-2">
            {research.logoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={research.logoUrl}
                alt=""
                title={research.logoSource ? `Their ${research.logoSource}` : undefined}
                className="h-9 w-9 shrink-0 rounded border bg-card object-contain p-0.5"
              />
            )}
            {research.siteTitle && (
              <p className="min-w-0 text-xs font-medium leading-snug">{research.siteTitle}</p>
            )}
          </div>
          {research.siteDescription && (
            <p className="text-[11px] text-muted-foreground leading-snug">{research.siteDescription}</p>
          )}
          {research.address && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              {research.address}
              {research.addressFrom && research.addressFrom !== "/" && (
                <span className="text-[10px]"> (from {research.addressFrom})</span>
              )}
            </p>
          )}
          {research.domain && (
            <a
              href={`https://${research.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Globe className="h-3 w-3" />
              {research.domain}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          {research.profiles && research.profiles.length > 0 && (
            <div className="pt-1 border-t space-y-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Profiles found</p>
              {research.profiles.map((p) => (
                <a
                  key={p.url}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline truncate"
                >
                  <span className="font-medium shrink-0">{p.kind}:</span>
                  <span className="truncate">{p.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ))}
            </div>
          )}
          {research.fetchedAt && (
            <p className="text-[10px] text-muted-foreground">
              Checked {new Date(research.fetchedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} EST
            </p>
          )}
        </div>
      )}

      <EnrichmentButtons
        leadId={leadId}
        companyName={companyName}
        fullName={fullName}
        firstName={firstName}
        lastName={lastName}
        state={state}
        city={city}
        companyWebsite={companyWebsite}
      />
      {hasResearchLog ? (
        <p className="text-xs text-emerald-600 mt-2">Research completed</p>
      ) : (
        <p className="text-xs text-muted-foreground mt-2">Not yet researched</p>
      )}

      {/* Where the address we found actually is. Last thing in the panel,
          because it is the payoff of everything above it. */}
      {typeof research?.lat === "number" && typeof research?.lng === "number" && (
        <div className="mt-2">
          <LocationMap
            lat={research.lat}
            lng={research.lng}
            address={research.address ?? null}
            label={companyName ?? fullName ?? null}
            precision={research.geoPrecision ?? "address"}
          />
        </div>
      )}
    </div>
  );
}
