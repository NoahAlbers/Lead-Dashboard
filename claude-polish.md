Layout and visual polish pass. Read all, then implement.

## FIX 1: Lead Inbox column widths — make adjustable
- Add draggable column resizers to the lead inbox table
- Users should be able to click and drag the border between column headers to resize
- Show a resize cursor on hover between columns
- Set sensible default widths (Company and Email columns wider, State and Score narrower)
- Persist column width preferences per user (localStorage is fine for now)
- Make sure the table remains horizontally scrollable if total column width exceeds the viewport

## FIX 2: Lead Inbox toolbar layout — consolidate into one row
Current layout has the search/filters on one row and "Columns" button floating separately. Fix:
- Move the "Columns" button (column visibility toggle) into the same row as Search, All Statuses, All Tiers, date pickers, and Unread filter
- Everything should be in a single compact filter toolbar row
- Keep the order logical: Search bar (takes most space) → Status filter → Tier filter → Date range → Unread toggle → Columns button
- Make sure it doesn't wrap awkwardly on standard desktop widths (1280px+)

## FIX 3: Customize button for stat widgets — move inline with title
- The "Customize" gear/button for the inbox stat widget boxes is currently positioned awkwardly
- Move it to be inline with the "Lead Inbox" title and "X total leads" subtitle
- Place it on the right side of that title row, like: "Lead Inbox [4 total leads] ................. ⚙ Customize"
- Keep it subtle — small icon or text link, not a prominent button

## FIX 4: Geographic heatmap — fix the color scale
The heatmap now correctly shows green for good states and red/pink for bad states based on the state classification system. But the legend/scale at the bottom still shows a blue gradient (0 → 3) which was the old lead-density scale. Fix:
- The heatmap is now doing two things at once: showing lead density AND state classification. These need to be reconciled.
- Recommended approach: Use a dual-layer system:
  - Base color: light green tint for good states, light red/pink tint for bad states (from state config)
  - Intensity/saturation: driven by lead count (more leads = deeper/darker shade of that state's base color)
  - So a good state with 3 leads = deep green, good state with 0 leads = very light green
  - Bad state with 2 leads = deep red, bad state with 0 leads = very light pink
  - Unknown states = gray scale by lead count
- Update the legend to reflect this:
  - Show a two-part legend: "Good States" with a green gradient (light → dark by lead count), "Restricted States" with a red gradient (light → dark by lead count)
  - Or show a simple legend: green = good state, red = restricted state, darker = more leads
- Remove the old blue scale entirely

## FIX 5: State pills — apply good/bad coloring everywhere
State pills should reflect the state classification throughout the app. Check and fix:
- Lead Inbox table State column: each state pill should be green (good), red/orange (bad), or default blue/gray (unknown)
- Lead Detail page: state display should use colored pills
- Currently some pills appear to be blue/default even for states that are classified. Audit:
  - "Michigan" appears as a blue pill — Michigan is a GOOD state, should be green
  - "Florida" appears green — correct
  - "Georgia", "Alabama" appear as pills — Georgia is GOOD (green), Alabama is GOOD (green)
  - "FL" abbreviation on Test Co — should also be green, and ideally display consistently (either always full name or always abbreviation, pick one and be consistent)
- Make state display consistent: always show full state name in pills, not sometimes abbreviation and sometimes full name
- Apply the same coloring to:
  - Referral partner "States Served" display
  - State filter dropdowns (color the options or add a dot indicator)
  - Any other place states appear

## FIX 6: Reports dashboard — ALL widgets must be resizable
- Ensure every widget/chart card on the Reports Dashboard supports resizing via the drag handle
- This includes:
  - Summary stat cards (Total Leads, Avg Score, Contact Rate, Est. Units)
  - Lead Volume Over Time chart
  - Quality Distribution donut
  - Quality Trend chart
  - Geographic Heatmap
  - Any custom charts the user has added
- All widgets should work with the react-grid-layout (or whatever grid library is in use)
- Each widget's chart/content should re-render and resize properly when the container changes size
- Charts should be responsive to their container — not fixed pixel dimensions
- Make sure the drag handle is visible and consistent on every widget

Plan and implement in this order:
1. Heatmap color scale fix (visual bug, contained)
2. State pill coloring audit and fix (visual consistency)
3. Inbox toolbar consolidation (layout)
4. Customize button repositioning (layout)
5. Column resizing (interactive feature)
6. Reports widget resizing (ensure all covered)