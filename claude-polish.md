Three fixes/features needed. Read all, then plan and implement.

## FEATURE 1: Live Connection Monitoring Tab (Admin Only)

Create a new admin-only page accessible from the sidebar: "Live Monitor" or "Ingestion Monitor"

### Active Form Sessions (Real-Time)

Show a live view of people currently filling out the intake form:

- When a partial lead submission comes in via POST /api/leads/partial, it means someone is actively on the form
- Display a table/list of active sessions:
  - Session ID (abbreviated)
  - Name (if captured yet)
  - Company (if captured yet)
  - Email (if captured yet)
  - Current Step (which step they're on based on partial_step)
  - Time on Form (how long since form_started_at)
  - Started At (EST)
  - Status indicator: green dot = actively progressing (partial updated in last 2 min), yellow = idle (2-5 min since last update), gray = likely abandoned (5+ min)
- Auto-refresh every 10 seconds
- Sessions disappear from the "active" list when:
  - A full submission is received (move to "Recently Completed" section below)
  - 15 minutes of inactivity (move to "Abandoned" section)

### Recently Completed Submissions

Below the active sessions, show the last 20 completed submissions:
- Receipt ID
- Name / Company
- Score / Tier (once processed)
- Submitted At (EST)
- Processing Status (received → processing → completed / failed)
- Time to process
- Click to open lead detail page

### Abandoned Sessions

Below completed, show sessions that started but never submitted (partial leads):
- Session info (name, email if captured)
- Last step completed
- Time spent on form before abandoning
- "Create Lead" button to manually promote the partial to a full lead for follow-up

### Connection Health Panel (top of page)

- API status: green/red indicator with last health check timestamp
- Ingestion queue depth
- Processing rate (leads/hour)
- Last successful submission timestamp
- Failed submissions in last 24h (count, clickable to see details)
- FormSubmit.co backup triggers in last 24h (count — if this is >0, something is wrong with the primary path)

### Form-Side Changes Needed

For the live monitoring to work, the form needs to send periodic heartbeats while the user is active. Add to the form:
- When the form is loaded, POST to /api/leads/partial with partial_step "form_opened" and just the session_id and metadata (no fields yet) — this registers the session
- The existing partial submissions on step completion already feed the active sessions list
- Optionally: send a heartbeat ping every 30 seconds to a new endpoint POST /api/leads/heartbeat with just the session_id — this keeps the "active" status green

### New API Endpoint: POST /api/leads/heartbeat

Lightweight endpoint, just updates the last_seen_at on the session:
```json
{
  "session_id": "uuid"
}
```
Response: `{ "ok": true }`

Rate limit: 2 per minute per session_id. No auth needed but CORS restricted.

### Data Model

Add to ingestion_queue or create a new table:

If using ingestion_queue:
- Add field: last_heartbeat_at (timestamp, nullable)
- Add field: form_opened_at (timestamp, nullable)
- Add field: user_agent (string, nullable) — already in metadata but denormalize for easy display
- Add field: ip_address (string, nullable)

Or create a new `form_sessions` table:

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| session_id | uuid | Unique, matches form session_id |
| status | string | active, completed, abandoned |
| current_step | string (nullable) | Last partial_step received |
| fields_captured | jsonb | Accumulated partial fields |
| metadata | jsonb | Form metadata (referrer, UA, etc.) |
| ip_address | string (nullable) | |
| form_opened_at | timestamp | When form was first loaded |
| last_heartbeat_at | timestamp | Last heartbeat or partial update |
| completed_at | timestamp (nullable) | When full submission was received |
| lead_id | uuid (nullable) | FK to leads if converted |
| created_at | timestamp | |
| updated_at | timestamp | |

### Permissions

- Only Admin and Manager roles can access the Live Monitor page
- The page should be clearly labeled as an admin tool

---

## BUG FIX 2: Scoring Rules Not Running on New Submissions

New leads coming in from the form are not getting scored. Debug and fix:

### Likely Causes

1. **Multi-state array handling breaking the scoring engine**: If a lead has many states selected (stored as a JSON array), the scoring rules that reference state might be failing because they expect a single string, not an array. Check:
   - How the scoring engine evaluates state-based rules
   - Whether the rule condition checks like "state = Florida" work when state is ["Florida", "Georgia", "Alabama", "Mississippi", ...]
   - The scoring engine needs to handle array fields: "if ANY value in the state array matches the condition" for positive rules, and "if ALL values" or "if X% of values" for negative/DQ rules

2. **Field mapping mismatch**: The new ingestion pipeline might be mapping form fields to different names than what the scoring rules expect. Check:
   - What field names the scoring rules reference
   - What field names the processed lead actually has
   - Make sure the field mapping from form → lead record produces the exact field names the scoring rules look for

3. **Processing pipeline error**: The scoring step might be throwing an error silently. Check:
   - The ingestion_queue — are submissions completing or failing?
   - The error_message field on any failed queue entries
   - Server logs for errors during lead processing

### Fix Requirements

- After identifying the issue, fix it
- Manually re-run scoring on any existing leads that are missing scores (add a "Recalculate All Scores" button in admin settings if one doesn't exist)
- Add error logging to the scoring engine so that if a rule fails to evaluate, it logs the rule name, the field value that caused the failure, and the error — rather than silently failing
- Ensure the scoring engine gracefully handles:
  - null/undefined field values (skip the rule, don't crash)
  - Array field values (iterate and check if any/all match)
  - Empty strings (treat as null)
  - Unexpected data types (log warning, skip rule)
- After fixing, test by submitting a new form with multiple states selected and verify it scores correctly

---

## FEATURE 3: Formatted Lead Data Table in Activity Timeline

When a new lead is created (whether from full submission or partial promotion), add a "Lead Submission Data" entry to the activity timeline that displays ALL captured form data in a clean, formatted table.

### Activity Log Entry

Event type: `lead_data_received`
This should be the FIRST entry in the timeline (at the bottom, since the timeline is newest-first, or at the very beginning of the lead's history).

### Table Format

Display as a clean two-column table (field label | value) inside the activity timeline entry. The table should be collapsible (default: collapsed with a "View Submission Data" toggle, or show a preview of the first few fields).

Order the fields EXACTLY as follows:

| Label | Source Field | Display Notes |
|---|---|---|
| Name | full_name or first_name + last_name | |
| Company | company_name | |
| Email | email | Clickable mailto link |
| Phone | phone | Clickable tel link |
| Website | website | Clickable link, or "None provided" |
| Debt Types | debt_type / service_requested | Show as pills if multiple |
| Debts Ready Now | debts_ready | "Yes" / "No" / value as submitted |
| Prior Collection Agency | prior_agency | "Yes" / "No" / value as submitted |
| States | state | Show as colored pills (green/red per state config) |
| Ownership | ownership / business_type | Only show if residential path — hide row entirely if empty/null |
| Total Units | account_volume / total_units | Only show if residential path |
| Rental Types | rental_types | Only show if residential path — show as pills if multiple |
| Property Types | property_types | Only show if residential path — show as pills if multiple |
| Avg Rent / Unit | avg_rent / balance_amount | Format as currency ($X,XXX/mo) — only show if residential path |
| Listing Sites | listing_locations | Only show if residential path — show as pills if multiple |
| PM Software | pm_software | Only show if residential path — show as pills if multiple |
| Comments | notes_from_form / comments | Display in a quote block style, preserve line breaks |
| Location / IP | ip_address from metadata | Show city/state if IP geolocation is available, otherwise just IP |
| Device | user_agent from metadata | Parse into readable format: "Chrome on Windows" or "Safari on iPhone" — use a UA parser library |
| Referrer | referrer from metadata | Show as clickable link if it's a URL, or "Direct" if empty |
| Clarity Recording | clarity_session_id or recording URL from metadata | If Microsoft Clarity session data is available, link to it. Format: clickable link "View Recording". If not available, show "Not available" |
| Likely Timezone | Derive from IP geolocation or form metadata | If available. Otherwise "Unknown" |
| Submitted (EST) | created_at or submitted_at | Format: "March 15, 2026 at 3:46 PM EST" |

### Styling

- The table should have alternating row backgrounds for readability (very subtle — var(--color-background-secondary) on every other row)
- Labels column: 30% width, muted text color, right-aligned or left-aligned consistently
- Values column: 70% width, normal text color
- "Residential path only" rows should simply not appear if those fields are empty/null — don't show "N/A" for fields that don't apply
- Pills (for states, debt types, etc.) should use the same pill styling as elsewhere in the app
- Comments section should be visually distinct — use a left-border quote block style with slightly different background
- The whole table should be inside a collapsible section in the timeline with header: "📋 Original Submission Data" and a toggle arrow

### IP Geolocation (Best Effort)

For Location / IP and Likely Timezone:
- Capture the IP address server-side in the ingestion endpoint (from the request headers — X-Forwarded-For or req.ip)
- Use a free IP geolocation service (ip-api.com, or ipinfo.io free tier) to look up city/state/timezone at ingestion time
- Store the geolocation result in the lead's metadata
- If geolocation fails, just show the raw IP address — don't block lead creation
- Rate limit geolocation lookups to avoid hitting API limits

### User Agent Parsing

- Use a lightweight UA parser (ua-parser-js npm package, or a simple regex-based parser)
- Convert user agent strings into readable format:
  - "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0" → "Chrome 122 on Windows 10"
  - "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) Safari/605.1.15" → "Safari on iPhone (iOS 17.3)"
- Parse at ingestion time, store the readable version

### Clarity Recording Link

- The form already has Microsoft Clarity installed (project ID: qo6gcqjdc7)
- Clarity assigns a session ID that can be used to link to the recording
- In the form, capture the Clarity session ID if available: `window.clarity('get', 'sessionId', callback)` or check `window.clarity.q` for session data
- Pass the Clarity session ID in the form metadata
- In the submission data table, construct the recording link: `https://clarity.microsoft.com/player/{projectId}/{sessionId}`
- If the Clarity session ID is not available (ad blockers, etc.), show "Not available"

### Retroactive Application

- For existing leads that were created before this feature, the submission data table won't appear in their timeline (no lead_data_received event exists)
- For leads that DO have raw_payload_json stored, add a migration or one-time script that creates the lead_data_received event from the stored raw payload
- Going forward, every new lead (full and partial) gets this event automatically

### Form-Side Changes

Add to the form submission metadata:
- Clarity session ID (if available)
- Screen resolution
- Browser language
- The form already sends user_agent and referrer — verify these are being captured

Implement in this order:
1. Scoring bug fix (critical — leads need to be scored)
2. Submission data table in activity timeline (high visibility, improves lead review)
3. Live monitoring page (admin feature, can be built in parallel)