# Reports Dashboard - Complete Overhaul

The current reports dashboard is bare bones with 4 stat cards and 2 mostly-empty charts. Replace it with a full analytics suite using a customizable widget system. Read the full codebase first.

---

## Architecture: Widget System

### How it works:
- The dashboard is a grid of **widgets** (cards that contain charts, stats, tables, or maps)
- Each widget has a consistent wrapper: title, optional subtitle, optional time range override, and a "..." menu
- The grid uses CSS Grid with auto-placement. Default layout is 2 columns on desktop, 1 on mobile
- Some widgets span full width (2 columns), others are single column
- Users can customize the dashboard via a "Customize Dashboard" button in the top-right:
  - Opens a modal showing all available widgets as toggleable cards
  - Drag-and-drop to reorder widgets
  - Toggle widgets on/off
  - Save layout to localStorage and to the user's preferences in the database
  - "Reset to Default" button

### Widget wrapper component:
```jsx
<DashboardWidget 
  title="Leads Over Time" 
  subtitle="Daily new leads"
  span={2}  // 1 = half width, 2 = full width
  height={300}  // chart height in px
>
  {/* Chart content */}
</DashboardWidget>
```

Each widget wrapper includes:
- Title (bold, 16px)
- Subtitle (grey, 13px, optional)
- A "..." icon menu in the top-right with options: "Hide widget", "Export as CSV" (for table widgets), "Export as PNG" (for chart widgets)

### Global controls (top bar):
- Time range selector: 7d | 30d | 90d | 1y | All Time (pill buttons, default 30d)
- Date range picker: custom from/to dates that override the preset
- "Customize Dashboard" button
- "Export All" dropdown: PDF report, CSV data dump

---

## Data Fix: State Normalization

**BUG:** The "Top States" chart currently shows "FL" and "Florida" as separate entries because some leads store the abbreviation and some store the full name. 

Fix this by normalizing all state values to full names on ingest. Create a lookup map and run it when:
1. A new lead comes in via webhook
2. When displaying state data in charts

```javascript
const STATE_ABBREV_TO_NAME = {
  "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", // ... all 50+DC
  "FL": "Florida", "GA": "Georgia", // etc
};

function normalizeState(input) {
  if (!input) return input;
  const trimmed = input.trim();
  return STATE_ABBREV_TO_NAME[trimmed.toUpperCase()] || trimmed;
}
```

Also run a one-time migration on existing leads to normalize their state data.

---

## Widget Definitions

### ROW 1: Key Metrics (4 stat cards, full width row)

**Widget: KPI Cards** (span: 2, special layout - 4 cards in a row)
Display as a horizontal row of 4 stat cards, same style as current but with improvements:

| Card | Metric | Calculation | Icon |
|------|--------|-------------|------|
| Total Leads | Count of leads in time range | Simple count | inbox icon |
| Avg Score | Average lead score | Mean of all lead scores in range | star icon |
| Contact Rate | % of leads contacted | (Contacted + Qualified + Won) / Total * 100 | phone icon |
| Est. Units | Total units in pipeline | Sum of totalUnits from all leads in range | building icon |

Each card should show:
- The metric name (small, grey)
- The big number (32px, bold)
- A small trend indicator: ↑12% or ↓5% compared to the previous period of same length (green for up on good metrics, red for down)
- A sparkline (tiny line chart, ~40px tall) showing the daily values for the time range

---

### ROW 2: Volume & Quality

**Widget: Lead Volume Over Time** (span: 2, full width)
- Bar chart showing daily lead count for the selected time range
- Each bar colored by tier (stacked): A Lead (green), B Lead (blue), C Lead (yellow), Poor (red)
- X-axis: every day labeled (show date for every day if 30d or less, weekly labels for 90d+)
- Y-axis: lead count
- Hover tooltip: "Mar 15: 3 leads (1 A, 1 B, 1 C)"
- Smooth animation on load

**Widget: Quality Distribution** (span: 1)
- Donut/ring chart showing current tier breakdown
- Center text: total lead count
- Legend below with count and percentage for each tier
- Colors match tier colors from settings

**Widget: Quality Trend** (span: 1)
- Stacked area chart showing tier proportions over time
- Same time range as global selector
- Shows how lead quality is trending (are we getting more A leads over time?)

---

### ROW 3: Pipeline & Velocity

**Widget: Pipeline Funnel** (span: 1)
- Horizontal funnel visualization showing:
  New → Contacted → Qualified → Won
- Each stage shows count and conversion rate to next stage
- E.g., "New: 45 → Contacted: 32 (71%) → Qualified: 18 (56%) → Won: 8 (44%)"
- Color gradient from blue (top) to green (bottom/won)
- Also show "Lost" and "Disqualified" branching off to the side with counts

**Widget: Status Breakdown** (span: 1)
- Horizontal bar chart showing count of leads in each status
- Bars colored to match status colors from settings
- Sorted by count descending
- Show count label at end of each bar

---

### ROW 4: Geography & Sources

**Widget: Geographic Heatmap** (span: 1)
- SVG map of the US (reuse the same SVG paths from the intake form!)
- States colored by lead density: lighter = fewer leads, darker blue = more leads
- Hover shows: "Florida: 12 leads (450 units)"
- Include a color scale legend
- This is a powerful visual since ACB is nationwide

**Widget: Lead Sources** (span: 1)
- Horizontal bar chart or treemap showing where leads come from
- Parse the "Referrer" field from lead data
- Categories: Direct, Google (organic), Google (ads), Social Media, Referral Partner, Other
- Normalize referrer URLs into these buckets:
  - google.com → "Google (organic)"
  - Contains "utm_medium=cpc" or "gclid" → "Google (ads)"  
  - facebook.com, instagram.com, linkedin.com → "Social Media"
  - Referral partner name → "Referral: [Partner Name]"
  - "(Direct visit)" → "Direct"
  - Everything else → "Other"
- Show count and percentage

---

### ROW 5: Scoring & Engagement

**Widget: Scoring Rule Effectiveness** (span: 1)
- Table showing each active scoring rule, how many leads it has triggered for, and the average score impact
- Columns: Rule Name | Leads Matched | Avg Impact | % of Leads
- Sort by "Leads Matched" descending
- Helps identify which rules are actually differentiating leads vs. applying to everyone
- Highlight rules that match 0 leads (they might be misconfigured)
- Highlight rules that match 100% of leads (they're not differentiating anything)

**Widget: Avg Score Over Time** (span: 1)
- Line chart showing the rolling average lead score over the time range
- Helps visualize if lead quality is improving or declining
- Add a horizontal dashed line at the A Lead threshold (e.g., 80) for reference

---

### ROW 6: Abandonment & Form Analytics

**Widget: Form Completion Rate** (span: 1)
- Requires tracking partial submissions (the intake form already sends partial submissions via sendBeacon on abandonment)
- Show: Total form starts vs. completions as a big percentage
- Below that, a horizontal funnel showing where people drop off:
  - Started → Contact Info → Debt Type → States → Completed
- Each step shows the count and drop-off percentage
- Identify the step with the highest abandonment

**Widget: Partial Submissions** (span: 1)
- Table listing recent partial/abandoned form submissions
- Columns: Name | Email | Phone | Last Step | Date
- These are leads that started the form, got past contact info, but didn't finish
- Each row should have a "Create Lead" button that converts the partial into a full lead for follow-up
- Sort by most recent first
- This is GOLD for your sales team - these are warm leads who were interested enough to start but didn't finish

---

### ROW 7: Detailed Tables

**Widget: Recent Leads** (span: 2, full width)
- Table showing the most recent 10 leads with key columns
- Columns: Date | Company | Contact | Score | Tier | Status | Units | State
- Each company name is a clickable link to the lead detail
- Quick action icons on hover (same as lead inbox)
- "View All →" link at bottom that goes to Lead Inbox

**Widget: Top Leads by Score** (span: 1)
- Leaderboard showing top 10 leads by score
- Shows: Rank | Company | Score | Tier | Units
- Highlight any that are still "New" status (haven't been contacted yet) with a subtle badge

**Widget: Upcoming Follow-Ups** (span: 1)
- Table showing leads marked as "Follow-Up Needed"
- Shows: Company | Contact | Last Activity | Days Since Contact
- Sorted by "Days Since Contact" descending (oldest first = most urgent)
- Highlight leads with no contact in 3+ days in yellow, 7+ days in red

---

### ROW 8: Portfolio Analysis

**Widget: Unit Distribution** (span: 1)
- Histogram/bar chart showing the distribution of portfolio sizes
- Buckets: 1-50, 51-100, 101-250, 251-500, 501-1000, 1000+
- Shows how many leads fall into each size bucket
- Useful for understanding your typical client profile

**Widget: Avg Rent Distribution** (span: 1)
- Histogram showing distribution of average rent per unit
- Buckets: <$1000, $1000-1500, $1500-2000, $2000-3000, $3000-5000, $5000+
- Helps understand the market segments coming through

---

### ROW 9: Time-Based Performance (for future rep tracking)

**Widget: Response Time** (span: 1)
- Shows average time from "Lead Created" to first status change (typically New → Contacted)
- Display as a big number: "2.4 hours avg response time"
- Below that, a small distribution chart showing: <1hr, 1-4hr, 4-12hr, 12-24hr, 24hr+
- Green if avg is under 4 hours, yellow if 4-12, red if 12+

**Widget: Activity Feed** (span: 1)
- Compact scrollable feed showing recent activity across all leads
- Shows: "Noah marked Sunshine PM as Contacted - 2 hours ago"
- Limit to last 20 activities
- Click any entry to jump to that lead

---

## Chart Library

Use **Recharts** (already likely in the project since it's React). If not installed:
```
npm install recharts
```

For the geographic heatmap, reuse the US state SVG paths. Don't install a separate mapping library. The SVG data from the intake form (the SimpleMaps paths) can be extracted and used. Define a constant `US_STATE_PATHS` with the path data for each state, then render an SVG with fills based on lead count.

If the SVG paths are too large to duplicate, create a shared module that both the intake form and dashboard can import from, or fetch the SVG data from the GitHub repo at runtime:
```
https://raw.githubusercontent.com/NoahAlbers/acb-form/main/us-states.json
```

---

## Color Palette for Charts

Use consistent, accessible colors across all charts:
- A Lead / Success: #16a34a (green)
- B Lead / Info: #3D5AF1 (brand blue)
- C Lead / Warning: #eab308 (yellow)
- Poor / Danger: #ef4444 (red)
- Neutral / Other: #8889A0 (grey)
- Contacted: #06b6d4 (cyan)
- Qualified: #22c55e (green)
- Won: #10b981 (emerald)
- Lost: #ef4444 (red)

---

## Implementation Priority

Build in this order:
1. Widget wrapper component + grid layout + customize modal
2. KPI stat cards with sparklines and trend indicators  
3. Lead Volume Over Time (stacked bar chart)
4. Quality Distribution (donut) + Quality Trend (area chart)
5. Pipeline Funnel + Status Breakdown
6. Geographic Heatmap + Lead Sources
7. Scoring Rule Effectiveness + Avg Score Over Time
8. Form Completion Rate + Partial Submissions table
9. Recent Leads + Top Leads + Follow-Ups tables
10. Unit Distribution + Rent Distribution histograms
11. Response Time + Activity Feed

Each widget should gracefully handle empty states (show "No data for this period" with a subtle illustration or icon, not a blank card).

---

## State Normalization Fix (do this FIRST before any charts)

Before building any charts, fix the state data normalization bug. The "Top States" chart currently shows "FL" and "Florida" as separate entries. 

1. Create a state normalization utility (abbreviation → full name)
2. Add it to the webhook ingest pipeline so new leads get normalized states
3. Write a one-time migration script that normalizes states on all existing leads
4. Use the normalized values everywhere states are displayed or aggregated