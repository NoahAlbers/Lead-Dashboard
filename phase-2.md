# ACB Lead Operations Console — High-Impact Features PRD

## Document Purpose

This PRD defines five high-impact feature additions to the ACB Lead Operations Console. These features should be implemented in the order presented. Each section is self-contained with full requirements, data model changes, UI specifications, and edge cases.

Read this entire document before writing any code. Plan the implementation across all five features to identify shared infrastructure (e.g., the notification system is used by multiple features).

---

# Feature 1: SLA Tracking & Follow-Up Reminders

## Overview

The system must track how long leads sit without action and alert staff when leads are going stale. Every lead should have a visible "time since last action" indicator, and the system should proactively warn staff when SLA thresholds are being approached or breached.

## Business Rules

### Office Hours

- Default office hours: **9:00 AM – 4:00 PM EST, Monday through Friday**
- SLA clocks ONLY tick during office hours
- Leads submitted outside office hours start their SLA clock at the next office-hours open (e.g., a lead submitted Saturday at 2 PM starts its clock Monday at 9 AM)
- Leads submitted during office hours start their clock immediately
- Office hours must be **admin-configurable** in Settings:
  - Start time (hour and minute)
  - End time (hour and minute)
  - Active days (checkboxes for each day of the week)
  - Timezone (default: America/New_York, selectable from common US timezones)
  - Holiday exclusions: admin can add specific dates that should be treated as non-business days

### SLA Thresholds by Quality Tier

These are the defaults. All must be admin-configurable in Settings under a new "SLA Configuration" section.

| Quality Tier | First Contact SLA | Follow-Up SLA | Escalation SLA |
|---|---|---|---|
| A Lead | 2 business hours | 1 business day | 2 business days |
| B Lead | 4 business hours | 2 business days | 3 business days |
| C Lead | 1 business day | 3 business days | 5 business days |
| Poor Fit | 2 business days | 5 business days | No escalation |

Definitions:
- **First Contact SLA**: Time from lead creation to the first outbound action (email opened, call initiated, or status changed to Contacted)
- **Follow-Up SLA**: Time from last activity to next required follow-up, applies when status is Contacted or Follow-Up Needed
- **Escalation SLA**: Time after Follow-Up SLA breach before the lead is escalated (visual escalation indicator, manager notification)

### SLA Statuses

Each lead should have a computed SLA status:
- **On Track** (green): Within SLA threshold
- **Warning** (yellow/amber): Within 75% of SLA threshold (e.g., 1.5 hours into a 2-hour SLA)
- **Breached** (red): Past SLA threshold
- **Escalated** (dark red/pulsing): Past escalation threshold
- **Paused** (gray): Lead is in a terminal status (Won, Lost, Disqualified, Duplicate, Referred Out) — SLA not applicable
- **Outside Hours** (gray): Currently outside office hours, clock is paused

### SLA Clock Calculation

The SLA engine must calculate elapsed business time accurately:
1. Get the timestamp of the relevant starting event (lead creation for first contact SLA, last activity for follow-up SLA)
2. Calculate elapsed time counting ONLY minutes that fall within configured office hours on configured active days, excluding holidays
3. Compare elapsed business time against the tier's SLA threshold
4. Return: elapsed_business_minutes, threshold_minutes, percentage_elapsed, sla_status

This calculation must be a shared utility/service since it's referenced by the inbox, lead detail, notifications, and reporting.

## Data Model Changes

### New table: `sla_config`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| tier_id | uuid | FK to quality tier |
| first_contact_minutes | integer | Business minutes for first contact SLA |
| follow_up_minutes | integer | Business minutes for follow-up SLA |
| escalation_minutes | integer | Business minutes for escalation (nullable, null = no escalation) |
| created_at | timestamp | |
| updated_at | timestamp | |

### New table: `office_hours_config`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| start_time | time | e.g., 09:00 |
| end_time | time | e.g., 16:00 |
| active_days | json | Array of active day numbers [1,2,3,4,5] (1=Monday, 7=Sunday) |
| timezone | string | e.g., "America/New_York" |
| created_at | timestamp | |
| updated_at | timestamp | |

### New table: `office_hours_holidays`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| date | date | The holiday date |
| name | string | e.g., "Thanksgiving", "Christmas" |
| created_at | timestamp | |

### Add to `leads` table:

| Field | Type | Description |
|---|---|---|
| first_contact_at | timestamp (nullable) | When the first outbound action occurred |
| sla_status | string | Computed: on_track, warning, breached, escalated, paused |
| sla_breached_at | timestamp (nullable) | When the SLA was first breached (for reporting) |

## UI Requirements

### Lead Inbox Table

- Add an **SLA column** (can be toggled on/off via column settings, on by default)
- Display as a colored badge/pill:
  - On Track: green, shows remaining time (e.g., "1h 23m left")
  - Warning: amber, shows remaining time with urgency (e.g., "32m left")
  - Breached: red, shows how far over (e.g., "47m over")
  - Escalated: dark red with pulse/glow animation, shows how far over
  - Paused: gray, shows "—" or "N/A"
- The inbox should be sortable by SLA status (most urgent first)
- Add a default saved view: **"SLA At Risk"** that filters to Warning + Breached + Escalated leads

### Lead Inbox Stat Widgets

Add these as available widget options for the customizable stat boxes:
- **SLA Breached** (count of currently breached leads)
- **SLA At Risk** (count of warning + breached)
- **Avg Response Time** (average business minutes to first contact this week/month)
- **SLA Compliance Rate** (percentage of leads contacted within SLA this week/month)

### Lead Detail Page

- Add an SLA section (above or next to the scoring section):
  - Current SLA status badge (large, prominent)
  - Time remaining or time overdue
  - Visual progress bar showing how much of the SLA window has elapsed
  - First Contact SLA and Follow-Up SLA displayed separately if both apply
  - Timestamp of when the SLA clock started
  - If breached: when it was breached

### Admin Settings — SLA Configuration Page

- Table showing each quality tier with editable SLA values (first contact, follow-up, escalation)
- Edit inline or via modal
- Office hours configuration:
  - Start time picker
  - End time picker
  - Day-of-week checkboxes
  - Timezone dropdown
- Holiday management:
  - List of holidays with date and name
  - Add/remove holidays
  - Option to import US federal holidays for a given year

### Notifications for SLA (ties into Feature 5: Notifications)

- When a lead transitions from On Track → Warning: notification to assigned user
- When a lead transitions from Warning → Breached: notification to assigned user + managers
- When a lead transitions from Breached → Escalated: notification to all managers
- Notification content should include lead name, company, tier, and how long it's been waiting

## Background Processing

- A background job or polling mechanism must run every 60 seconds to:
  1. Recalculate SLA status for all active leads
  2. Detect status transitions (on_track → warning, warning → breached, etc.)
  3. Fire notifications for transitions
  4. Update the sla_status field on each lead
- During non-office hours, the job can run less frequently (every 5 minutes) since clocks are paused

---

# Feature 2: Lead Assignment & Workload Balancing

## Overview

Managers must be able to assign leads to specific staff members. The system should show workload distribution and make assignment easy. Currently 2-3 intake staff work leads, with a manager overseeing.

## Assignment Model

- **Manager-assigned**: Managers manually assign leads to staff. This is the primary flow.
- Leads can also be unassigned (visible to everyone, claimable).
- Staff can claim unassigned leads (self-assign) if permitted by role.
- Managers can reassign leads between staff at any time.
- Assignment changes must be logged in the activity log.

## Data Model Changes

The `assigned_user_id` field already exists on the leads table. Additional:

### Add to `leads` table:

| Field | Type | Description |
|---|---|---|
| assigned_at | timestamp (nullable) | When the lead was assigned to current user |
| claimed_by_self | boolean | Whether the user self-assigned vs manager-assigned |

### New table: `assignment_log`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| from_user_id | uuid (nullable) | Previous assignee (null if unassigned) |
| to_user_id | uuid (nullable) | New assignee (null if unassigned) |
| assigned_by_user_id | uuid | Who made the assignment |
| reason | string (nullable) | Optional reason for reassignment |
| created_at | timestamp | |

## UI Requirements

### Lead Inbox — Assignment Column

- The "Assigned User" column should display:
  - User's name with a small avatar/initial circle
  - "Unassigned" in gray italic if no one is assigned
- Clicking the assigned user cell should open an inline dropdown to reassign (for managers) or show the name (for non-managers)

### Lead Inbox — Assignment Quick Actions

- Add an "Assign" icon to the Quick Actions column (person+ icon)
- Clicking opens a dropdown of active staff members
- Selecting a user assigns the lead immediately
- If the lead is already assigned, show current assignee highlighted with option to change

### Bulk Assignment

- When multiple leads are selected (via checkboxes on each row — add row selection checkboxes):
  - A bulk action bar appears at the top of the table
  - Options: "Assign to..." dropdown, "Change Status", "Mark as Read", "Export Selected"
  - "Assign to..." shows list of active staff members
  - Selecting assigns ALL selected leads to that user
  - Activity log records each assignment individually

### Lead Inbox Filtering

- The existing "Assigned User" filter should work as a dropdown of staff members + "Unassigned" option
- Add a default saved view: **"My Leads"** that filters to leads assigned to the current logged-in user
- Add a default saved view: **"Unassigned"** that filters to leads with no assignee

### Workload Panel

Add a collapsible panel or widget (available in the inbox stat widgets and as a reports dashboard widget) showing:
- Each active staff member
- Number of leads currently assigned to them
- Breakdown by status (New, Contacted, Follow-Up Needed)
- Number of SLA-breached leads per person
- Visual bar showing relative workload

This helps managers see at a glance who has capacity before assigning.

### Lead Detail Page — Assignment Section

- Show current assignee prominently (name + role)
- "Reassign" button (manager only) opens user selection dropdown
- Assignment history visible in the activity log
- If unassigned: prominent "Assign" or "Claim" button
  - "Claim" (for intake staff): self-assigns the lead
  - "Assign" (for managers): opens user selection

### Manager Assignment View

A dedicated page or modal accessible from the inbox (button: "Manage Assignments"):
- Left column: list of unassigned leads, sorted by SLA urgency
- Right column: staff members with current workload counts
- Drag-and-drop: drag a lead onto a staff member to assign
- Or: select leads with checkboxes + "Assign to" dropdown
- After assignment, lead moves from the unassigned list

### Notifications

- When a lead is assigned to a user: notification to that user ("You've been assigned a new lead: [Company Name] — [Tier]")
- When a lead is reassigned: notification to new assignee, optional notification to previous assignee
- When a lead is unassigned: notification to managers

---

# Feature 3: Quick-Disposition Flow

## Overview

A streamlined workflow for processing leads one-by-one. After completing actions on a lead, the staff member is prompted to move to the next unworked lead. This reduces clicking and context-switching when processing a batch of leads.

## Activation

- Add a **"Start Working Leads"** button on the Lead Inbox page
- When clicked, opens the first lead in the queue in a "working mode" that adds navigation controls
- The queue order is determined by the user's current sort/filter settings on the inbox
- The user can choose their preferred sort before starting (a prompt or the current sort carries over)

## Working Mode UI

When in working mode, the Lead Detail page gets additional UI elements:

### Top Navigation Bar (Working Mode Only)

A sticky bar at the top of the lead detail page showing:
- "Working Leads" indicator with the current position (e.g., "Lead 3 of 17")
- Progress bar showing how many leads have been processed in this session
- **"Previous"** button (go back to the last lead)
- **"Skip"** button (move to next lead without taking action)
- **"Exit Working Mode"** button (return to inbox)
- Current sort order indicator with option to change

### Disposition Panel

After the user takes a meaningful action on a lead (sends email, makes call, changes status, adds note), show a disposition panel at the bottom or side of the lead detail page:

**"What happened with this lead?"**

Quick-action buttons (one click each):
- ✅ **Contacted — Will Follow Up** (sets status to Contacted, logs "Contacted" event, schedules follow-up prompt)
- ✅ **Contacted — Qualified** (sets status to Qualified, logs event)
- 📧 **Emailed — Awaiting Response** (sets status to Contacted, logs "Email Sent" event)
- 📞 **Called — Left Voicemail** (sets status to Contacted, logs "Left Voicemail" event)
- 📞 **Called — Spoke with Contact** (sets status to Contacted, logs event, prompts for brief note)
- 🔄 **Needs Follow-Up** (sets status to Follow-Up Needed, prompts for follow-up date/time)
- ➡️ **Referred Out** (sets status to Referred Out, should have already gone through referral email flow)
- ❌ **Not a Fit — Disqualify** (sets status to Disqualified, prompts for reason)
- 🔁 **Duplicate** (sets status to Duplicate, prompts to link to original lead)
- 📝 **Add Note Only** (just log a note, don't change status)

Each button should:
1. Execute the status change and log the event immediately
2. Optionally prompt for a quick note (small text field, not required)
3. Show confirmation: "Marked as [status]. Move to next lead?"
4. Two buttons: **"Next Lead →"** and **"Stay on This Lead"**

### Follow-Up Scheduling

When "Needs Follow-Up" or "Contacted — Will Follow Up" is selected:
- Show a date/time picker for when the follow-up should happen
- Default to: next business day, same time
- Save as a follow-up reminder (ties into Feature 1 SLA tracking)
- The follow-up date should be visible on the lead detail page and in the inbox

### Queue Logic

The "next lead" is determined by:
1. The user's chosen sort order from when they entered working mode
2. Filtered to only unworked leads (status = New, or assigned to current user with status not in terminal states)
3. Skip leads that are already being worked by another user (if real-time presence is available) or at minimum skip leads assigned to other users
4. If the user has a "My Leads" filter active, only cycle through their assigned leads

### Session Summary

When the user clicks "Exit Working Mode" or reaches the end of the queue:
- Show a session summary modal:
  - Number of leads processed
  - Breakdown by disposition (X contacted, Y referred, Z disqualified, etc.)
  - Total time spent
  - "Return to Inbox" button

## Data Model Changes

### New table: `follow_up_reminders`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| user_id | uuid | FK to user who set the reminder |
| reminder_at | timestamp | When the follow-up is due |
| note | string (nullable) | What the follow-up is about |
| completed | boolean | Default false |
| completed_at | timestamp (nullable) | When it was completed |
| created_at | timestamp | |

### Add to `leads` table:

| Field | Type | Description |
|---|---|---|
| next_follow_up_at | timestamp (nullable) | Next scheduled follow-up date/time |

## Integration with Other Features

- The follow-up reminders feed into SLA tracking (Feature 1) — a follow-up past its reminder date should trigger a warning
- The disposition actions should generate proper activity log events
- The disposition actions should trigger re-evaluation of SLA status
- If a lead is dispositioned as "Referred Out," the referral email flow (existing feature) should have already been completed

---

# Feature 4: Duplicate Merge

## Overview

When duplicate leads are identified (either automatically or manually), staff need the ability to merge them into a single record. This involves comparing the two records side-by-side, choosing which field values to keep, merging activity histories, and archiving the duplicate.

## Duplicate Detection Recap

The existing system flags duplicates. This feature adds the ability to actually merge them.

## Merge Workflow

### Step 1: Initiate Merge

Two entry points:
1. From the lead detail page, when a lead is flagged as a duplicate: "Merge with Original" button
2. From the inbox, when viewing the Duplicates saved view: "Merge" action button on each row
3. Manual: on any lead detail page, a "Find & Merge Duplicate" button that lets the user search for another lead to merge with

### Step 2: Side-by-Side Comparison

Open a full-screen or large modal showing both lead records side by side:

**Layout:**
- Left column: "Lead A" (the one you're keeping as primary — default to the older lead)
- Right column: "Lead B" (the duplicate — default to the newer lead)
- Center column: "Merged Result" (what the final record will look like)
- Toggle at top: "Keep Lead A as Primary" / "Keep Lead B as Primary" (swaps which record becomes the surviving record)

**For each field:**
- Show both values side by side
- If values are identical: auto-select, show in green, no action needed
- If values differ: highlight in yellow, require the user to choose which value to keep
  - Radio buttons or click-to-select on either the left or right value
  - The selected value populates the center "Merged Result" column
- If one value is empty and the other isn't: auto-select the non-empty value
- Special handling for multi-select fields (states, PM software, etc.): offer option to combine both lists (union) rather than pick one

**Fields to compare:**
- All contact fields (name, email, phone, company, etc.)
- All location fields
- All business/case fields
- Score and tier (recalculate after merge based on merged data)
- Status (keep the more advanced status, e.g., Contacted > New)
- Assigned user (keep whichever has one, or let user choose if both have different assignees)

### Step 3: Activity & Notes Merge

- Show both leads' activity timelines below the field comparison
- Default behavior: **merge all activities and notes from both leads into a single chronological timeline**
- Add a system event to the merged timeline: "Lead merged from [Lead B Company Name] (ID: xxx) by [User] on [Date]"
- Preserve all activity log entries from both records — none should be lost

### Step 4: Confirmation

Before executing the merge:
- Show a summary of what will happen:
  - "Primary record: [Company A] will be kept"
  - "Duplicate record: [Company B] will be archived"
  - "X field values will be updated on the primary record"
  - "Y activity log entries will be merged"
  - "The duplicate record will be marked as archived and will no longer appear in the inbox"
- "Confirm Merge" button and "Cancel" button
- This action should be logged but also reversible (see below)

### Step 5: Execution

When confirmed:
1. Update the primary lead record with the selected merged field values
2. Copy all activity log entries from the duplicate to the primary lead (update lead_id references)
3. Copy all notes from the duplicate to the primary lead
4. Recalculate the primary lead's score based on the merged data
5. Set the duplicate lead's status to "Merged"
6. Set `duplicate.merged_into_lead_id = primary.id`
7. Remove the duplicate from normal inbox views (filter out "Merged" status by default)
8. Log a "leads_merged" event on both leads

### Undo/Reversibility

- Store the pre-merge state of both records as a JSON snapshot in a `merge_history` table
- Add an "Undo Merge" option accessible from the merged lead's activity log (within 24 hours of merge, or manager override for longer)
- Undo restores both records to their pre-merge state

## Data Model Changes

### New table: `merge_history`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| primary_lead_id | uuid | The lead that was kept |
| duplicate_lead_id | uuid | The lead that was archived |
| merged_by_user_id | uuid | Who performed the merge |
| primary_snapshot_json | json | Full state of primary lead before merge |
| duplicate_snapshot_json | json | Full state of duplicate lead before merge |
| field_selections_json | json | Which fields came from which record |
| undone | boolean | Default false |
| undone_at | timestamp (nullable) | |
| undone_by_user_id | uuid (nullable) | |
| created_at | timestamp | |

### Add to `leads` table:

| Field | Type | Description |
|---|---|---|
| merged_into_lead_id | uuid (nullable) | If this lead was merged into another, reference to the surviving lead |
| merged_at | timestamp (nullable) | When the merge occurred |

### Add "Merged" to status options

Add "Merged" as a system status that:
- Cannot be manually set by users
- Is filtered out of default inbox views
- Is only applied by the merge process

## UI Locations

- Lead Detail page: "Merge" button in actions (visible when duplicate_of_lead_id is set, or always available for manual merge)
- Inbox: "Merge" quick action on leads with Duplicate status
- Duplicates saved view: "Merge" button per row
- The side-by-side comparison should be a dedicated page or full-screen modal — it needs space

---

# Feature 5: Inbound Lead Notifications

## Overview

Staff should be alerted in real-time when new leads arrive, especially high-quality ones. The system should support browser push notifications, an in-app notification center, and optional sound alerts.

## Notification Channels

### Channel 1: Browser/Desktop Push Notifications

- On first login, prompt the user to enable browser notifications (standard Web Push API permission request)
- If granted, send push notifications for:
  - New lead arrival (all leads, or configurable: only A/B leads)
  - Lead assigned to you
  - SLA warning/breach on your assigned leads
  - Follow-up reminder due
- Push notifications should work even when the app tab is in the background
- Notification content:
  - Title: "New A Lead: [Company Name]" or "SLA Breach: [Company Name]"
  - Body: Brief summary (e.g., "Florida | 1,500 units | Score: 85")
  - Click action: open the lead detail page
- Store push subscription in the database per user for server-sent notifications

### Channel 2: In-App Notification Center

- Add a **bell icon** to the top navigation bar (next to user name / sign out)
- Bell shows an **unread notification count badge** (red circle with number)
- Clicking the bell opens a **notification dropdown/panel** showing:
  - Chronological list of notifications, newest first
  - Each notification shows: icon (by type), title, brief description, timestamp, read/unread indicator
  - Click a notification to navigate to the relevant lead
  - "Mark all as read" button at top
  - "View All" link that goes to a full notification history page
- Notification panel should show the last 20 notifications with infinite scroll or pagination on the full page
- Unread notifications are visually distinct (bold, blue dot, background tint)

### Channel 3: Sound Alerts

- When a new notification arrives and the app is in the foreground:
  - Play a short, pleasant notification sound
  - Different sounds for different priority levels:
    - A Lead arrival: distinctive "priority" sound
    - B Lead arrival: standard notification sound
    - SLA breach: more urgent/alert sound
    - General notification: subtle chime
- Sound should be **configurable per user** in their profile/settings:
  - Master toggle: sounds on/off
  - Volume slider
  - Per-notification-type toggles
- Respect browser audio policies (may require user interaction before sounds can play)

## Notification Types

| Type | Trigger | Recipients | Priority |
|---|---|---|---|
| new_lead | New lead ingested | All active staff (or configured recipients) | Normal (A Lead = High) |
| lead_assigned | Lead assigned to user | Assigned user | Normal |
| lead_reassigned | Lead reassigned | New assignee (optionally old assignee) | Normal |
| sla_warning | SLA at 75% threshold | Assigned user | High |
| sla_breach | SLA threshold exceeded | Assigned user + managers | Critical |
| sla_escalation | Escalation threshold exceeded | All managers | Critical |
| follow_up_due | Follow-up reminder time reached | User who set the reminder | High |
| duplicate_detected | New lead flagged as possible duplicate | Staff who handle duplicates / all | Low |
| lead_status_changed | Lead status changes (configurable) | Assigned user | Low |

## Data Model Changes

### New table: `notifications`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK — who this notification is for |
| type | string | Notification type (from table above) |
| title | string | Notification title |
| body | string | Notification body text |
| lead_id | uuid (nullable) | FK — related lead if applicable |
| priority | string | low, normal, high, critical |
| read | boolean | Default false |
| read_at | timestamp (nullable) | |
| clicked | boolean | Default false — did user click through |
| created_at | timestamp | |

### New table: `push_subscriptions`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK |
| endpoint | string | Web Push endpoint URL |
| keys_json | json | p256dh and auth keys |
| user_agent | string (nullable) | Browser info |
| active | boolean | Default true |
| created_at | timestamp | |

### New table: `notification_preferences`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK |
| notification_type | string | e.g., "new_lead", "sla_breach" |
| browser_push_enabled | boolean | Default true |
| in_app_enabled | boolean | Default true (cannot be disabled for critical) |
| sound_enabled | boolean | Default true |
| created_at | timestamp | |
| updated_at | timestamp | |

### New table: `sound_preferences`

| Field | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK |
| sounds_enabled | boolean | Default true |
| volume | integer | 0-100, default 70 |
| created_at | timestamp | |
| updated_at | timestamp | |

## Real-Time Delivery

Notifications need to reach users quickly. Implementation options (in order of preference):

1. **Server-Sent Events (SSE)**: The client opens a persistent connection to `/api/notifications/stream`. The server pushes new notifications as they're created. Simple, reliable, works with Next.js API routes. **Recommended approach.**
2. **Polling**: Client polls `/api/notifications/unread` every 15-30 seconds. Simpler but less responsive. Acceptable fallback.
3. **WebSocket**: More complex, better for bidirectional communication. Overkill for this use case.

The SSE or polling endpoint should return:
- New unread notifications since last check
- Current unread count (for the bell badge)
- Current unread lead count (for the favicon system already built)

## Notification Sound Files

- Include 3-4 short audio files in the public assets:
  - `notification-high.mp3` — for A Lead arrivals and SLA breaches (distinct, attention-grabbing)
  - `notification-normal.mp3` — for B/C lead arrivals, assignments
  - `notification-low.mp3` — for general notifications
  - `notification-chime.mp3` — subtle, for low-priority
- Each should be under 1 second, professional sounding
- Generate these or use royalty-free notification sounds

## User Settings — Notification Preferences Page

Add a "Notifications" section in user profile or settings:

- **Browser Notifications**: Enable/disable button, shows permission status
- **Sound Settings**: Master toggle, volume slider
- **Per-type settings**: Table/list of notification types, each with toggles for browser push, in-app, and sound
- **Quiet Hours**: Optional — suppress sounds and push notifications during configured hours (e.g., don't notify after 5 PM even if they're still in the app)

## Sidebar Badge

- The sidebar navigation should show a notification count badge on the "Lead Inbox" nav item when there are new unread leads
- The bell icon in the top bar shows the total unread notification count
- These are different counts:
  - Sidebar "Lead Inbox" badge = unread leads (the read/unread system already built)
  - Top bar bell badge = unread notifications

---

# Implementation Order & Shared Infrastructure

## Build in this order:

### Phase 1: Shared Infrastructure
1. **Notification system core** — database tables, API endpoints for creating/reading/marking notifications, SSE or polling endpoint
2. **In-app notification center UI** — bell icon, dropdown panel, notification list
3. **Sound system** — audio manager utility, sound files, volume control

### Phase 2: SLA Tracking
4. **Office hours configuration** — admin settings UI and database
5. **SLA calculation engine** — business time calculator utility
6. **SLA config per tier** — admin settings UI and database
7. **SLA display in inbox and lead detail** — columns, badges, progress bars
8. **SLA monitoring background job** — status transitions, notification triggers
9. **SLA stat widgets** — add to inbox widget options

### Phase 3: Lead Assignment
10. **Assignment UI in inbox** — quick assign, bulk assign, assignment column
11. **Workload panel/widget** — staff workload visualization
12. **Manager assignment view** — dedicated assignment management page
13. **Assignment notifications** — trigger notifications on assign/reassign
14. **My Leads and Unassigned saved views**

### Phase 4: Quick-Disposition Flow
15. **Working mode navigation bar** — enter/exit working mode, lead counter, progress
16. **Disposition panel** — quick action buttons, status changes, note prompts
17. **Follow-up scheduling** — date picker, reminder creation
18. **Queue logic** — next lead determination based on sort/filters
19. **Session summary** — end-of-session stats modal
20. **"Next lead?" prompt** — post-disposition confirmation with navigation

### Phase 5: Duplicate Merge
21. **Side-by-side comparison UI** — field comparison, value selection
22. **Merge execution logic** — field merging, activity log merging, score recalculation
23. **Merge history and undo** — snapshot storage, undo capability
24. **Merged status and inbox filtering** — hide merged leads from default views

### Phase 6: Polish & Integration
25. **Browser push notification setup** — Web Push API, subscription management
26. **Notification preferences UI** — per-user, per-type settings
27. **Cross-feature integration testing** — SLA + assignment + notifications working together
28. **Sound preferences UI**
29. **Holiday management for office hours**

## Key Dependencies

- Notification system must be built first because Features 1, 2, 3, and 5 all generate notifications
- SLA tracking depends on office hours config
- Quick-disposition flow depends on assignment (to know which leads are "mine")
- Duplicate merge is independent and can be built in parallel with other features

---

# Acceptance Criteria

The feature set is complete when:

1. **SLA**: Every active lead shows a real-time SLA status. Staff receive warnings before breaches. Managers can see SLA compliance rates. Office hours and thresholds are admin-configurable.

2. **Assignment**: Managers can assign leads to staff from the inbox with one click. Staff can see their assigned leads. Workload is visible. Assignment changes are logged and notified.

3. **Quick-Disposition**: Staff can enter "working mode" and process leads sequentially. After each lead, they're prompted with the outcome and offered the next lead. Follow-ups are scheduled. Session stats are shown at the end.

4. **Duplicate Merge**: Staff can compare two leads side-by-side, select which values to keep, merge activity histories, and archive the duplicate. Merges can be undone within 24 hours.

5. **Notifications**: New leads trigger browser and in-app notifications. SLA events trigger notifications. The bell icon shows unread count. Sounds play for high-priority events. All notification preferences are user-configurable.