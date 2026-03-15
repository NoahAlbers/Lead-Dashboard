Revamp the Lead Detail page layout. This is the most important page in the app — staff spend most of their time here.

## Header redesign
- Title format: "Contact Name | Company Name" (e.g., "Mark Carper | Magna Terra LLC")
- Below title: created date/time in muted text
- Top right of header: 
  - Large score circle (48-56px diameter, colored by tier — use the tier's configured color as the circle border/fill)
  - Score number large and bold inside the circle
  - Tier badge next to it (e.g., "C Lead" pill using tier color)
  - Status badge (e.g., "Contacted" with status color)
  - SLA badge if applicable (e.g., "32m left" in warning amber, or "On Track" in green)
- Back to Inbox link stays at top left above the title

## Three-column layout

### Left column (~30% width): Lead data
Stack these as compact, collapsible card sections with minimal padding:

1. **Contact Information**
   - Contact name, company, email (clickable mailto), phone (clickable tel), website (clickable link or "No website"), alternate phone
   - State pills with good/bad coloring
   - Keep it dense — use a two-column label:value layout within the card

2. **Portfolio Details** 
   - Total units, avg rent/unit, ownership type
   - Rental types (pills), property types (pills)
   - Listing sites (pills), PM software (pills)

3. **Collections Readiness**
   - Debt types (pills), debts ready now, prior agency experience
   - Lead's comments/notes from form displayed in a subtle quote block

Each section should be collapsible (click header to toggle) but default to expanded. Cards should have tight vertical spacing — 8px gap between sections, 12px internal padding.

### Center column (~45% width): Qualification + Timeline
This is the "story" of the lead — why it scored the way it did and what's happened.

1. **Qualification Card**
   - Score + tier prominently displayed
   - Recommended action
   - Applied rules list: rule name on left, point value on right (green for positive, red for negative)
   - Base score at bottom
   - Compact — no wasted vertical space

2. **SLA Tracking Card**
   - Which SLA is active (First Contact or Follow-Up)
   - Visual progress bar (colored by status: green/amber/red)
   - Time remaining or time overdue
   - Threshold label at the end of the bar

3. **Referral Recommendation** (only show if system recommends a referral)
   - Recommended partner name + reason
   - "Refer" button inline

4. **Activity Timeline**
   - Chronological event list, newest first
   - Each entry: timestamp, user/system, event type, details
   - Compact dots/line design (vertical timeline line with small dots)
   - Inline "Add note..." text input at the top of the timeline
   - Status change events, contact logs, emails, calls, referrals all in one stream
   - This section should scroll internally if it gets long (max-height with overflow-y: auto)

### Right column (~25% width): Actions
This column should be **position: sticky** so it stays visible as the user scrolls.

1. **Action Buttons** — stacked vertically, full width of the column:
   - Email Lead (primary action style — slightly more prominent)
   - Call Lead (primary action style)
   - Mark Contacted
   - Follow-Up Needed
   - Mark Qualified
   - Disqualify
   - Refer Out
   - Mark Duplicate
   - Export for CRM
   - Find & Merge
   - Add Note
   - Each button should have a small icon on the left and clear label
   - Group them visually: Communication (email, call) | Status (contacted, follow-up, qualified, disqualify) | Other (refer, duplicate, CRM, merge, note)
   - Use subtle divider lines between groups

2. **Change Status** dropdown below the buttons

3. **Assignment Section**
   - Current assignee or "Unassigned"
   - Assign/Reassign button (for managers)
   - Claim button (for intake staff if unassigned)

4. **CRM Status**
   - Export status (Not exported / Exported / Imported)
   - External CRM ID if available

## General styling
- Use the app's existing card styles but tighten padding (12-16px, not 24px)
- Reduce gaps between sections (8-12px, not 20-24px)
- The goal is to get ALL essential information visible without scrolling on a 1080p display
- Left and center columns scroll naturally with the page
- Right column is sticky (stays in view)
- On the header, make the score circle and tier badge significantly larger than they are now — these should be the first thing your eye catches
- Font sizes: header title 20-22px, section headers 14-15px bold, field labels 12-13px muted, field values 13-14px normal
- Collapsible sections use a subtle chevron icon that rotates on toggle
- Remove any redundant information — don't show the same data in multiple places