"use client";

import { getStateColor } from "@/lib/state-colors";

interface SubmissionDataTableProps {
  data: {
    fields: Record<string, unknown>;
    metadata: Record<string, unknown>;
  };
  stateClassMap?: Record<string, string>;
}

function findField(data: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] != null && data[key] !== "") return data[key];
  }
  return null;
}

function parseUA(ua: string): string {
  if (!ua) return "Unknown";
  let browser = "Browser";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh")) os = "Mac";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";
  return os ? `${browser} on ${os}` : browser;
}

function toPillArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function formatCurrency(val: unknown): string | null {
  const num = typeof val === "number" ? val : typeof val === "string" ? parseFloat(val.replace(/[$,\s]/g, "")) : NaN;
  if (isNaN(num)) return null;
  return `$${num.toLocaleString()}/mo`;
}

function formatSubmittedDate(val: unknown): string | null {
  if (!val) return null;
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return String(val);
  }
}

function Pills({ items, stateClassMap }: { items: string[]; stateClassMap?: Record<string, string> }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => {
        if (stateClassMap) {
          const cls = stateClassMap[item.toUpperCase()] ?? "unknown";
          const colors = getStateColor(cls);
          return (
            <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {item}
            </span>
          );
        }
        return (
          <span key={i} className="rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
            {item}
          </span>
        );
      })}
    </div>
  );
}

interface RowDef {
  label: string;
  value: React.ReactNode | null;
}

export function SubmissionDataTable({ data, stateClassMap }: SubmissionDataTableProps) {
  const fields = data?.fields ?? {};
  const metadata = data?.metadata ?? {};

  // Build name
  const fullName = findField(fields, "full_name", "fullName", "name");
  const firstName = findField(fields, "first_name", "firstName");
  const lastName = findField(fields, "last_name", "lastName");
  const nameVal = fullName ? String(fullName) : (firstName || lastName) ? `${firstName ?? ""} ${lastName ?? ""}`.trim() : null;

  const company = findField(fields, "company_name", "companyName", "company");
  const email = findField(fields, "email");
  const phone = findField(fields, "phone");
  const website = findField(fields, "companyWebsite", "company_website", "website");
  const noWebsite = findField(fields, "noWebsite", "no_website");

  const debtTypes = toPillArray(findField(fields, "debtTypes", "debt_type", "debtType", "service_requested", "serviceRequested"));
  const debtsNow = findField(fields, "debtsNow", "debts_ready");
  const priorAgency = findField(fields, "priorAgency", "prior_agency");
  const states = toPillArray(findField(fields, "states", "state", "statesArray"));
  const ownership = findField(fields, "ownershipType", "ownership", "business_type", "businessType");
  const totalUnits = findField(fields, "totalUnits", "total_units", "account_volume", "accountVolume");
  const rentalTypes = toPillArray(findField(fields, "rentalTypes", "rental_types"));
  const propertyTypes = toPillArray(findField(fields, "propertyTypes", "property_types"));
  const avgRent = findField(fields, "avgRent", "avg_rent", "balance_amount", "balanceAmount");
  const listingSites = toPillArray(findField(fields, "listingSites", "listing_locations"));
  const pmSoftware = toPillArray(findField(fields, "pmSoftware", "pm_software"));
  const comments = findField(fields, "comments", "notes_from_form", "notesFromForm");

  const ipAddress = findField(metadata, "ip_address", "location") ?? findField(fields, "location");
  const deviceFriendly = findField(metadata, "device") ?? findField(fields, "device");
  const userAgent = findField(metadata, "user_agent");
  const timezone = findField(metadata, "timezone");
  const referrer = findField(metadata, "referrer");
  const claritySessionId =
    findField(metadata, "claritySessionId", "clarity_session_id", "clarity_url") ??
    findField(fields, "claritySessionId", "clarity_session_id");
  const submittedAt = findField(metadata, "created_at", "submitted_at", "form_completed_at") ?? findField(fields, "submittedAt", "submitted_at", "form_completed_at");

  const rows: RowDef[] = [];

  if (nameVal) rows.push({ label: "Name", value: nameVal });
  if (company) rows.push({ label: "Company", value: String(company) });
  if (email) rows.push({
    label: "Email",
    value: <a href={`mailto:${email}`} className="text-primary hover:underline">{String(email)}</a>,
  });
  if (phone) rows.push({
    label: "Phone",
    value: <a href={`tel:${phone}`} className="text-primary hover:underline">{String(phone)}</a>,
  });
  if (website || noWebsite) rows.push({
    label: "Website",
    value: noWebsite && !website ? (
      <span className="text-muted-foreground">None provided</span>
    ) : (
      <a
        href={String(website).startsWith("http") ? String(website) : `https://${website}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        {String(website)}
      </a>
    ),
  });
  if (debtTypes.length > 0) rows.push({ label: "Debt Types", value: <Pills items={debtTypes} /> });
  if (debtsNow) rows.push({ label: "Debts Ready Now", value: String(debtsNow) });
  if (priorAgency) rows.push({ label: "Prior Agency", value: String(priorAgency) });
  if (states.length > 0) rows.push({ label: "States", value: <Pills items={states} stateClassMap={stateClassMap} /> });
  if (ownership) rows.push({ label: "Ownership", value: String(ownership) });
  if (totalUnits) rows.push({ label: "Total Units", value: String(totalUnits) });
  if (rentalTypes.length > 0) rows.push({ label: "Rental Types", value: <Pills items={rentalTypes} /> });
  if (propertyTypes.length > 0) rows.push({ label: "Property Types", value: <Pills items={propertyTypes} /> });
  const avgRentFormatted = formatCurrency(avgRent);
  if (avgRentFormatted) rows.push({ label: "Avg Rent / Unit", value: avgRentFormatted });
  if (listingSites.length > 0) rows.push({ label: "Listing Sites", value: <Pills items={listingSites} /> });
  if (pmSoftware.length > 0) rows.push({ label: "PM Software", value: <Pills items={pmSoftware} /> });
  if (comments) rows.push({
    label: "Comments",
    value: (
      <div className="border-l-2 border-primary/30 pl-3 bg-muted/20 rounded-r p-2 text-sm whitespace-pre-wrap">
        {String(comments)}
      </div>
    ),
  });
  if (ipAddress) rows.push({ label: "Location / IP", value: String(ipAddress) });
  if (deviceFriendly) rows.push({ label: "Device", value: String(deviceFriendly) });
  else if (userAgent) rows.push({ label: "Device", value: parseUA(String(userAgent)) });
  if (timezone) rows.push({ label: "Timezone", value: String(timezone) });
  if (referrer != null) {
    const ref = String(referrer);
    rows.push({
      label: "Referrer",
      value: !ref || ref === "direct" ? "Direct" : (
        <a href={ref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block max-w-[250px]">
          {ref}
        </a>
      ),
    });
  }
  if (claritySessionId) {
    const sid = String(claritySessionId);
    const isUrl = sid.startsWith("http");
    const link = isUrl ? sid : `https://clarity.microsoft.com/player/qo6gcqjdc7/${sid}`;
    rows.push({
      label: "Clarity Recording",
      value: (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          View Recording
        </a>
      ),
    });
  } else {
    rows.push({ label: "Clarity Recording", value: <span className="text-muted-foreground">Not available</span> });
  }
  const submittedFormatted = formatSubmittedDate(submittedAt);
  if (submittedFormatted) rows.push({ label: "Submitted", value: submittedFormatted });

  if (rows.length === 0) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-sm font-medium flex items-center gap-1.5 select-none">
        <svg className="h-3.5 w-3.5 transition-transform" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
        Original Submission Data
      </summary>
      <div className="mt-2 rounded-md border overflow-hidden">
        <table className="w-full text-left">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                <td className="text-xs text-muted-foreground px-3 py-1.5 align-top w-[35%] whitespace-nowrap">
                  {row.label}
                </td>
                <td className="text-sm px-3 py-1.5">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
