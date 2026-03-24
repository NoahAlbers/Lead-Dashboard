Two issues to fix. Read both, then implement.

## ISSUE 1: Lead Detail Page — "Not Found" Error on First Click for New Leads

### Root Cause

The ingestion pipeline is ASYNC (fire-and-forget). In src/app/api/leads/ingest/route.ts line 124-127:
```typescript
// Kick off async processing (fire and forget — respond immediately)
processIngestionItem(queueItem.id).catch((err) => {
  console.error("Async ingestion processing failed:", err);
});
```

The API responds with `lead_id: null` immediately BEFORE the lead is actually created in the database. When the form submission succeeds and the auto-refresh picks up the new lead in the inbox, the inbox shows the lead (because auto-refresh queries the leads table which now has it). But if the user clicks the lead VERY quickly — within the first 1-2 seconds — there's a race condition where:

1. The ingestion queue item is created (status: "received")
2. The API responds to the form
3. processIngestionItem starts running asynchronously
4. A notification fires or the inbox refreshes showing the new lead
5. The user clicks the lead in the inbox
6. The lead detail page calls `getLead(id)` 
7. BUT `processIngestionItem` hasn't finished yet — the lead record doesn't exist in the `leads` table yet
8. `getLead` returns null → `notFound()` → error page

On refresh it works because by then processing has completed and the lead exists.

### Fix

Two changes needed:

**Fix A: Make ingestion synchronous (preferred)**

In src/app/api/leads/ingest/route.ts, change the fire-and-forget to await the processing:
```typescript
// Process synchronously — wait for the lead to be created before responding
// This adds ~200-500ms to the response but ensures the lead exists when we return a receipt
try {
  await processIngestionItem(queueItem.id);
  
  // Re-fetch the queue item to get the lead_id
  const processed = await prisma.ingestionQueue.findUnique({ where: { id: queueItem.id } });
  
  return NextResponse.json(
    {
      success: true,
      receipt_id: receiptId,
      lead_id: processed?.leadId ?? null,
      submission_id: submissionId,
      received_at: new Date().toISOString(),
      status: processed?.status === "completed" ? "completed" : "received",
    },
    { status: 200, headers }
  );
} catch (processingError) {
  console.error("Ingestion processing error (lead queued but processing failed):", processingError);
  // The lead is still saved in the ingestion queue — respond with success
  // because the data IS captured, even if processing failed
  return NextResponse.json(
    {
      success: true,
      receipt_id: receiptId,
      lead_id: null,
      submission_id: submissionId,
      received_at: new Date().toISOString(),
      status: "received",
      message: "Submission received. Processing will complete shortly.",
    },
    { status: 200, headers }
  );
}
```

This means the form waits an extra ~300ms before showing the success screen, but it guarantees the lead exists in the database by the time anyone tries to view it.

**Fix B: Add a fallback in the lead detail page (defense in depth)**

In src/app/(dashboard)/leads/[id]/page.tsx, if `getLead(id)` returns null, check if there's a pending ingestion queue item for this ID before showing the 404:
```typescript
const lead = await getLead(id);

if (!lead) {
  // Before returning 404, check if this might be a lead still being processed
  const pendingItem = await prisma.ingestionQueue.findFirst({
    where: {
      OR: [
        { leadId: id },
        { submissionId: id },
      ],
      status: { in: ["received", "processing"] },
    },
  });
  
  if (pendingItem) {
    // Lead is still being processed — wait briefly and retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    const retryLead = await getLead(id);
    if (retryLead) {
      // Use retryLead and continue with the rest of the page
      // (you'll need to restructure slightly — extract the rendering into a helper or assign to a variable)
    }
  }
  
  notFound();
}
```

A simpler approach: Just redirect back to the inbox with a toast message:
```typescript
if (!lead) {
  // Check if it's a pending ingestion
  const pendingItem = await prisma.ingestionQueue.findFirst({
    where: { leadId: id, status: { in: ["received", "processing"] } },
  });
  
  if (pendingItem) {
    // Redirect to inbox — the lead will appear momentarily
    redirect("/leads?toast=Lead is still being processed. Please try again in a moment.");
  }
  
  notFound();
}
```

Implement BOTH Fix A and Fix B for maximum robustness.

## ISSUE 2: Email Notifications Missing Most Lead Data

### Current Problem

The notification email only shows: Name, Company, Email, Phone, State (singular), Units, Score, Tier. It's missing all the detailed fields: debt types, debts ready now, prior agency, all states (not just first), ownership, rental types, property types, avg rent, listing sites, PM software, comments, location/IP, device, referrer, Clarity recording link, timezone, submitted time.

### Fix

Find the email notification service (it was added after my source code snapshot — search for the file that contains `sendLeadNotificationEmail` or `buildLeadEmailHtml` or `leads@advancedcb.app`).

The email HTML builder needs to include ALL fields from the normalized payload, in this exact order:
Name
Company
Email
Phone
Website
Debt Types (joined from array)
Debts Ready Now
Prior Collection Agency
States (ALL states, joined from array)
Ownership (residential path only — omit row if empty)
Total Units (residential path only)
Rental Types (residential path only, joined from array)
Property Types (residential path only, joined from array)
Avg Rent / Unit (residential path only, formatted as currency)
Listing Sites (residential path only, joined from array)
PM Software (residential path only, joined from array)
Comments (the lead's free-text comments — this is important!)
Score
Quality Tier
Recommended Action
Location / IP
Device
Referrer
Clarity Recording (as a clickable link if available)
Likely Timezone
Submitted (EST)
Receipt #

### Updated Email Builder

Replace the email HTML builder function. The function should receive the FULL normalized payload (all the fields from the form), not just a subset. 

In the ingestion pipeline where sendLeadNotificationEmail is called, make sure you're passing ALL the normalized fields:
```typescript
// When calling sendLeadNotificationEmail, pass the FULL normalized payload
sendLeadNotificationEmail({
  receiptId: item.receiptId || 'N/A',
  // Pass the entire normalized payload so the email can include everything
  normalized: normalized,  // This has ALL fields: fullName, companyName, email, phone, states[], debtTypes[], ownershipType, totalUnits, rentalTypes[], propertyTypes[], avgRent, listingSites[], pmSoftware[], comments, location, device, referrer, clarityRecording, timezone, submittedAt, etc.
  // Also pass the score/tier from the created lead
  score: lead.score ?? undefined,
  qualityTier: lead.qualityTier ?? undefined,
  recommendedAction: lead.recommendedAction ?? undefined,
}).catch(err => {
  console.error('[Pipeline] Email notification failed (non-blocking):', err);
});
```

Then update the email builder to construct rows from ALL normalized fields:
```typescript
function buildLeadEmailHtml(data: {
  receiptId: string;
  normalized: NormalizedPayload;  // The full form data
  score?: number;
  qualityTier?: string;
  recommendedAction?: string;
}): string {
  const p = data.normalized;
  const rows: Array<[string, string]> = [];
  
  // Contact Info
  if (p.fullName) rows.push(['Name', p.fullName]);
  if (p.companyName) rows.push(['Company', p.noCompany ? '(Independent owner)' : p.companyName]);
  if (p.email) rows.push(['Email', `<a href="mailto:${p.email}" style="color:#2563eb">${p.email}</a>`]);
  if (p.phone) rows.push(['Phone', `<a href="tel:${p.phone}" style="color:#2563eb">${p.phone}</a>`]);
  
  // Website
  if (p.companyWebsite && !p.noWebsite) {
    const url = p.companyWebsite.startsWith('http') ? p.companyWebsite : `https://${p.companyWebsite}`;
    rows.push(['Website', `<a href="${url}" style="color:#2563eb">${p.companyWebsite}</a>`]);
  } else if (p.noWebsite) {
    rows.push(['Website', '<span style="color:#9ca3af">None provided</span>']);
  }
  
  // Collections Info
  if (p.debtTypes.length > 0) {
    let debtStr = p.debtTypes.join(', ');
    if (p.customDebtType) debtStr += ` (${p.customDebtType})`;
    rows.push(['Debt Types', debtStr]);
  }
  if (p.debtsNow) rows.push(['Debts Ready Now', p.debtsNow]);
  if (p.priorAgency) rows.push(['Prior Collection Agency', p.priorAgency]);
  
  // States (ALL of them)
  if (p.states.length > 0) rows.push(['States', p.states.join(', ')]);
  
  // Residential path fields — only include if they have values
  if (p.ownershipType) {
    let ownerStr = p.ownershipType;
    if (p.ownPercent != null) ownerStr += ` (${p.ownPercent}% own / ${100 - p.ownPercent}% manage)`;
    rows.push(['Ownership', ownerStr]);
  }
  if (p.totalUnits) rows.push(['Total Units', p.totalUnits]);
  if (p.rentalTypes.length > 0) rows.push(['Rental Types', p.rentalTypes.join(', ')]);
  if (p.propertyTypes.length > 0) rows.push(['Property Types', p.propertyTypes.join(', ')]);
  if (p.avgRent) rows.push(['Avg Rent / Unit', `$${p.avgRent.toLocaleString()}/mo`]);
  if (p.listingSites.length > 0) {
    let listStr = p.listingSites.join(', ');
    if (p.customListing) listStr += ` (${p.customListing})`;
    rows.push(['Listing Sites', listStr]);
  }
  if (p.pmSoftware.length > 0) {
    let pmStr = p.pmSoftware.join(', ');
    if (p.customPM) pmStr += ` (${p.customPM})`;
    rows.push(['PM Software', pmStr]);
  }
  
  // Comments — important, show prominently
  if (p.comments && !p.noQuestions) {
    rows.push(['Comments', `<div style="background:#f9fafb;border-left:3px solid #6366f1;padding:8px 12px;border-radius:0 4px 4px 0;white-space:pre-wrap">${p.comments}</div>`]);
  } else if (p.noQuestions) {
    rows.push(['Comments', '<span style="color:#9ca3af">No questions</span>']);
  }
  
  // Certifications
  if (p.certifyOwesDebt) rows.push(['⚠️ Certification', 'States they OWE a debt — may need to be redirected']);
  if (p.certifyNoDebt) rows.push(['Certification', 'Confirmed: does not owe a debt']);
  
  // Scoring
  rows.push(['Score', `${data.score ?? 'N/A'} (${data.qualityTier ?? 'Unscored'})`]);
  if (data.recommendedAction) rows.push(['Recommended Action', data.recommendedAction]);
  
  // Tracking / Metadata
  if (p.location) rows.push(['Location / IP', p.location]);
  if (p.device) rows.push(['Device', p.device]);
  if (p.referrer) rows.push(['Referrer', p.referrer === 'direct' ? 'Direct' : `<a href="${p.referrer}" style="color:#2563eb">${p.referrer}</a>`]);
  if (p.clarityRecording) {
    const isUrl = p.clarityRecording.startsWith('http');
    const link = isUrl ? p.clarityRecording : `https://clarity.microsoft.com/player/qo6gcqjdc7/${p.clarityRecording}`;
    rows.push(['Clarity Recording', `<a href="${link}" style="color:#2563eb">View Recording</a>`]);
  }
  if (p.timezone) rows.push(['Likely Timezone', p.timezone]);
  if (p.submittedAt) rows.push(['Submitted', p.submittedAt]);
  rows.push(['Receipt #', data.receiptId]);
  
  // Build HTML table
  const tableRows = rows.map(([label, value], i) => 
    `<tr style="background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:600;color:#374151;width:30%;font-size:14px;vertical-align:top;white-space:nowrap">${label}</td>
      <td style="padding:10px 14px;border:1px solid #e5e7eb;color:#111827;font-size:14px">${value}</td>
    </tr>`
  ).join('');
  
  const tierColor = data.qualityTier === 'A Lead' ? '#16a34a' : data.qualityTier === 'B Lead' ? '#2563eb' : data.qualityTier === 'C Lead' ? '#d97706' : '#ef4444';
  
  return `
    <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0 0 4px;font-size:18px">New Lead Received</h2>
        <p style="margin:0;font-size:14px;opacity:0.85">
          ${p.fullName || 'Unknown'} ${p.companyName ? `| ${p.companyName}` : ''} 
          <span style="display:inline-block;background:${tierColor};color:white;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;margin-left:8px">${data.qualityTier || 'Unscored'} — ${data.score ?? 'N/A'}</span>
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
        ${tableRows}
      </table>
      <div style="padding:14px 18px;background:#f3f4f6;border-radius:0 0 8px 8px;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0;font-size:12px;color:#6b7280">
          ACB Lead Console — <a href="https://www.advancedcb.app/leads" style="color:#2563eb">View in Dashboard</a>
        </p>
      </div>
    </div>
  `;
}
```

### Important: Pass the NormalizedPayload Type

The email service needs access to the NormalizedPayload interface. Either:
- Export the NormalizedPayload interface from ingestion-pipeline.service.ts and import it in the email service
- Or duplicate the interface in the email service
- Or pass the normalized data as a Record<string, unknown> and access fields by name

The key is that the email service must receive ALL the original form fields, not just a subset.

## Implementation Order

1. Fix the ingestion to be synchronous (route.ts change) — this fixes the 404 error
2. Add the lead detail page fallback for pending items — defense in depth
3. Update the email builder to include ALL fields
4. Update the sendLeadNotificationEmail call to pass the full normalized payload
5. Test by submitting a form and verifying:
   - Lead appears immediately in inbox (no 404 on click)
   - Email contains ALL fields in the correct order
   - Both email addresses receive the notification