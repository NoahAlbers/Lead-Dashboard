"use server";

// Lightweight automated research: fetch the lead's company website and pull
// out what a person would grab in the first 30 seconds — the site title and
// description, and every social/profile link the homepage points at. Findings
// are stored on the lead timeline so they survive reloads and are visible to
// the whole team.

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { leadWebDomain } from "@/lib/lead-domain";

export interface FoundProfile {
  kind: string;
  url: string;
}

export interface AutoResearchResult {
  success: boolean;
  error?: string;
  domain?: string;
  siteTitle?: string | null;
  siteDescription?: string | null;
  profiles?: FoundProfile[];
}

const PROFILE_HOSTS: Array<{ kind: string; match: RegExp }> = [
  { kind: "LinkedIn", match: /linkedin\.com\/(company|in)\/[^/?#"']+/i },
  { kind: "Facebook", match: /facebook\.com\/(?!sharer|share|plugins)[^/?#"']+/i },
  { kind: "Instagram", match: /instagram\.com\/[^/?#"']+/i },
  { kind: "X / Twitter", match: /(?:twitter|x)\.com\/(?!intent|share)[^/?#"']+/i },
  { kind: "YouTube", match: /youtube\.com\/(@|channel\/|user\/|c\/)[^/?#"']+/i },
  { kind: "Yelp", match: /yelp\.com\/biz\/[^/?#"']+/i },
  { kind: "BBB", match: /bbb\.org\/[^"'\s>]+/i },
];

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["'](?:og:)?${name}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["'](?:og:)?${name}["']`,
    "i"
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

async function fetchSite(domain: string): Promise<string | null> {
  // Only fetch plain public hostnames — never IPs or localhost.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    return null;
  }
  for (const url of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") ?? "";
      if (!type.includes("html")) continue;
      const text = await res.text();
      return text.slice(0, 500_000);
    } catch {
      continue;
    }
  }
  return null;
}

export async function autoResearchLead(leadId: string): Promise<AutoResearchResult> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, error: "Lead not found" };

  const raw = lead.rawPayloadJson as Record<string, unknown> | null;
  const intake = (raw?._rawIntakeForm as Record<string, unknown>) ?? raw ?? {};
  const website = (intake.companyWebsite as string) || null;
  const domain = leadWebDomain(website, lead.email);

  if (!domain) {
    return {
      success: false,
      error: "No company website or business email domain to research. Their email is a personal address.",
    };
  }

  const html = await fetchSite(domain);
  if (!html) {
    return { success: false, error: `Couldn't reach ${domain}. The site may be down or blocking robots.`, domain };
  }

  const titleRaw = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ?? null;
  const siteTitle = titleRaw ? decodeEntities(titleRaw) : null;
  const descRaw = extractMeta(html, "description");
  const siteDescription = descRaw ? decodeEntities(descRaw).slice(0, 300) : null;

  const profiles: FoundProfile[] = [];
  const seen = new Set<string>();
  for (const { kind, match } of PROFILE_HOSTS) {
    const m = html.match(match);
    if (m) {
      let url = m[0];
      if (!url.startsWith("http")) url = `https://${url}`;
      // Normalize trailing junk
      url = url.replace(/["'>].*$/, "");
      const key = url.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        profiles.push({ kind, url });
      }
    }
  }

  const payload = {
    domain,
    siteTitle,
    siteDescription,
    profiles,
    fetchedAt: new Date().toISOString(),
  };

  await prisma.leadEvent.create({
    data: {
      leadId,
      userId: session.user.id,
      eventType: "auto_research",
      eventDataJson: JSON.parse(JSON.stringify(payload)),
    },
  });

  revalidatePath(`/leads/${leadId}`);
  return { success: true, ...payload };
}
