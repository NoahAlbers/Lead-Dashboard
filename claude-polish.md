Fixes needed across state pills, inbox layout, email referral flow, tier colors, and reports. Read all then plan.

## FIX 1: State pills — color not applying to full state names
State pill colors are only working on abbreviated state names (like "FL" shows green) but full state names like "Florida", "Michigan", "Georgia", "Alabama" are all showing as default blue/gray pills. The lookup logic is probably only matching on abbreviation. Fix:
- The state classification lookup must match on BOTH full state name AND abbreviation
- "Florida" and "FL" should both resolve to Good → green
- "Michigan" and "MI" should both resolve to Good → green  
- "Georgia" and "GA" should both resolve to Good → green
- "Alabama" and "AL" should both resolve to Good → green
- Create a mapping utility that normalizes any state input (full name, abbreviation, mixed case) to the classification
- Apply this fix everywhere state pills render: lead inbox table, lead detail page, referral partners, etc.
- Test with the existing leads to confirm all pills are colored correctly

## FIX 2: Lead inbox table — fill full width, no white space gap
The lead inbox table header row has white space on the right side — the table isn't filling the full available width. Fix:
- The table should always stretch to fill 100% of its container width
- When columns are resized, the remaining columns should distribute to fill the space
- If total column widths are less than container width, the last column (or all columns proportionally) should expand to fill
- Set table-layout and width so there's never a visible gap between the last column header and the container edge
- The data rows should align with the headers perfectly

## FIX 3: Referral email template selection — must prompt for partner selection
When a user clicks the email action on a lead and selects a referral-type email template, it should:
1. Show the template selection modal (already working)
2. When a referral-type template is selected, BEFORE opening the mail client, show a second step:
   - "Select Referral Partner" with a list of active referral partners
   - Each partner entry shows: name, states served, specialties, claim size range
   - Each partner has an "expand/more info" button that opens a detail panel showing ALL partner info (all emails, contact name, phone, website, industries, exclusions, notes, custom fields)
   - User clicks to select a partner
3. After partner is selected, populate the email template with BOTH lead fields AND partner fields:
   - {{referral_partner_name}} → selected partner's name
   - {{referral_partner_contact_name}} → partner's contact name
   - {{referral_partner_email}} → partner's primary email
   - {{referral_partner_phone}} → partner's phone
   - {{referral_partner_website}} → partner's website
   - All lead fields as normal
4. Set the email recipient to the selected partner's email
5. Then open the mail client with the fully populated email
6. Log the referral action with which partner was selected

If the template is NOT a referral type, skip the partner selection and go straight to populating with lead fields and opening the mail client as it works now.

## FIX 4: Quality tier pills — use colors from settings
The tier pills in the lead inbox (A Lead, B Lead, C Lead, Poor Fit) are all showing as purple/lavender. They should use the colors configured in the Quality Tiers settings:
- A Lead → green (the green dot color from settings)
- B Lead → blue (the blue dot color from settings)
- C Lead → yellow/amber (the yellow dot color from settings)
- Poor Fit → red/pink (the red dot color from settings)
- Pull these colors dynamically from the quality tier configuration in the database
- Apply as the pill background color (with appropriate text contrast)
- Apply everywhere tier pills appear: lead inbox table, lead detail page, reports, filters

## FIX 5: Quality Trend chart — fix display
The Quality Trend chart (tier mix over time) looks broken — it's showing overlapping filled areas that are hard to read. Fix:
- This should be a stacked area chart or stacked bar chart showing the count of leads per tier over time
- Each tier should use its configured color (from the tier settings)
- X-axis: dates
- Y-axis: lead count
- Each tier is a distinct layer/series, stacked so you can see the total and the mix
- If there's very little data (only 2 days), it should still render cleanly — maybe use bars instead of area for sparse data
- Make sure the legend shows each tier with its correct color

## FIX 6: Remove Lead Sources widget
- Remove the "Lead Sources" widget from the default reports dashboard layout entirely
- All leads come from the same source so this chart adds no value
- If it's part of the default widget config, remove it from the defaults
- Users shouldn't see it unless they explicitly add a custom chart for lead source later

## FIX 7: Quality Distribution widget — fix rendering
The Quality Distribution donut/pie chart is broken — it's just showing "5 leads" text with no chart. Fix:
- This should be a donut or pie chart showing the breakdown of leads by quality tier
- Each segment colored by the tier's configured color
- Show the count or percentage per tier
- Center label can show total lead count
- If only one tier has leads, it should still render as a full donut in that tier's color with a label
- Check if the issue is a data query problem (not returning tier breakdown) or a rendering problem (chart component not receiving data correctly)

## FIX 8: Custom charts — debug and fix
The custom chart builder/viewer in the reports dashboard isn't working. Debug:
- Can users add a new custom chart? Does the "Add Chart" flow work?
- After adding a custom chart, does it render?
- Check the data query — is it actually fetching and aggregating the selected field's data?
- Check multi-select field handling — fields like PM software, listing locations, states need to be exploded from arrays so each value is counted individually
- Make sure chart type selection works (bar, pie/donut, trend line)
- Test with a concrete example: create a chart for "Leads by State" as a bar chart — each state that appears in any lead should have a bar with its count
- If the issue is that there's not enough varied data with only 5 test leads, make sure the charts at least render with whatever data exists rather than showing nothing

Plan then implement in this order:
1. State pill color lookup fix (quick, high visibility)
2. Tier pill colors from settings (quick, high visibility)  
3. Table full-width fix (quick layout fix)
4. Quality Distribution chart fix (reports)
5. Quality Trend chart fix (reports)
6. Remove Lead Sources widget (reports cleanup)
7. Custom charts debugging (reports)
8. Referral email partner selection flow (biggest feature)