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

All three are straightforward — the header fix is literally one CSS property, the envelope icons are a component swap, and the assignments expansion is the only one that needs a bit more thought. Should keep Claude Code busy for a short sprint. How's the overall app feeling at this point?Right now the read/unread icons only show up when you hover on the area they're supposed to be in. Let's fix that.In the reports dashboard, the Quality Trend and Quality Distribution are hard to read, if we can darken those colors that would be nice. Those colors are from the selection in Admin Settings, which I'd like them to still be, but just apply a darken to them or something to make them legible.The custom charts still don't seem to work at all. Let's ensure they work.7:53 PMHere's your Claude Code prompt:

Three fixes — read/unread visibility, chart colors, and custom charts. Read all then implement.

## FIX 1: Read/unread envelope icons — always visible, not hover-only
The envelope icons for read/unread status are currently only appearing on hover — they need to be visible at all times. Fix:
- The envelope icon should ALWAYS be visible in every row, not just on hover
- Unread leads: show the closed/filled envelope icon in the accent color (always visible)
- Read leads: show the open envelope icon in a muted/secondary color (always visible, just subtler)
- Remove any CSS that sets opacity: 0 or visibility: hidden on the icon and only shows it on row:hover
- The icon should be a permanent column element, same as the score or status pill
- Hover behavior can still show a tooltip ("Mark as read" / "Mark as unread") but the icon itself must always render

Check the component CSS for patterns like:
- `.icon { opacity: 0; } .row:hover .icon { opacity: 1; }` — remove this
- `visibility: hidden` / `display: none` with hover overrides — remove this
- If the icon is conditionally rendered only on hover state — make it always rendered

## FIX 2: Quality Trend and Quality Distribution chart colors — too light/washed out
The tier colors from Admin Settings (A Lead = light green, B Lead = light blue, C Lead = light yellow) are too pastel to be legible in charts. The donut segments and area chart fills are barely distinguishable from the white background.

Fix by applying a color darkening/saturation boost specifically for chart rendering:
- Create a utility function that takes a color (hex) and returns a darker/more saturated version for chart use
- Apply this consistently in all charts that use tier colors
- Recommended approach:
```javascript
// Utility: darken a hex color for chart visibility
function darkenForChart(hex, amount = 0.3) {
  // Convert hex to HSL
  // Reduce lightness by amount (e.g., 0.3 = 30% darker)
  // Increase saturation slightly (e.g., +15%)
  // Return the darkened hex
}
```

- For area/fill charts (Quality Trend): use the darkened color at ~60% opacity for fills, and the full darkened color for the line/border
- For donut/pie charts (Quality Distribution): use the darkened color as the segment fill, with a white or slightly lighter stroke between segments
- The legend swatches should also use the darkened colors so they match the chart
- Keep the original lighter colors for pills/badges in the inbox — this darkening only applies to chart rendering contexts
- Test that the colors are clearly distinguishable from each other AND from the background in both light and dark mode

Specific targets for current tier defaults:
- A Lead green: should look like a clear medium green in charts, not a barely-there mint
- B Lead blue: should look like a clear medium blue, not an almost-white sky
- C Lead yellow/amber: should look like a visible gold/amber, not a faint cream

## FIX 3: Custom charts — debug and fix completely
The custom chart feature on the Reports Dashboard is not working. This needs a full debug:

### Step 1: Identify what's broken
- Is there an "Add Chart" or "Add Widget" button on the reports dashboard? If not, add one.
- When clicking it, does a chart configuration modal/form appear?
- Can the user select a field to analyze and a chart type?
- After saving, does a chart widget appear on the dashboard?
- Does the chart render with actual data?

### Step 2: Ensure the chart configuration flow works
The "Add Custom Chart" flow should:
1. Open a modal/dialog with these options:
   - **Chart title**: text input (e.g., "Leads by PM Software")
   - **Field to analyze**: dropdown of ALL lead fields — at minimum include:
     - state (multi-select field)
     - industry
     - debt_type
     - service_requested
     - pm_software (multi-select field)
     - listing_locations (multi-select field)
     - property_types (multi-select field)
     - rental_types (multi-select field)
     - ownership
     - quality_tier
     - status
     - assigned_user
     - lead_source
   - **Chart type**: bar chart, horizontal bar, pie/donut, line/trend over time
   - **Date range filter**: optional, defaults to "all time"
2. Save the configuration
3. Render the chart on the dashboard as a new widget (draggable/resizable with the grid layout)

### Step 3: Fix the data aggregation query
The API endpoint that powers custom charts must:
- Accept: field name, chart type, date range
- Query the leads table and aggregate by the selected field
- **CRITICAL for multi-select fields**: Fields stored as JSON arrays (state, pm_software, listing_locations, property_types, rental_types) must be unnested/exploded before counting. Each value in the array counts as one occurrence.
  - Example: A lead with states ["Florida", "Georgia", "Alabama"] should contribute 1 count to Florida, 1 to Georgia, and 1 to Alabama
  - In PostgreSQL this is done with `jsonb_array_elements_text()` or similar
  - Do NOT count the stringified array as a single value like '["Florida","Georgia","Alabama"]'
- For single-value fields (industry, debt_type, etc.): simple GROUP BY and COUNT
- Return: array of { label: string, value: number } sorted by value descending
- For trend charts: return { date: string, label: string, value: number } grouped by date AND field value

### Step 4: Fix the chart rendering
- Bar charts: use the app's chart library (Chart.js or Recharts — whichever is already in use)
- Apply the darkened tier colors where relevant, or use a standard color palette for non-tier fields
- Charts must be responsive to their container (resize when the widget is resized)
- Show data labels on segments/bars when there's room
- Empty state: if no data matches the query, show a "No data available" message instead of a blank widget

### Step 5: Persistence
- Custom chart configurations should be saved per user (in the database or alongside the dashboard layout config)
- Charts should persist across page reloads and sessions
- Users should be able to edit or remove custom charts (gear icon or X button on the widget)

### Test with these specific examples:
1. Create a bar chart of "Leads by State" — should show each state as a separate bar, with multi-state leads counted in each state
2. Create a donut chart of "Leads by Quality Tier" — should match the Quality Distribution widget data
3. Create a bar chart of "PM Software Used" — should handle the multi-select array properly
4. Create a bar chart of "Listing Locations" — same multi-select handling

Implement in this order:
1. Envelope icon visibility fix (quick CSS fix)
2. Chart color darkening utility + apply to Quality Trend and Quality Distribution
3. Custom charts full debug and fix