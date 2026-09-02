"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { LeadStatus } from "@prisma/client";

export type SearchResultKind = "lead" | "partner" | "template" | "nav";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  label: string;
  sublabel?: string;
  href: string;
  status?: LeadStatus;
}

export interface SearchResultGroup {
  key: SearchResultKind;
  title: string;
  items: SearchResult[];
}

interface NavEntry {
  label: string;
  href: string;
  sublabel?: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { label: "Lead Inbox", href: "/leads" },
  { label: "Assignments", href: "/leads/assignments" },
  { label: "Reports", href: "/reports" },
  { label: "Live Monitor", href: "/admin/monitor" },
  { label: "Scoring Rules", href: "/admin/rules" },
  { label: "Referral Partners", href: "/admin/partners" },
  { label: "Email Templates", href: "/admin/templates" },
  { label: "Users", href: "/admin/users" },
  { label: "My Settings", href: "/settings" },
  { label: "Admin Settings", href: "/admin/settings" },
  { label: "Statuses & Tiers", href: "/admin/settings#general", sublabel: "Admin Settings" },
  { label: "SLA & Office Hours", href: "/admin/settings#sla", sublabel: "Admin Settings" },
  { label: "Lead Aging", href: "/admin/settings#aging", sublabel: "Admin Settings" },
  { label: "Lead Emails", href: "/admin/settings#emails", sublabel: "Admin Settings" },
  { label: "Abandoned Forms", href: "/admin/settings#abandons", sublabel: "Admin Settings" },
  { label: "Outcome Reasons", href: "/admin/settings#outcomes", sublabel: "Admin Settings" },
  { label: "Field Mapping", href: "/admin/settings#field-mapping", sublabel: "Admin Settings" },
  { label: "Ingestion Health", href: "/admin/settings#ingestion", sublabel: "Admin Settings" },
  { label: "Data Tools", href: "/admin/settings#data-tools", sublabel: "Admin Settings" },
  { label: "Integrations", href: "/admin/settings#integrations", sublabel: "Admin Settings" },
];

const EXCLUDED_STATUSES: LeadStatus[] = ["ARCHIVED", "MERGED"];

function leadSublabel(lead: { email: string | null; state: string | null; status: LeadStatus }) {
  return [lead.email, lead.state, lead.status.replace(/_/g, " ").toLowerCase()]
    .filter(Boolean)
    .join(" · ");
}

function navResults(query: string): SearchResult[] {
  const q = query.toLowerCase();
  return NAV_ENTRIES.filter((n) => !q || n.label.toLowerCase().includes(q)).map((n) => ({
    id: `nav:${n.href}`,
    kind: "nav",
    label: n.label,
    sublabel: n.sublabel ?? n.href,
    href: n.href,
  }));
}

export async function globalSearch(rawQuery: string): Promise<SearchResultGroup[]> {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const query = (rawQuery ?? "").trim().slice(0, 100);
  const groups: SearchResultGroup[] = [];

  if (!query) {
    const recent = await prisma.lead.findMany({
      where: { status: { notIn: EXCLUDED_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, fullName: true, companyName: true, email: true, state: true, status: true },
    });
    groups.push({
      key: "lead",
      title: "Recent leads",
      items: recent.map((l) => ({
        id: l.id,
        kind: "lead",
        label: l.fullName || l.companyName || l.email || "Unnamed lead",
        sublabel: leadSublabel(l),
        href: `/leads/${l.id}`,
        status: l.status,
      })),
    });
    groups.push({ key: "nav", title: "Navigation", items: navResults("") });
    return groups;
  }

  const contains = { contains: query, mode: "insensitive" as const };

  const [leads, partners, templates] = await Promise.all([
    prisma.lead.findMany({
      where: {
        status: { notIn: EXCLUDED_STATUSES },
        OR: [
          { fullName: contains },
          { companyName: contains },
          { email: contains },
          { phone: contains },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, fullName: true, companyName: true, email: true, state: true, status: true },
    }),
    prisma.referralPartner.findMany({
      where: { OR: [{ name: contains }, { contactName: contains }] },
      orderBy: { name: "asc" },
      take: 4,
      select: { id: true, name: true, contactName: true },
    }),
    prisma.emailTemplate.findMany({
      where: { name: contains },
      orderBy: { name: "asc" },
      take: 4,
      select: { id: true, name: true },
    }),
  ]);

  if (leads.length) {
    groups.push({
      key: "lead",
      title: "Leads",
      items: leads.map((l) => ({
        id: l.id,
        kind: "lead",
        label: l.fullName || l.companyName || l.email || "Unnamed lead",
        sublabel: leadSublabel(l),
        href: `/leads/${l.id}`,
        status: l.status,
      })),
    });
  }

  if (partners.length) {
    groups.push({
      key: "partner",
      title: "Referral partners",
      items: partners.map((p) => ({
        id: p.id,
        kind: "partner",
        label: p.name,
        sublabel: p.contactName ?? undefined,
        href: "/admin/partners",
      })),
    });
  }

  if (templates.length) {
    groups.push({
      key: "template",
      title: "Email templates",
      items: templates.map((t) => ({
        id: t.id,
        kind: "template",
        label: t.name,
        href: "/admin/templates",
      })),
    });
  }

  const nav = navResults(query);
  if (nav.length) {
    groups.push({ key: "nav", title: "Navigation", items: nav });
  }

  return groups;
}
