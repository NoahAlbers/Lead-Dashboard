Three quick UI fixes. Read all, then implement.

## FIX 1: Working Leads sticky header bar — make opaque
The "Working Leads" navigation bar at the top of the lead detail page (shows "Working Leads 1 of 3", processed count, navigation arrows, Exit button) currently has a transparent background. When you scroll, content shows through it and it looks messy. Fix:
- Give the sticky header bar a solid opaque background: `background: var(--color-background-primary)` (or the same background as the rest of the page)
- Add a subtle bottom border: `border-bottom: 0.5px solid var(--color-border-tertiary)`
- Add a slight box-shadow only when scrolled (optional): `box-shadow: 0 1px 3px rgba(0,0,0,0.05)` — or skip the shadow and just use the border
- Make sure it has a proper z-index so it sits above all scrolling content
- The bar should look like a natural part of the page header, not floating

## FIX 2: Assignments page — show assigned leads per staff member
The Manage Assignments page shows unassigned leads on the left and staff workload on the right. Currently the staff workload panel only shows a count and a bar — you can't see WHICH leads are assigned to each person. Fix:

- Make each staff member's row expandable/collapsible
- When expanded, show a list of their assigned leads below their name:
  - Each lead shows: company name (clickable link to lead detail), score, tier badge, status badge, state pills, SLA status
  - Sort by SLA urgency (most urgent first)
- Default state: collapsed (just name, role, count, workload bar)
- Click the staff member row or a chevron to expand
- Alternatively, if the expanded list feels too cramped in the right panel:
  - Click a staff member to open a slide-out panel or modal showing all their assigned leads in a clean list/table format
  - The modal should include: lead company name, contact name, score, tier, status, SLA status, last activity
  - Each lead in the modal should be clickable to navigate to the lead detail page
- Also add a "Reassign" button on each lead within the expanded view, so managers can move leads between staff directly from the assignments page
- The workload bar should use tier colors to show the breakdown (e.g., blue segment for B leads, green for A leads)

## FIX 3: Read/unread indicators — replace invisible dots with envelope icons
The current read/unread toggle on the lead inbox is a tiny dot that's nearly invisible. Replace with clear envelope icons:
- **Unread**: Closed/sealed envelope icon (filled, using the app's primary/accent color — should be visually prominent)
- **Read**: Open envelope icon (outlined/muted, using secondary text color — subtle but visible)
- The icon should be ~18-20px, placed in the same column position where the dot currently is
- Clicking the icon toggles read/unread state (same functionality as now)
- Tooltip on hover: "Mark as read" or "Mark as unread"
- The right-click context menu option should also update to show the envelope icon and say "Mark as read" / "Mark as unread"
- If using Lucide icons (which the app likely already uses): `Mail` for unread (closed envelope), `MailOpen` for read (open envelope)
- Unread leads should still have the slightly bolder/distinct row styling to make them stand out in the table even without focusing on the icon

Implement in this order:
1. Working leads header opacity (30-second CSS fix)
2. Read/unread envelope icons (quick component swap)
3. Assignments expandable staff leads (most involved)