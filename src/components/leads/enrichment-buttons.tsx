"use client";

import { useState } from "react";
import { Search, Linkedin, Globe, MapPin, ExternalLink, Building2, ClipboardCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResearchLogModal } from "./research-log-modal";

interface EnrichmentButtonsProps {
  leadId: string;
  companyName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  state?: string | null;
  city?: string | null;
  companyWebsite?: string | null;
}

interface QuickLink {
  label: string;
  href: string | null;
  icon: React.ReactNode;
  disabled: boolean;
}

export function EnrichmentButtons({
  leadId,
  companyName,
  fullName,
  firstName,
  lastName,
  state,
  city,
  companyWebsite,
}: EnrichmentButtonsProps) {
  const [researchOpen, setResearchOpen] = useState(false);

  const hasCompany = !!companyName;
  const hasName = !!fullName;
  const hasLocation = !!(city || state);

  const websiteUrl = companyWebsite
    ? companyWebsite.startsWith("http")
      ? companyWebsite
      : `https://${companyWebsite}`
    : null;

  const links: QuickLink[] = [
    {
      label: "Google: Company",
      href: hasCompany
        ? `https://www.google.com/search?q=${encodeURIComponent(companyName!)}`
        : null,
      icon: <Search className="h-3.5 w-3.5" />,
      disabled: !hasCompany,
    },
    {
      label: "Google: Contact",
      href: hasName
        ? `https://www.google.com/search?q=${encodeURIComponent(fullName! + " " + (companyName ?? ""))}`
        : null,
      icon: <Search className="h-3.5 w-3.5" />,
      disabled: !hasName,
    },
    {
      label: "LinkedIn: Company",
      href: hasCompany
        ? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName!)}`
        : null,
      icon: <Linkedin className="h-3.5 w-3.5" />,
      disabled: !hasCompany,
    },
    {
      label: "LinkedIn: Contact",
      href: hasName
        ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fullName!)}`
        : null,
      icon: <Linkedin className="h-3.5 w-3.5" />,
      disabled: !hasName,
    },
    {
      label: "BBB",
      href: hasCompany
        ? `https://www.bbb.org/search?find_text=${encodeURIComponent(companyName!)}&find_loc=${encodeURIComponent(state ?? "")}`
        : null,
      icon: <Building2 className="h-3.5 w-3.5" />,
      disabled: !hasCompany,
    },
    {
      label: "Google Maps",
      href: hasLocation
        ? `https://www.google.com/maps/search/${encodeURIComponent((companyName ?? "") + " " + (city ?? "") + " " + (state ?? ""))}`
        : null,
      icon: <MapPin className="h-3.5 w-3.5" />,
      disabled: !hasLocation,
    },
    {
      label: "Website",
      href: websiteUrl,
      icon: <Globe className="h-3.5 w-3.5" />,
      disabled: !websiteUrl,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <TooltipProvider delayDuration={200}>
          {links.map((link) => (
            <Tooltip key={link.label}>
              <TooltipTrigger asChild>
                {link.disabled ? (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                  >
                    {link.icon}
                  </span>
                ) : (
                  <a
                    href={link.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-card text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {link.icon}
                  </a>
                )}
              </TooltipTrigger>
              <TooltipContent>
                <p>{link.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      <button
        onClick={() => setResearchOpen(true)}
        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <ClipboardCheck className="h-3.5 w-3.5" />
        Log Research
      </button>

      <ResearchLogModal
        open={researchOpen}
        onClose={() => setResearchOpen(false)}
        leadId={leadId}
      />
    </>
  );
}
