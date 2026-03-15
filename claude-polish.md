# Lead Management Console - Complete Polish & Feature List

## Context
This is a lead management console for Advanced Collection Bureau (ACB), a residential rental debt collection agency. Leads come in from an intake form that collects: name, company, email, phone, website, debt types, states they operate in, total units, rental types, property types, average rent, listing sites, PM software, ownership type, prior agency experience, whether they have debts ready now, and comments. The console needs to help the sales team prioritize, contact, and convert these leads efficiently.

---

## CRITICAL FIXES (from user feedback)

### 1. Lead Scoring - Reactive Recalculation
- When ANY scoring rule is changed, enabled, disabled, added, or deleted, ALL lead scores must be recalculated immediately
- This should happen server-side/in-state, not require a manual refresh
- Show a brief toast notification: "Recalculating scores for X leads..." when rules change
- The lead inbox should update in real-time after recalculation

### 2. Custom Quality Tiers - User-Configurable Ranges
- Each quality tier should have an editable min and max score range
- Current defaults: A Lead (80-100), B Lead (60-79), C Lead (40-59), Poor Fit (0-39)
- User should be able to drag range boundaries or type in values
- Ranges must not overlap and must cover 0-100 completely
- Validate: warn if user tries to save overlapping ranges

### 3. All Timestamps in EST
- Every timestamp in the activity timeline, lead creation dates, and report dates should display in EST
- Format: "Mar 15, 2026 3:36 AM EST" or similar clear format
- If the user's browser is in a different timezone, still show EST (this is for a Florida-based company)

### 4. Notification System (Red Dot)
- Red notification badge on "Lead Inbox" in the left sidebar showing count of new/uncontacted leads
- Badge should show the number (e.g., a red circle with "3" inside)
- In the lead inbox table, new leads (status: "New") should have a subtle visual indicator:
  - Option A: A blue dot or "NEW" badge next to their name
  - Option B: A slightly different row background (very subtle light blue tint)
  - Option C: Bold text for the row until status changes from "New"
- The notification count should update when leads are marked as contacted/reviewed
- Consider: the badge clears when the user views the inbox, or when they individually acknowledge leads

### 5. Reports Dashboard Fixes
- Default time range: 30 days (already noted as 30d in the UI)
- Charts should show EVERY day of the last 30 days on the x-axis (not just weekly ticks)
- Change "Est. Value" metric to "Est. Units" - this should sum the totalUnits field from all leads in the selected time range
- All chart data should properly connect to actual lead data:
  - "Leads Over Time": daily count of new leads
  - "Quality Distribution Over Time": stacked area/bar showing A/B/C/Poor leads per day
  - "Status Breakdown": count of leads in each status
  - "Top States": count of leads by their primary state (or all states they operate in)
  - "Conversion Rate": leads marked "Won" / total leads in the period

### 6. Lead Inbox Table Improvements
- REMOVE the "Assigned" column
- ADD quick action buttons on hover (in the existing Action column area):
  - ✓ Mark Contacted (green check icon)
  - 🔔 Follow-Up Needed (bell/clock icon)  
  - ⭐ Mark Qualified (star icon)
  - ✕ Disqualify (red X icon)
- Each button should have a tooltip on hover showing the action name
- Clicking a quick action should immediately update the lead's status with a subtle animation
- The quick action buttons should only appear on row hover (hidden by default to keep the table clean)

### 7. Lead Detail View Improvements
- Move "Intake Form Details" section to the BOTTOM of the page (below Qualification and Activity Timeline)
- The detail view should properly support and display multiple states (currently shows single state)
  - Display as comma-separated list or as small pill badges
  - In the "State" field, show all states from the lead's form submission

---

## ADDITIONAL POLISH ITEMS

### 8. Lead Detail View - More Data Display
The intake form collects a LOT of data that should be visible in the detail view. Add sections for:

**Company Profile:**
- Company name, website (clickable link), ownership type
- Total units managed, average rent per unit
- Rental types (luxury, affordable, conventional, student, senior)
- Property types (SFH, multi-family, communities, townhomes, condos, mixed-use)

**Collections Readiness:**
- Debt types they need collected
- Whether they have debts ready now (Yes/No)
- Prior agency experience (Yes/No)
- States they operate in (full list with state pills)

**Operations Info:**
- PM software they use
- Where they list rentals
- Comments/questions from the form

**Tracking Data (collapsible section at bottom):**
- Location / IP
- Device info
- Referrer / UTM data
- Clarity recording link (clickable)
- Timezone
- Submission timestamp (EST)

### 9. Scoring Rules - Suggested Rules Based on Form Data
The scoring system should be able to evaluate any field from the intake form. Suggested default rules:

**High-value signals (+15 to +25 each):**
- Total units > 500 → +20
- Total units > 1000 → +25 (replaces the 500 rule)
- Has debts ready now → +15
- Average rent > $2,000 → +10
- Residential rental debt selected → +15
- Multiple states → +10
- Prior agency experience = "Yes" (they're shopping) → +10

**Medium-value signals (+5 to +10 each):**
- Complete contact info provided → +10
- Has a website → +5
- Uses PM software (not "None") → +5
- Conventional or luxury rental types → +5

**Location-based signals:**
- Florida → +15 (home market)
- Southeast states (GA, AL, SC, NC, TN) → +10
- Other configurable state bonuses

**Negative signals (-5 to -15):**
- No residential rental debt selected → -15
- Total units < 50 → -5
- No debts ready now → -5

### 10. Email Templates
The Email Templates section should come with pre-built templates:

**Initial Outreach (A Lead):**
Subject: "[Company Name] + Advanced Collection Bureau"
Body template with merge fields: {firstName}, {companyName}, {totalUnits}, etc.

**Initial Outreach (B Lead):**
Slightly different tone, less aggressive

**Follow-Up (No Response):**
Subject: "Following up - {companyName}"

**Follow-Up (After Call):**
Subject: "Great speaking with you, {firstName}"

**Referral Partner Introduction:**
For non-residential leads being referred out

Templates should support merge fields that auto-populate from the lead data.

### 11. Referral Partners Section
Since ACB refers non-residential debt leads to other agencies, the Referral Partners section should:
- Store partner agency names, contact info, specialties (medical debt, commercial, etc.)
- When a lead is marked "Referred Out", prompt to select which referral partner
- Track which leads were sent to which partners
- Optionally: notify the referral partner via email

### 12. Bulk Actions in Lead Inbox
- Checkbox on each row for multi-select
- "Select All" checkbox in the header
- Bulk actions dropdown: Mark Contacted, Mark Qualified, Disqualify, Export Selected, Delete
- Confirm dialog for destructive actions

### 13. Search & Filter Improvements
- The search bar should search across: company name, contact name, email, phone, states
- Add filters for:
  - Debt type (residential, commercial, etc.)
  - Unit count range (e.g., 100-500, 500-1000, 1000+)
  - Has debts ready now (Yes/No)
  - Prior agency experience
  - Source (intake_form, referral, manual)
  - Date range (already present)

### 14. Export Functionality
- "Export" button in the lead inbox toolbar
- Export to CSV with all lead data
- Option to export filtered results or all leads
- Include all intake form fields in the export

### 15. Activity Timeline Enhancements
- Show more detailed activity entries:
  - "Status changed from New to Contacted"
  - "Email sent: Initial Outreach"
  - "Phone call logged: 5 min"
  - "Note added: [preview of note text]"
  - "Score recalculated: 75 → 95"
- Each entry should show the user who performed the action
- Support adding manual notes with a text input at the top of the timeline
- All timestamps in EST

### 16. Dashboard Additions
Consider adding these to the Reports Dashboard:
- **Average Time to Contact**: How long from lead creation to first status change
- **Lead Source Breakdown**: pie chart showing where leads come from
- **Top Performing Scoring Rules**: which rules are triggering most often
- **Pipeline Funnel**: New → Contacted → Qualified → Won/Lost visual funnel

### 17. Users & Permissions
- Multiple user roles: Admin, Sales Rep
- Admin: full access, can manage scoring rules, templates, settings
- Sales Rep: can view/edit leads assigned to them, log activities
- Lead assignment: manually assign leads to sales reps
- Dashboard should filter by assigned user for Sales Reps

### 18. Mobile Responsiveness
- The console should work on tablets at minimum
- Lead inbox table should be scrollable horizontally on smaller screens
- Lead detail view should stack sections vertically on mobile

### 19. Keyboard Shortcuts
- `n` - New lead
- `s` - Search focus
- `j/k` - Navigate up/down in lead list
- `/` - Focus search
- `Esc` - Close modals/go back

### 20. Webhook Integration for Intake Form
The intake form currently submits to FormSubmit.co for email delivery. To also populate the lead console, the form should ALSO POST to the console's API endpoint. This means the form submission function needs to fire TWO requests:
1. FormSubmit.co (for email notification)
2. Console API endpoint (for lead database)

The console API should accept the same JSON payload the form already sends and automatically create a new lead with all the data mapped to the right fields.

---

## UI/UX Notes
- The current design (dark sidebar, clean white content area) looks professional
- The ACB blue (#3D5AF1) and dark navy sidebar are on-brand
- Maintain the clean card-based layout
- Use consistent iconography throughout (the current mix of emoji-style and icon-style buttons should be standardized)
- Loading states: show skeleton loaders when data is being fetched
- Error states: show friendly error messages, not blank screens
- Success feedback: brief green toast notifications for actions ("Lead marked as contacted", "Score updated", etc.)