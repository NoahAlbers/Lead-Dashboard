# ACB Lead Operations Console — Operational Features PRD

## Document Purpose

This PRD defines eleven operational features that improve daily workflow efficiency, reporting depth, and strategic visibility. These features are independent of each other and can be built in any order, though the suggested implementation order minimizes wasted effort.

Read this entire document before writing any code. Plan the implementation, then build.

---

# Feature 1: Bulk Actions on Lead Inbox

## Overview

Staff need to perform actions on multiple leads simultaneously. Selecting 10 leads and assigning them all to one person, or changing 15 leads to "Disqualified" at once, should take one action — not fifteen individual clicks.

## UI Requirements

### Row Selection

- Add a checkbox to each row in the lead inbox table (leftmost column)
- Add a "Select All" checkbox in the column header that selects/deselects all visible leads on the current page
- Selected rows should have a subtle highlight (light blue or primary tint background)
- Show a count of selected leads near the top: "3 selected"
- Selection should persist while scrolling within the current page
- Selection clears when navigating to a different page, applying a new filter, or performing a bulk action

### Bulk Action Bar

When one or more leads are selected, show a sticky action bar at the top of the table (below the filter row, above the column headers). The bar should contain:

**Actions available:**

1. **Assign to...** — Dropdown of active staff members. Selecting a user assigns ALL selected leads to that person. Each assignment is individually logged in activity history.

2. **Change Status** — Dropdown of all available statuses. Selecting a status changes ALL selected leads. Each status change is individually logged. If changing to a terminal status (Won, Lost, Disqualified), DO trigger the win/loss reason prompt (Feature 8) for each lead — show a batch modal that lets the user set the reason for all at once or individually.

3. **Mark as Read / Mark as Unread** — Toggle based on current selection. If mixed, show both options.

4. **Export Selected** — Two sub-options:
   - "Export as CSV" — generates a CSV of just the selected leads with all visible columns
   - "Export for Act! CRM" — generates the Act!-formatted CSV for just the selected leads

5. **Delete Selected** — Soft delete or archive. Requires confirmation modal: "Are you sure you want to delete 7 leads? This action can be undone by an admin." Manager/admin only.

6. **Bulk Add Note** — Opens a note input modal. The same note text is added to ALL selected leads, each with its own activity log entry.

### Keyboard Support

- `Ctrl+A` / `Cmd+A` when focused on the table: select all visible leads
- `Escape`: deselect all
- Shift+click: range select (select all rows between last clicked and current click)

### Permissions

- All roles can select and export
- Assign, change status, and bulk note require Intake Staff or higher
- Delete requires Manager or Admin

## Data Considerations

- Bulk operations should be performed as database transactions where possible
- If a bulk operation partially fails (e.g., 8 of 10 succeed), show which ones failed and why
- Each individual lead's activity log must reflect the change — never log "bulk action" as a single event on one lead. Every lead gets its own log entry.
- For large selections (50+ leads), process asynchronously with a progress indicator

---

# Feature 2: Lead Aging Indicators

## Overview

A visual indicator on each lead in the inbox showing how old it is. This is distinct from SLA tracking — SLA measures time-to-action against a deadline, aging shows overall freshness regardless of actions taken. A 5-day-old lead that's been contacted still looks "old" from an aging perspective, which is useful context.

## Aging Calculation

- Age = time since `created_at` in calendar days (not business days — aging is about freshness, not SLA compliance)
- Calculate in real-time, not stored

## Visual Display

### Inbox Column

Add an "Age" column to the lead inbox (toggleable via column settings, on by default). Display as a colored badge:

| Age | Label | Color |
|---|---|---|
| Today (0 days) | Today | Green |
| 1 day | 1d | Green |
| 2 days | 2d | Light green |
| 3 days | 3d | Yellow/amber |
| 4-5 days | 4d / 5d | Orange |
| 6-7 days | 6d / 7d | Red |
| 8-14 days | Xd (e.g., "10d") | Dark red |
| 15+ days | Xd (e.g., "23d") | Dark red with bold/emphasis |

### Color Thresholds

Make the aging color thresholds admin-configurable in Settings under a new "Lead Aging" section:
- Green threshold: 0-X days (default: 0-2)
- Yellow threshold: X-Y days (default: 3-4)
- Orange threshold: Y-Z days (default: 5-6)
- Red threshold: Z+ days (default: 7+)

### Sorting and Filtering

- The Age column should be sortable (oldest first / newest first)
- Add an age range filter to the filter bar: "Older than X days"
- Add default saved views: "Aging Leads (7+ days)" and "Fresh Leads (< 3 days)"

### Inbox Stat Widget

Add "Aging Leads" as an available widget option for the customizable stat boxes:
- Count of leads older than the red threshold that are NOT in a terminal status
- Optional mini sparkline showing aging distribution

---

# Feature 3: Shared Saved Views (Team Views)

## Overview

Currently saved views are per-user. Managers need the ability to create views that appear for the entire team, ensuring everyone is working from the same filters.

## View Types

### Personal Views (existing)
- Created by any user
- Visible only to the creator
- Editable/deletable by the creator
- Labeled with a "Personal" indicator

### Team Views (new)
- Created by Managers or Admins only
- Visible to ALL active users
- Editable only by Managers/Admins
- Labeled with a "Team" indicator (e.g., small people icon or "Team" badge)
- Cannot be deleted by non-admin users
- Can be hidden by individual users (they can dismiss it from their view list, but it's not deleted)

## Data Model Changes

### Modify `saved_views` table:

Add these fields:

| Field | Type | Description |
|---|---|---|
| is_team_view | boolean | Default false. If true, visible to all users |
| created_by_role | string | Role of the creator at time of creation |
| hidden_by_users | json | Array of user IDs who have hidden this team view |

## UI Requirements

### Saved Views List

- Show two sections in the saved views panel/dropdown:
  1. **Team Views** (at top, with "Team" badge) — ordered by sort_order or name
  2. **My Views** (below, with "Personal" badge) — ordered by user preference
- Team views show a small team/people icon
- Personal views show a user icon

### Creating a Team View

- When a Manager/Admin saves a new view, show a toggle: "Share with team" (default off)
- If toggled on, the view becomes a team view
- Manager can also convert an existing personal view to a team view (and vice versa) via edit

### Hiding Team Views

- Non-admin users can right-click or click a "..." menu on a team view and select "Hide this view"
- Hidden team views can be restored from a "Hidden Views" section in settings or at the bottom of the views list
- Hiding is per-user and does not affect other users

### Default Team Views (pre-seeded)

Ensure these are created as team views during initial setup:
- New Today
- New This Week
- Uncontacted
- High Score Leads
- Referral Candidates
- Duplicates
- Follow-Up Needed
- My Assigned Leads (this one is special — it dynamically filters to the current user's assignments)
- SLA At Risk
- Aging Leads (7+ days)

---

# Feature 4: Activity Log Export

## Overview

Export a date range of all lead activity across the system as a CSV or PDF for compliance, auditing, or management reporting.

## Export Options

### Access Point

- Add an "Export Activity Log" button on the Reports Dashboard
- Also accessible from Admin Settings under a new "Data Export" section

### Configuration Modal

When clicked, show a modal with:

1. **Date Range** — Start date and end date pickers (required)
2. **Scope** — Radio buttons:
   - All leads
   - Specific leads (search and select)
   - Leads assigned to specific user (dropdown)
   - Leads matching current inbox filter
3. **Event Types** — Multi-select checkboxes:
   - All events (default)
   - Or select specific types: status changes, notes added, emails initiated, calls initiated, referrals, CRM exports, score calculations, assignments, duplicate flags, merges
4. **Format** — Radio buttons:
   - CSV (for spreadsheet analysis)
   - PDF (for formal reporting/filing)
5. **Include** — Checkboxes:
   - Lead details (name, company, score, status with each event)
   - User who performed the action
   - Event metadata/details
   - Timestamps

### CSV Format

Columns:
- Timestamp (EST)
- Lead ID
- Company Name
- Contact Name
- Event Type
- Event Description
- Performed By
- Lead Status (at time of event)
- Lead Score (at time of event)
- Additional Data (JSON or flattened key details)

### PDF Format

- Header: "ACB Lead Operations Console — Activity Report"
- Date range and filters applied
- Summary stats: total events, events by type, events by user
- Table of events (same columns as CSV but formatted)
- Page numbers and generation timestamp in footer
- Company logo in header

### Permissions

- Manager and Admin roles can export all activity
- Intake Staff can only export activity for their own assigned leads

---

# Feature 5: Lead Enrichment / Research Actions

## Overview

A quick way to research a company or contact from the lead detail page, with a structured way to log findings.

## Research Action Buttons

Add a "Research" section to the lead detail page (in the right action column or as a collapsible section). Include quick-launch buttons:

1. **Google Search: Company** — Opens new tab: `https://www.google.com/search?q={company_name}`
2. **Google Search: Contact** — Opens new tab: `https://www.google.com/search?q={first_name}+{last_name}+{company_name}`
3. **LinkedIn: Company** — Opens new tab: `https://www.linkedin.com/search/results/companies/?keywords={company_name}`
4. **LinkedIn: Contact** — Opens new tab: `https://www.linkedin.com/search/results/people/?keywords={first_name}+{last_name}`
5. **Google Maps: Address** — Opens new tab with the lead's address (if available)
6. **Company Website** — Opens the lead's website field in a new tab (if populated)
7. **Better Business Bureau** — Opens: `https://www.bbb.org/search?find_text={company_name}`

All search URLs should be URL-encoded properly.

## Research Notes

After researching, the user needs a structured way to log what they found. Add a "Log Research" quick action that opens a modal:

### Research Log Modal

- **Source** — Dropdown: Google, LinkedIn, BBB, Website, Phone Call, Other
- **Company Verified** — Toggle: Yes / No / Unclear
- **Contact Verified** — Toggle: Yes / No / Unclear
- **Key Findings** — Text area for free-form notes
- **Estimated Company Size** — Dropdown: 1-10 employees, 11-50, 51-200, 200+, Unknown
- **Red Flags** — Multi-select: None, Complaints found, No web presence, Possible fraud, Business closed, Other
- **Recommendation** — Dropdown: Proceed as normal, Proceed with caution, Do not proceed, Needs more research
- **Save** button

### Data Storage

Research logs should be stored as a special type of note/event in the activity log:
- Event type: `research_completed`
- Event data contains the structured fields above
- Visible in the activity timeline with a distinct research icon
- Searchable by recommendation and red flags

### Lead Detail Display

If research has been completed, show a small summary on the lead detail page:
- "Research: ✅ Verified" or "Research: ⚠ Proceed with caution" or "Research: 🔍 Not yet researched"
- Click to expand and see full research notes

---

# Feature 6: Dashboard Auto-Refresh

## Overview

The Lead Inbox and Reports Dashboard should automatically refresh data on a regular interval so staff always see current information without manually reloading the page.

## Implementation

### Lead Inbox Auto-Refresh

- Poll the leads API every **30 seconds** for changes
- When new data arrives:
  - Update the lead table without losing scroll position, selection state, or filter state
  - If new leads have appeared, show a subtle toast/banner at the top: "2 new leads — Click to refresh" (don't force-refresh the table, let the user choose when to load new rows to avoid disrupting their workflow)
  - Update stat widget counts automatically
  - Update the unread count and favicon
- If the user is actively typing in the search bar or has a modal open, defer the refresh until they're done

### Reports Dashboard Auto-Refresh

- Poll every **60 seconds** for updated data
- Refresh all chart data and stat cards silently
- Charts should animate smoothly to new values (not flash/jump)
- If the user is configuring a widget or dragging/resizing, defer the refresh

### User Control

- Add a refresh indicator in the top bar or near the page title: small subtle text "Updated 15s ago" that ticks up
- Add a manual refresh button (circular arrow icon) next to it for immediate refresh
- In user settings (My Settings), add an auto-refresh toggle:
  - On/Off (default: On)
  - Refresh interval: 15s / 30s / 60s / 120s (default: 30s for inbox, 60s for reports)
- Auto-refresh should pause when the browser tab is not visible (use Page Visibility API) to save resources
- Resume immediately when the tab becomes visible again

### Technical Implementation

- Use React Query, SWR, or a simple `setInterval` + `fetch` pattern
- The polling endpoint should support a `since` timestamp parameter to return only changes after the last poll, reducing payload size
- Use ETags or timestamps to avoid processing unchanged data
- SSE connection (if already built for notifications) can also trigger inbox refreshes when new leads arrive — this provides near-instant updates without polling

---

# Feature 7: Print / Export Lead Detail as PDF

## Overview

Generate a clean, professional one-page PDF summary of any lead for external sharing, filing, or printing.

## Trigger

- Add a "Print / Export PDF" button to the lead detail page actions panel
- Also available as a quick action icon in the inbox table row

## PDF Content

The PDF should be a single page (or two pages max for leads with extensive notes) containing:

### Header
- ACB logo (top left)
- "Lead Summary Report" title
- Generated date/time
- Generated by (user name)

### Lead Identity Section
- Contact name, company name
- Email, phone, alternate phone
- Address (full, if available)
- Website
- States (with good/bad indicators as text: "Florida (Target)" or "California (Restricted)")

### Portfolio / Business Details
- Total units, avg rent, ownership
- Property types, rental types
- Listing sites, PM software
- Debt types, service requested
- Balance amount / estimated claim value
- Debts ready, prior agency experience

### Qualification Summary
- Score and quality tier
- Applied scoring rules with point values
- Recommended action
- Referral recommendation (if any)

### Current Status
- Status
- Assigned user
- SLA status
- Lead age
- CRM export status

### Activity Summary (condensed)
- Last 10 activity events (type, date, user, brief description)
- Total note count
- "Full activity log available in the system"

### Lead Comments
- The original form submission comments/notes

### Footer
- "Confidential — Advanced Collection Bureau, Inc."
- Page number
- System-generated disclaimer

## Technical Implementation

- Generate the PDF server-side using a library (e.g., Puppeteer rendering an HTML template, or jsPDF, or react-pdf)
- The PDF should be downloadable and also openable in a new browser tab for quick printing
- Style should match ACB branding — clean, professional, not overly designed
- Ensure all data is current at the time of generation
- Log a `lead_pdf_exported` event in the activity log

---

# Feature 8: Win/Loss Analysis

## Overview

When a lead reaches a terminal status (Won, Lost, Disqualified, Referred Out), prompt the user for a reason. Over time this builds a dataset that reveals why leads are or aren't converting.

## Trigger

Whenever a lead's status is changed to one of these terminal statuses — whether via the lead detail page, quick action, bulk action, or disposition flow — show a reason prompt BEFORE finalizing the status change.

## Reason Prompt Modal

### For "Won" Status:

**"What made this a win?"**

- **Won Reason** — Dropdown (admin-configurable, pre-seeded defaults):
  - Good fit — service match
  - Good fit — geographic match
  - Good fit — claim size match
  - Competitive pricing
  - Fast response time
  - Existing relationship
  - Referral from partner
  - Other (free text)
- **Estimated Contract Value** — Currency input (optional but encouraged)
- **Estimated Annual Revenue** — Currency input (optional)
- **Account Volume** — Number input (how many accounts being placed)
- **Notes** — Free text (optional)
- **Won Date** — Date picker, defaults to today

### For "Lost" Status:

**"Why did we lose this lead?"**

- **Lost Reason** — Dropdown (admin-configurable, pre-seeded defaults):
  - Chose competitor
  - Price too high
  - Service not available in their area
  - Claim size too small for us
  - Claim size too large for us
  - Lead went unresponsive
  - Timing — not ready yet
  - Bad fit — wrong service type
  - Bad data / incomplete lead
  - Other (free text)
- **Competitor** — Text input (who did they go with, if known)
- **Notes** — Free text (optional)
- **Could we have won this?** — Radio: Yes / Maybe / No
- **Lost Date** — Date picker, defaults to today

### For "Disqualified" Status:

**"Why is this lead being disqualified?"**

- **Disqualification Reason** — Dropdown (admin-configurable, pre-seeded defaults):
  - Spam / test submission
  - Duplicate (should be merged instead)
  - Invalid contact information
  - Outside service territory — no partner fit
  - Consumer debt only — not our market
  - Too small — below minimum threshold
  - Not a real business
  - Compliance concern
  - Other (free text)
- **Notes** — Free text (optional)

### For "Referred Out" Status:

**"Referral details"**

- **Referral Partner** — Dropdown of referral partners (should auto-populate if referral email was already sent)
- **Reason for Referral** — Dropdown (admin-configurable):
  - Outside our geography
  - Outside our service niche
  - Claim size doesn't fit
  - Legal matter — needs attorney
  - Better fit for partner's specialty
  - Client preference
  - Other (free text)
- **Estimated Value Being Referred** — Currency input (the estimated balance/claim value of the referred lead — this feeds into Feature 9: Revenue Attribution)
- **Notes** — Free text (optional)

## Data Model Changes

### New table: `lead_outcomes`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| outcome_type | string | won, lost, disqualified, referred_out |
| reason | string | Selected reason from dropdown |
| reason_detail | string (nullable) | Free text for "Other" or additional detail |
| competitor | string (nullable) | For lost leads — who they chose |
| could_have_won | string (nullable) | yes/maybe/no — for lost leads |
| estimated_value | decimal (nullable) | Contract value (won) or referred value (referred) |
| estimated_annual_revenue | decimal (nullable) | For won leads |
| account_volume | integer (nullable) | Number of accounts |
| referral_partner_id | uuid (nullable) | FK — for referred out leads |
| notes | text (nullable) | |
| outcome_date | date | When the outcome occurred |
| recorded_by_user_id | uuid | Who recorded the outcome |
| created_at | timestamp | |

### New table: `outcome_reasons` (admin-configurable)

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| outcome_type | string | won, lost, disqualified, referred_out |
| reason_text | string | The reason label |
| sort_order | integer | Display order |
| active | boolean | Default true |
| created_at | timestamp | |

## Admin Configuration

Add "Outcome Reasons" section in Admin Settings:
- Four tabs: Won / Lost / Disqualified / Referred Out
- Each tab shows a sortable list of reasons
- Add, edit, reorder, deactivate reasons
- Cannot delete reasons that have been used (deactivate instead)

## Reporting

Add to the Reports Dashboard as available widgets:

1. **Win/Loss Ratio** — Donut chart: Won vs Lost vs Disqualified vs Referred (for leads that have reached terminal status)
2. **Loss Reasons** — Bar chart: top reasons leads are lost
3. **Disqualification Reasons** — Bar chart: top DQ reasons
4. **Win Rate Trend** — Line chart: win rate (Won / (Won + Lost)) over time by month
5. **Average Deal Value** — Stat card: average estimated_value for Won leads
6. **Could Have Won** — Pie chart: Yes / Maybe / No breakdown for lost leads

---

# Feature 9: Revenue Attribution Per Referral Partner

## Overview

Track the estimated value of leads being sent to each referral partner. This doesn't require tracking actual conversion outcomes at the partner — it tracks what ACB is *sending* to each partner in terms of potential value.

## Data Sources

The estimated value comes from two places:
1. The lead's `balance_amount` or `estimated_claim_value` field (set at ingestion)
2. The `estimated_value` field in `lead_outcomes` when status is Referred Out (set manually during the win/loss prompt — Feature 8)

Use the `lead_outcomes.estimated_value` if available (more accurate, manually confirmed), fall back to the lead's `balance_amount` or `estimated_claim_value`.

## Referral Partner Analytics

### Partner Scorecard

Add a "Performance" tab or section to each Referral Partner's detail page showing:

- **Total Leads Referred**: count of leads referred to this partner (all time, this month, this quarter, this year — with date range selector)
- **Total Estimated Value Referred**: sum of estimated values for leads referred to this partner
- **Average Lead Value**: average estimated value per referred lead
- **Referral Reasons Breakdown**: bar chart of why leads were referred to this partner (geography, service fit, size, etc.)
- **Lead Quality Breakdown**: how many A/B/C/Poor Fit leads have been referred to this partner
- **Referral Timeline**: line chart showing referral volume over time (monthly)
- **States Referred**: which states the referred leads came from

### Referral Partner Comparison View

Add a new report widget or dedicated page accessible from Reports:

- **Table/leaderboard** of all active referral partners ranked by total estimated value referred
- Columns: Partner Name, # Leads Referred, Total Est. Value, Avg Lead Value, Top Referral Reason, Last Referral Date
- Sortable by any column
- Date range filter
- Export as CSV

### Referral Value on Lead Detail

On the lead detail page, when a lead is referred out:
- Show the estimated value being referred prominently
- Show which partner received the referral
- Show the referral reason

## Data Model Notes

No new tables needed — this feature reads from `lead_outcomes` (Feature 8), `leads`, and `referral_partners`. The key query is:

```
SELECT rp.name, COUNT(*) as lead_count, SUM(lo.estimated_value) as total_value
FROM lead_outcomes lo
JOIN referral_partners rp ON lo.referral_partner_id = rp.id
WHERE lo.outcome_type = 'referred_out'
GROUP BY rp.id
```

---

# Feature 10: Scoring Rule Effectiveness Analysis

## Overview

Track which scoring rules correlate with leads that actually convert to Won. Over time, surface insights that help admins tune scoring weights for better lead prioritization.

## How It Works

### Data Collection

For every lead, the system already stores which scoring rules were applied and their point values. When a lead reaches a terminal outcome (Won, Lost, Disqualified), we can look back at which rules fired for that lead.

The analysis compares:
- Rules that fired on Won leads vs. rules that fired on Lost/DQ leads
- Conversion rate for leads where a specific rule fired vs. leads where it didn't

### Key Metrics Per Rule

For each scoring rule, calculate:

1. **Times Fired**: How many leads triggered this rule (all time and by date range)
2. **Conversion Rate When Fired**: Of leads where this rule fired, what % reached Won status?
3. **Conversion Rate When NOT Fired**: Of leads where this rule did NOT fire, what % reached Won?
4. **Lift**: Conversion rate when fired ÷ conversion rate when not fired. A lift of 2.0 means leads matching this rule convert at 2x the rate.
5. **Estimated Value When Fired**: Average estimated_value of Won leads where this rule fired
6. **Correlation Score**: A simple score (high/medium/low) indicating how predictive this rule is of winning

### Minimum Sample Size

- Don't show lift or correlation metrics until at least 20 leads have reached a terminal outcome where the rule fired
- Show "Insufficient data" with the current sample count until the threshold is met

## UI: Scoring Rules Analytics Page

Add a "Rule Analytics" tab or section to the Scoring Rules admin page:

### Rule Effectiveness Table

| Rule Name | Points | Times Fired | Win Rate | Lift | Avg Won Value | Signal |
|---|---|---|---|---|---|---|
| Florida target market | +15 | 47 | 38% | 1.8x | $45,000 | Strong positive |
| Commercial debt | +20 | 62 | 42% | 2.1x | $52,000 | Strong positive |
| Debts ready to place | +10 | 35 | 51% | 2.5x | $61,000 | Strong positive |
| Outside target geography | -15 | 28 | 12% | 0.4x | $18,000 | Confirms negative |
| Contact info complete | +10 | 89 | 28% | 1.1x | $38,000 | Weak signal |

- Sortable by any column
- Color-coded Signal column:
  - **Strong positive**: Green — high lift, high win rate. This rule is doing its job well.
  - **Weak signal**: Gray — lift near 1.0, rule doesn't meaningfully predict outcomes. Consider adjusting weight.
  - **Confirms negative**: Red — low win rate when fired, which is correct for a negative-point rule.
  - **Misleading**: Orange — a positive-point rule with lift below 1.0 (the rule adds points but leads matching it actually convert LESS). This is the most actionable signal — the rule may need to be revised.

### Automated Insights Panel

Below the table, show a panel with plain-English recommendations generated from the data:

**Example insights:**
- "**Debts ready to place** (+10) has the highest lift at 2.5x. Leads matching this rule convert to Won 51% of the time. Consider increasing its weight from +10 to +15 or +20."
- "**Contact info complete** (+10) has a lift of only 1.1x — it barely predicts conversions. Most leads have complete contact info, so this rule isn't differentiating. Consider reducing its weight or removing it."
- "**Outside target geography** (-15) confirms its intent — leads matching it convert at only 12%. The -15 penalty appears appropriate."
- "**Small claim size** (-20) has only 8 terminal outcomes — insufficient data for analysis. Check back when more leads with this rule have reached an outcome."

### Logic for Generating Insights

For each rule:
1. If positive-point rule AND lift > 1.5: suggest it's working well, optionally suggest increasing weight if lift is very high (>2.0)
2. If positive-point rule AND lift < 1.0: flag as "Misleading" — the rule is awarding points for something that doesn't predict success
3. If positive-point rule AND lift between 1.0-1.5: flag as "Weak signal" — rule is marginally useful
4. If negative-point rule AND win rate < 20%: confirm it's working as intended
5. If negative-point rule AND win rate > 30%: flag as possibly too harsh — leads matching it still convert frequently
6. If sample size < 20 terminal outcomes: show "Insufficient data" message

### Date Range Filter

- Allow filtering the analysis by date range
- Default: all time
- Useful for seeing if rule effectiveness has changed over time

## Data Model

No new tables needed. This feature queries:
- `scoring_rules` — the rules themselves
- `lead_events` — where score calculations are logged with which rules fired (this data should already be in event_data_json for score_calculated events)
- `lead_outcomes` — terminal outcomes
- `leads` — lead data

The key is that score calculation events already store which rules fired. The analysis joins this against outcomes.

**Important**: Verify that score calculation events store an array of fired rules with their individual point values in `event_data_json`. If they only store the final score, the events need to be enriched to include the rule breakdown. Check the current schema and fix if needed.

---

# Feature 11: Keyboard Shortcuts

## Overview

Power users working through leads quickly benefit enormously from keyboard shortcuts. Small time savings per lead multiply across hundreds of leads.

## Shortcut Map

### Global Shortcuts (work anywhere in the app)

| Shortcut | Action |
|---|---|
| `G` then `I` | Go to Lead Inbox |
| `G` then `R` | Go to Reports |
| `G` then `A` | Go to Assignments |
| `G` then `S` | Go to Admin Settings |
| `/` or `Ctrl+K` | Focus the search bar |
| `?` | Show keyboard shortcuts help modal |
| `Esc` | Close any open modal/panel, or deselect all |

### Lead Inbox Shortcuts

| Shortcut | Action |
|---|---|
| `J` / `K` or `↓` / `↑` | Move selection down/up in the table |
| `Enter` or `O` | Open the selected lead's detail page |
| `X` | Toggle checkbox on the selected row |
| `Shift+X` | Range-select from last selected to current |
| `R` | Mark selected lead as read/unread toggle |
| `W` | Enter Working Leads mode |

### Lead Detail Page Shortcuts

| Shortcut | Action |
|---|---|
| `E` | Open email action (template selector) |
| `C` | Open call action |
| `N` | Focus the "Add note" input |
| `S` | Change status (opens dropdown) |
| `D` | Disqualify (opens confirmation) |
| `Q` | Mark as qualified |
| `F` | Mark as follow-up needed |
| `P` | Print/export PDF |
| `Backspace` or `B` | Back to inbox |
| `→` | Next lead (in Working mode) |
| `←` | Previous lead (in Working mode) |

### Modifier Rules

- Shortcuts should only fire when no input/textarea is focused (to avoid conflicts with typing)
- Show shortcut hints as small tooltips on buttons when the user presses and holds `?` or on hover (optional)
- All shortcuts should be discoverable via the `?` help modal

## UI: Shortcuts Help Modal

Pressing `?` anywhere opens a clean modal listing all available shortcuts:
- Organized by context (Global, Inbox, Lead Detail)
- Two-column layout: shortcut key on left, action description on right
- "Press Esc to close"

## Implementation

- Use a keyboard event listener library (e.g., `hotkeys-js`, `tinykeys`, or a simple custom hook)
- Register shortcuts at the page/component level
- Ensure shortcuts are disabled when the user is typing in any input field
- Shortcuts should be documented but not required — every action must still be accessible via mouse

---

# Implementation Order

Recommended build sequence:

### Sprint 1: Quick Wins
1. **Lead Aging Indicators** (Feature 2) — simple calculation, visual column
2. **Dashboard Auto-Refresh** (Feature 6) — polling setup, lays groundwork
3. **Keyboard Shortcuts** (Feature 11) — register listeners, wire to existing actions

### Sprint 2: Bulk & Export
4. **Bulk Actions** (Feature 1) — row selection, action bar, batch operations
5. **Activity Log Export** (Feature 4) — query builder, CSV/PDF generation
6. **Print/Export Lead Detail PDF** (Feature 7) — PDF template, generation

### Sprint 3: Intelligence
7. **Win/Loss Analysis** (Feature 8) — outcome reasons, prompts, data model
8. **Revenue Attribution** (Feature 9) — partner analytics, reads from Feature 8 data
9. **Scoring Rule Effectiveness** (Feature 10) — analytics queries, insights engine

### Sprint 4: Collaboration
10. **Shared Saved Views** (Feature 3) — team views, permission logic
11. **Lead Enrichment** (Feature 5) — research links, structured log modal

---

# Acceptance Criteria

The feature set is complete when:

1. Staff can select multiple leads and perform bulk assign, status change, export, and note actions in one operation
2. Every lead in the inbox shows a color-coded age badge that makes stale leads visually obvious
3. Managers can create saved views that appear for all team members
4. Any date range of activity logs can be exported as CSV or PDF
5. Staff can one-click research a company on Google/LinkedIn and log structured findings
6. The inbox and reports auto-refresh every 30-60 seconds without disrupting user workflow
7. Any lead can be exported as a clean one-page PDF summary
8. Terminal status changes prompt for a reason, and win/loss data is queryable in reports
9. Each referral partner has a scorecard showing total leads and estimated value referred
10. Scoring rules show conversion lift metrics with plain-English recommendations
11. Power users can navigate and act on leads using keyboard shortcuts