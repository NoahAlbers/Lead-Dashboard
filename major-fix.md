Five fixes needed. Read all, then plan and implement.

## FIX 1: Email Templates — Rich Text Stripped to Plain Text in mailto

### Root Cause

In src/components/leads/email-dialog.tsx line 159-162:
```typescript
function buildMailto(to: string, subject: string, body: string): string {
  const plainBody = body.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
}
```

The template body is stored as HTML (from the Tiptap rich text editor). The buildMailto function strips ALL HTML tags with a regex, turning `<p>Hello</p><p>World</p>` into `HelloWorld` — no line breaks, no formatting, everything mashed together. The `mailto:` protocol only supports plain text in the body, not HTML.

### Fix

The HTML-to-plain-text conversion needs to be MUCH smarter. It needs to:
1. Convert `<br>` and `<br/>` to newlines
2. Convert `</p>`, `</div>`, `</h1>`, `</h2>`, `</h3>`, `</li>` to newlines (block elements create line breaks)
3. Convert `<li>` to `\n• ` (bullet points)
4. Convert `<ol>` numbered list items to `\n1. `, `\n2. `, etc.
5. Convert `<a href="URL">text</a>` to `text (URL)` so links are preserved
6. Convert `<strong>` / `<b>` text as-is (can't bold in plain text)
7. Preserve paragraph spacing (double newline between paragraphs)
8. Convert `&nbsp;` to spaces
9. Convert `&amp;`, `&lt;`, `&gt;`, `&quot;` to their characters
10. Strip all remaining HTML tags
11. Trim excessive whitespace/newlines

Replace the buildMailto function:
```typescript
function htmlToPlainText(html: string): string {
  let text = html;
  
  // Decode HTML entities first
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Convert links: <a href="URL">text</a> → text (URL)
  text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, url, linkText) => {
    const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
    // If the link text IS the URL, just show it once
    if (cleanText === url || cleanText === url.replace(/^https?:\/\//, '')) return url;
    return `${cleanText} (${url})`;
  });
  
  // Handle ordered lists: number each <li> sequentially
  text = text.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let counter = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, liContent: string) => {
      counter++;
      return `\n${counter}. ${liContent.replace(/<[^>]+>/g, '').trim()}`;
    });
  });
  
  // Handle unordered lists: bullet each <li>
  text = text.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, liContent: string) => {
      return `\n• ${liContent.replace(/<[^>]+>/g, '').trim()}`;
    });
  });
  
  // Convert block elements to double newlines (paragraph breaks)
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<\/blockquote>/gi, '\n\n');
  
  // Convert <br> to single newline
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert <hr> to a separator line
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace
  text = text.replace(/[ \t]+/g, ' '); // collapse horizontal whitespace
  text = text.replace(/\n /g, '\n'); // remove leading spaces on lines
  text = text.replace(/ \n/g, '\n'); // remove trailing spaces on lines
  text = text.replace(/\n{3,}/g, '\n\n'); // max 2 consecutive newlines
  text = text.trim();
  
  return text;
}

function buildMailto(to: string, subject: string, body: string): string {
  const plainBody = htmlToPlainText(body);
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
}
```

### Also: mailto URL length limits

mailto links have a practical URL length limit (~2000 characters in some browsers, up to ~32KB in others). If the body is very long with a lead summary table, it might get truncated. Add a check:
```typescript
function buildMailto(to: string, subject: string, body: string): string {
  const plainBody = htmlToPlainText(body);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;
  
  if (mailto.length > 30000) {
    console.warn('[Email] mailto link is very long (' + mailto.length + ' chars), may be truncated by email client');
  }
  
  return mailto;
}
```

## FIX 2: Lead Inbox Stat Widget Counts Inaccurate

The top stat widgets showing A Leads, B Leads, C Leads counts are likely wrong because the tier names in the widgets may not match what's stored in the database. 

Debug this:
1. Check what qualityTier values are actually stored on leads in the database:
```sql
   SELECT "qualityTier", COUNT(*) FROM "Lead" GROUP BY "qualityTier";
```
2. Check what the stat widget queries are filtering on — they may be looking for "A" when the database has "A Lead", or vice versa
3. The tier names are admin-configurable now, so the widget counts MUST use the actual tier names from the database, not hardcoded values
4. Make sure the stat widget count queries match leads using the EXACT qualityTier string stored on the lead record
5. Also check if any leads have NULL qualityTier (unscored) — these should not be counted in any tier widget

Fix the widget count queries to dynamically pull tier names from the quality tier configuration and match exactly.

## FIX 3: Refer Out Button Should Prompt for Partner and Follow Up with Outcome Reasons

When the "Refer Out" action button is clicked on the lead detail page, the current flow should be:

1. Ask which referral partner the lead is being referred to (dropdown/selection of active partners)
2. After selecting a partner, show the outcome/reason modal (from the Win/Loss Analysis feature — Feature 8 from the Operational PRD) with the "Referred Out" prompts:
   - Referral Partner (pre-filled from step 1)
   - Reason for Referral (dropdown: Outside geography, Outside service niche, Claim size doesn't fit, Legal matter, Better fit for partner, Client preference, Other)
   - Estimated Value Being Referred (currency input)
   - Notes (text)
3. THEN change the status to "Referred Out" and log the outcome

Check how the Refer Out button is currently wired in the LeadActions component. It should:
- Open a partner selection (can reuse the same partner selection from the email dialog)
- After partner selection, open the outcome modal pre-filled with outcome_type = "referred_out"
- Save the lead_outcome record
- Update lead status to REFERRED_OUT
- Log the activity event

If the outcome modal for "referred_out" doesn't show the partner selection, wire it in. The referral partner should be required for referred_out outcomes.

## FIX 4: Scoring Rule Conditions — Missing Fields

The scoring rule creation UI needs to include ALL possible lead fields as condition options. Check what fields are currently available in the scoring rule condition builder and add any missing ones.

The full list of fields that MUST be available for scoring rule conditions:

Contact fields:
- fullName
- companyName  
- email
- phone
- alternatePhone

Location fields:
- state (should work with the states array — match ANY state)
- state_classification (virtual field — checks against good/bad state config)
- city
- zip
- country

Business/Case fields:
- industry
- debtType
- balanceAmount (numeric — supports greater_than, less_than)
- estimatedClaimValue (numeric)
- accountVolume (the total units — should support greater_than, less_than as numeric)
- serviceRequested
- notesFromForm (supports contains)
- urgency
- businessType
- geographicScope

Portfolio/Residential fields (from the intake form via rawPayloadJson._rawIntakeForm):
- ownershipType
- rentalTypes (array — supports contains, in)
- propertyTypes (array — supports contains, in)
- avgRent (numeric — supports greater_than, less_than)
- listingSites (array — supports contains, in)
- pmSoftware (array — supports contains, in)
- debtsNow (the "debts ready now" response)
- priorAgency (yes/no)

Metadata fields:
- source
- leadSource
- referrer

The following operators should be available for each field type:
- Text fields: equals, not_equals, contains, is_empty, is_not_empty
- Numeric fields: equals, not_equals, greater_than, less_than, is_empty, is_not_empty
- Array fields: contains (any element matches), in (any element in list), is_empty, is_not_empty
- State classification: equals (good/bad/unknown), not_equals

For the residential path fields (ownershipType, rentalTypes, etc.) — the scoring engine needs to be able to access these. Currently they may only exist in rawPayloadJson._rawIntakeForm, not as top-level lead fields. The scoring engine's getLeadFieldValue function needs to also look inside the rawPayloadJson._rawIntakeForm for these fields:
```typescript
function getLeadFieldValue(lead: Record<string, unknown>, field: string): unknown {
  // Check top-level field first
  let raw = lead[field] ?? null;
  
  // If not found at top level, check rawPayloadJson._rawIntakeForm
  if (raw === null || raw === undefined) {
    const rawPayload = lead.rawPayloadJson as Record<string, unknown> | null;
    if (rawPayload?._rawIntakeForm) {
      const intakeForm = rawPayload._rawIntakeForm as Record<string, unknown>;
      raw = intakeForm[field] ?? null;
    }
  }
  
  // ... rest of existing logic (state array handling, JSON parsing, etc.)
}
```

Update the scoring rule creation UI (the admin settings page for scoring rules) to show ALL these fields in the field dropdown, organized into groups:
- Contact Info
- Location
- Business/Case
- Portfolio Details (residential)
- Collections Readiness
- Metadata

## FIX 5: Quality Trend Chart Broken

The Quality Trend chart (tier mix over time, stacked area chart) looks wrong — the areas are overlapping incorrectly and the colors don't match the tiers.

Debug:
1. Check what data the chart is receiving — is it properly grouping leads by tier AND date?
2. Check if the chart is using a stacked area configuration (areas should stack, not overlap)
3. The colors should come from the tier configuration (same darkened chart colors used elsewhere)
4. With limited data points (sparse days), the chart should handle gaps gracefully — if no leads came in on a day, that day should show 0 for all tiers, not be skipped
5. Check if the chart library (Recharts or Chart.js) is configured correctly for stacking:
   - For Recharts: each `<Area>` component needs `stackId="1"` 
   - For Chart.js: `options.scales.y.stacked = true` and `datasets[n].fill = true`
6. Make sure each tier series uses the correct color from the tier settings
7. The x-axis should show dates even when there's no data for some days — fill gaps with 0

If the chart is fundamentally broken, consider replacing it with a simpler stacked bar chart (one bar per day, segments per tier) which is easier to get right and more readable with sparse data.

## Implementation Order

1. Email template HTML-to-plain-text conversion (FIX 1) — highest user impact, causes bad impressions with leads
2. Scoring rule conditions — add all missing fields (FIX 4) — foundational for lead qualification
3. Refer Out flow — partner selection + outcome reasons (FIX 3)
4. Stat widget counts (FIX 2)
5. Quality Trend chart (FIX 5)

## BUG FIX: Lead Detail Page Crashes on First Load

### Error
"Application error: a server-side exception has occurred"
Server log: "Route /leads/[id] used revalidatePath /leads during render which is unsupported"

### Root Cause

In src/app/(dashboard)/leads/[id]/page.tsx lines 138-140:
```typescript
if (!lead.isRead) {
  await markLeadAsRead(id);
}
```

This calls markLeadAsRead() during the SERVER COMPONENT RENDER. The markLeadAsRead function in src/actions/lead.actions.ts (line 502-508) calls revalidatePath("/leads") — which is a cache mutation. Next.js does NOT allow revalidatePath() during render. It throws an error that crashes the page.

The SECOND load works because by then the lead has been marked as read by a different mechanism (or the error was caught and the update still persisted), so the if-block doesn't execute.

### Fix

Remove the markLeadAsRead call from the server component render entirely. Instead, mark the lead as read from the CLIENT side after the page has loaded.

**Step 1:** Remove the markLeadAsRead call from the page.tsx render:

In src/app/(dashboard)/leads/[id]/page.tsx, DELETE these lines (138-140):
```typescript
// REMOVE THIS — calling revalidatePath during render crashes the page
if (!lead.isRead) {
  await markLeadAsRead(id);
}
```

**Step 2:** Create a client component that marks the lead as read on mount:

Create src/components/leads/mark-read-on-view.tsx:
```typescript
"use client";

import { useEffect, useRef } from "react";
import { markLeadAsRead } from "@/actions/lead.actions";

export function MarkReadOnView({ leadId, isRead }: { leadId: string; isRead: boolean }) {
  const marked = useRef(false);
  
  useEffect(() => {
    if (!isRead && !marked.current) {
      marked.current = true;
      markLeadAsRead(leadId).catch(() => {
        // Non-critical — if it fails, the lead just stays unread
        console.error("Failed to mark lead as read");
      });
    }
  }, [leadId, isRead]);
  
  return null; // This component renders nothing — it's just a side effect
}
```

**Step 3:** Add the client component to the lead detail page:

In src/app/(dashboard)/leads/[id]/page.tsx, import and render the component somewhere in the JSX (at the top of the return, before visible content):
```typescript
import { MarkReadOnView } from "@/components/leads/mark-read-on-view";

// ... in the return JSX, at the very top:
return (
  <div className="space-y-3">
    <MarkReadOnView leadId={lead.id} isRead={lead.isRead ?? false} />
    {/* Working Mode Bar */}
    <WorkingModeBarWrapper />
    ...
```

**Step 4:** Also fix the markLeadAsRead server action

The markLeadAsRead function should work correctly as a server action (called from a client component via useEffect), but double-check that it has the "use server" directive or is in a file that's properly set up as server actions:

In src/actions/lead.actions.ts, make sure the file has "use server" at the top (it likely already does since other functions in the file are server actions).

### Why This Works

- Server components cannot call revalidatePath during render — it's a Next.js restriction
- Client components CAN call server actions (which internally use revalidatePath) because the call happens AFTER render, during a useEffect
- The useEffect fires once on mount, marks the lead as read via the server action, and the revalidation happens cleanly outside of the render cycle
- The page loads instantly (no blocking on the markAsRead call)
- The ref prevents double-marking if the component re-renders

### Testing

1. Find or create a new unread lead
2. Click it from the inbox
3. It should load WITHOUT crashing
4. The lead should be marked as read (envelope icon changes in the inbox)
5. Refreshing the page should still work
6. The lead should NOT be marked as read again on subsequent views (the isRead check prevents it)