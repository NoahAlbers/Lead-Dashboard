Several fixes and features needed. Read through all of these before starting, then plan the approach:

## BUG FIX 1: Timezone — Force EST/Eastern Time everywhere
The app must use America/New_York (EST/EDT) for ALL timestamps — display, storage, filtering, and reporting. Right now the Reports Dashboard is showing all 4 leads as "today" but 2 were submitted on March 14th around 11:30 PM EST and 2 on March 15th. Check:
- How dates are stored in the database (should be UTC but displayed as EST)
- How the Reports Dashboard date filtering/grouping works — it's likely grouping by UTC date instead of converting to EST first
- How the Lead Inbox "Created" column renders timestamps — make sure those show EST
- How the stat cards (New Today, etc.) calculate their counts — must use EST day boundaries
- Add a timezone constant or config so this is set once and used everywhere

## BUG FIX 2: Multi-state selection not working in geographic heatmap
The geographic heatmap on the reports dashboard is only reflecting the first state a lead selected. Leads can select multiple states. Check:
- How state data is stored — it may need to be an array/JSON field rather than a single string
- The heatmap query/aggregation logic needs to count a lead once for EACH state they selected
- The lead inbox State column display should show all selected states
- Scoring rules that reference state need to work with arrays (e.g., "if any selected state is Florida, +15")

## FEATURE 1: Read/Unread status on leads
Add a read/unread indicator to the Lead Inbox:
- New leads default to "unread"
- Add a visual indicator (bold text, dot, or highlight) for unread leads in the inbox table
- Let users manually toggle read/unread per lead (right-click menu, icon button, or checkbox)
- Add a bulk "mark as read" option
- Add an "Unread" filter/saved view to the inbox
- Opening a lead detail page should auto-mark it as read
- The "Uncontacted" stat card logic should remain separate from read/unread — these are different concepts

## FEATURE 2: Draggable/resizable Reports Dashboard widgets
Make the Reports Dashboard widgets movable and resizable:
- Use a library like react-grid-layout or similar
- Users should be able to drag widgets to reorder them
- Users should be able to resize widgets
- Layout should persist per user (save to database or localStorage)
- Include a "Reset Layout" button to go back to default
- Make sure the charts re-render properly when their container is resized

## FEATURE 3: Customizable/configurable report charts
The Reports Dashboard needs more flexible charting:
- Add the ability to create custom chart widgets that can break down leads by ANY lead field
- Support fields that contain multi-select data (like PM software used, listing locations, states served) — each selected value should be counted individually, not as a concatenated string
- Chart types should include at minimum: bar chart, pie/donut chart, and trend line over time
- Users should be able to add a new chart, pick the field to analyze, pick the chart type, and optionally filter by date range
- Examples of charts users would want:
  - "Most common property management software" (bar chart of multi-select field)
  - "Where do leads list rentals" (bar chart of multi-select field)
  - "Lead volume by debt type over time" (stacked area/bar)
  - "Leads by industry" (pie chart)
- These custom charts should also be draggable/resizable as part of the grid layout from Feature 2

## IMPORTANT: Multi-select field handling
This affects multiple features. Audit all lead fields that can have multiple values (states, PM software, listing locations, etc.) and make sure:
- They're stored as arrays/JSON in the database, not comma-separated strings
- All queries that aggregate or filter by these fields handle arrays properly
- The Webflow form integration parses multi-select fields into arrays on ingestion
- Search and filtering in the inbox works correctly with array fields

Plan all of this out first, then implement in this order:
1. Timezone fix (affects everything)
2. Multi-select field data model fix (foundational)
3. Read/unread
4. Draggable/resizable dashboard
5. Custom charts