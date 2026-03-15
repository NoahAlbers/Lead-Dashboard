# Lead Dashboard - Round 2 Fixes

Read the full codebase before making any changes. These are 4 specific issues that need to be fixed properly.

---

## 1. QUALITY TIER SCORE RANGES - Complete Rework

The current implementation is fundamentally broken. Right now there are 4 hardcoded default ranges (A Lead, B Lead, C Lead, Poor Fit) that can have their numbers edited, and a separate "Custom Tiers" section below where you can add tiers but NOT set ranges on them. This entire system needs to be unified into a single, fully flexible tier management system.

### What needs to change:

**Remove the separation between "Quality Tier Score Ranges" and "Custom Tiers".** There should be ONE list of tiers. Every tier is equal - all can be added, removed, renamed, recolored, and have their range set.

**There should be NO hardcoded default tiers that can't be deleted.** The system ships with 4 defaults (A Lead 80-100, B Lead 60-79, C Lead 40-59, Poor Fit 0-39) but the user should be able to delete any of them, rename them, change their ranges, change their colors, and add as many new ones as they want.

### UI for the unified tier list:

Display all tiers as cards in a single section called "Quality Tiers". Each card shows:
- Color dot (clickable to change color via a small color picker or preset palette)
- Tier name (editable inline text field)
- Score range: two number inputs "min" and "max" (both editable)
- Delete button (trash icon, with confirm dialog)

Below the tier cards:
- "+ Add Tier" button that adds a new tier with a default name like "New Tier" and an empty range

**Ranges CAN overlap.** The user explicitly said they want to be able to overlap ranges. Do NOT validate against overlaps. Do NOT show error messages about overlapping ranges. If two tiers cover the same score, the lead gets assigned to whichever tier appears first in the list (highest priority).

**Ranges do NOT need to cover 0-100 completely.** If there's a gap, leads in that gap simply get "Untiered" or no tier assigned.

**The order of the tier list determines priority.** Allow drag-and-drop reordering of the tier cards so users can set which tier takes priority in overlap situations.

### On save:
- Recalculate all lead tier assignments based on the new ranges
- Show a toast: "Tiers updated. Recalculating X leads..."

---

## 2. REMOVE RED NOTIFICATION DOT FROM CONTENT AREA

In the main content area, there is a red notification badge next to the "Lead Inbox" heading text (the big h1). Remove it. 

The red badge in the navy sidebar next to "Lead Inbox" in the left nav is fine and should stay. Only remove the one in the main content area heading.

Find the JSX/component that renders the Lead Inbox page heading and remove the badge element from there.

---

## 3. FULL COLUMN CUSTOMIZATION IN LEAD INBOX TABLE

The lead inbox table currently has fixed columns. Implement full column customization with three interaction models:

### A. Column picker modal:
- Add a small gear/settings icon button to the right of the filter bar (next to the date pickers)
- Clicking it opens a modal titled "Customize Columns"
- The modal shows a checklist of ALL available columns with toggles to show/hide each one
- The list should be reorderable via drag-and-drop within the modal
- Available columns should include EVERY field from the intake form (see Section 4 for the full list), plus system fields like: Created, Score, Tier, Status, Read/Unread
- A "Reset to Default" button that restores the original column layout
- Changes apply immediately on close (or have an "Apply" button)

### B. Drag-and-drop column reordering:
- In the table itself, column headers should be draggable
- User can grab a column header and drag it to reorder
- Visual feedback: show a blue insertion line where the column will drop

### C. Right-click column header:
- Right-clicking any column header shows a context menu with:
  - "Hide this column"
  - "Sort ascending"
  - "Sort descending"  
  - "Reset column order"

### D. Sort by any column:
- Clicking any column header sorts by that column (toggle asc/desc)
- Show a small arrow indicator on the sorted column
- The current sort indicators on "Created", "Company", and "Score" should work on ALL columns

### Persistence:
- Save the user's column configuration (which columns are visible, their order, and column widths if resizable) to localStorage so it persists across page loads

---

## 4. COMPLETE FORM FIELD DISPLAY IN LEAD DETAIL VIEW

The intake form collects the following fields. ALL of them must be stored when a lead is created and ALL must be displayed somewhere in the lead detail view. Go through each field below and ensure it is:
1. Properly received and stored from the form webhook/API
2. Displayed in the lead detail view in the appropriate section

### Complete field list from the intake form:

**Contact & Company:**
- fullName (text) - "Jane Smith"
- companyName (text) - "Sunshine Property Management" 
- noCompany (boolean) - if true, display "(Independent Owner)"
- companyWebsite (text/URL) - should be a clickable link
- noWebsite (boolean) - if true, display "(No website)"
- email (text)
- phone (text, formatted as 000-000-0000)

**Certification:**
- certifyNoDebt (boolean) - confirmed they don't owe ACB
- certifyOwesDebt (boolean) - should never be true for a submitted lead

**Business Details:**
- priorAgency (text) - "Yes" or "No"
- debtTypes (array of strings) - e.g. ["Residential Rental Debt", "Commercial Rental Debt"]
- customDebtType (text) - free text if "Other" was selected
- debtsNow (text) - "Yes, we have accounts ready" or "Not yet, but soon"
- states (array of strings) - e.g. ["Florida", "Georgia", "Alabama"] - display as pill badges
- ownershipType (text) - "We own them", "We manage for others", or "We own and manage for others"
- ownPercent (number) - only relevant if ownershipType is "We own and manage for others", e.g. "60% own / 40% manage"
- totalUnits (text/number) - e.g. "500"
- rentalTypes (array of strings) - e.g. ["Luxury", "Conventional", "Student Housing"]
- propertyTypes (array of strings) - e.g. ["Single Family Homes", "Multi-Family", "Communities / HOA"]
- avgRent (number) - average rent per unit in dollars, e.g. 1500 → display as "$1,500/mo"
- listingSites (array of strings) - e.g. ["Zillow", "Apartments.com", "Own Website"]
- customListing (text) - free text if "Other" was selected
- pmSoftware (array of strings) - e.g. ["Buildium", "AppFolio"] or ["None"]
- customPM (text) - free text if "Other" was selected

**Comments:**
- comments (text) - free text, could be multiple paragraphs
- noQuestions (boolean) - if true, display "(No questions)"

**Tracking / Metadata:**
- Location / IP (text) - e.g. "Anaheim, California, United States (IP: 139.104.3.32)"
- Device (text) - e.g. "Desktop / Chrome / Windows"
- Referrer (text) - e.g. "google.com/search" or "(Direct visit)" or UTM data
- Clarity Recording (URL) - clickable link to Microsoft Clarity session recording
- Likely Timezone (text) - e.g. "America/New_York"
- Submitted EST (text) - e.g. "Sat, Mar 15, 2026, 3:36 AM EST"

### How to organize in the lead detail view:

**Section 1: Contact Information** (top, most prominent)
- Name, Company, Email, Phone, Website, States (as pill badges)

**Section 2: Portfolio Details**
- Total Units, Avg Rent, Ownership Type (with percent split if applicable)
- Rental Types (as pills), Property Types (as pills)
- Listing Sites (as pills), PM Software (as pills)

**Section 3: Collections Readiness**
- Debt Types (as pills, with custom type shown if applicable)
- Debts Ready Now (Yes/No with visual indicator)
- Prior Agency Experience (Yes/No)
- Comments (full text, or "(No questions)" if none)

**Section 4: Qualification** (already exists - lead score, tier, applied rules)

**Section 5: Activity Timeline** (already exists)

**Section 6: Tracking & Source** (collapsible, expanded by default)
- Location / IP
- Device
- Referrer / UTMs
- Clarity Recording (clickable link, open in new tab)
- Timezone
- Submission Time (EST)

### For array fields (states, debtTypes, rentalTypes, propertyTypes, listingSites, pmSoftware):
Display these as small rounded pill badges, similar to how tags work. Use a subtle background color (light blue or light grey) with the text inside. If there are custom/Other entries, show them with a slightly different style (e.g. italic or different badge color) so they stand out.

### Important:
- If a field is empty/null/undefined, don't show an empty row. Either hide it or show "Not provided" in grey italic.
- All these fields should also be available as column options in the Lead Inbox table (Section 3 above).
- The webhook/API endpoint that receives form submissions must accept and store ALL of these fields, not just a subset.