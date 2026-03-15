Multiple fixes and features needed. Read everything, plan, then implement.

## FIX 1: Replace ALL remaining browser popups with CSS modals
- The delete template confirmation is still using a browser confirm() dialog — replace with a custom styled modal matching the app's design system
- Audit the ENTIRE app for any remaining browser alert(), confirm(), or prompt() calls and replace ALL of them with custom CSS modals
- Every confirmation dialog should have clear Cancel/Confirm buttons styled consistently

## FIX 2: Email template rich text editor — toolbar buttons broken
The H1, H2, H3, bullet list, numbered list buttons are not working. The editor needs to be fully functional. Options:
- If using contentEditable + execCommand: that API is deprecated and unreliable. Switch to a proper rich text editor library.
- Recommended: Replace the current editor with Tiptap (headless, built on ProseMirror) or React-Quill. Tiptap is preferred because it's more customizable and actively maintained.
- The editor MUST support:
  - Bold, italic, underline, strikethrough
  - H1, H2, H3 headings (visually render in the editor AND in the output)
  - Bullet lists (unordered)
  - Numbered lists (ordered)
  - Text alignment (left, center, right, justify)
  - Link insertion via custom CSS modal (not browser prompt)
  - Image insertion: both URL and file upload (see Fix 3)
  - Code/HTML view toggle (the </> button)
  - Merge variable insertion (Insert Field dropdown)
  - Lead summary table insertion
- The toolbar buttons should show active/pressed state when the cursor is in formatted text
- Output should be clean HTML suitable for email clients

## FIX 3: Image upload in email templates
- The image upload feature isn't working
- Implement a proper image upload flow:
  1. User clicks image button in toolbar
  2. Custom CSS modal appears with two tabs: "Upload" and "URL"
  3. Upload tab: file picker, preview, uploads to our server, inserts the served URL into the editor
  4. URL tab: paste an image URL, preview it, insert into editor
  5. Store uploaded images in a persistent location (public/uploads/ or a dedicated image storage path)
  6. Create an API endpoint for image uploads (POST /api/uploads/images)
  7. Return the served URL after upload
  8. Insert the image into the editor at cursor position

## FIX 4: Insert Field and Summary Table — must include ALL lead intake form fields
The Insert Field dropdown and the summary table must include every field that comes from the lead intake form. Here is the complete list — make sure ALL of these are available as merge variables:

Contact fields:
- {{first_name}}
- {{last_name}}
- {{full_name}}
- {{company_name}}
- {{title}}
- {{email}}
- {{phone}}
- {{alternate_phone}}

Location fields:
- {{address_1}}
- {{address_2}}
- {{city}}
- {{state}} (all states selected)
- {{zip}}
- {{country}}

Business/case fields:
- {{industry}}
- {{debt_type}}
- {{balance_amount}}
- {{estimated_claim_value}}
- {{account_volume}} / {{units}}
- {{service_requested}}
- {{notes_from_form}}
- {{urgency}}
- {{business_type}}
- {{geographic_scope}}

Property management specific fields (from Webflow form):
- {{pm_software}}
- {{listing_locations}}
- {{property_types}}
- {{number_of_units}}
- {{number_of_properties}}
(Add any other fields that exist in the lead intake form — check the Webflow form field mapping)

Metadata fields:
- {{lead_source}}
- {{source_page}}
- {{utm_source}}
- {{utm_medium}}
- {{utm_campaign}}

Internal/system fields:
- {{score}}
- {{quality_tier}}
- {{status}}
- {{assigned_user_name}}
- {{created_at}}

Referral partner fields (for referral-type templates):
- {{referral_partner_name}}
- {{referral_partner_contact_name}}
- {{referral_partner_email}}
- {{referral_partner_phone}}
- {{referral_partner_website}}

Organize these into grouped sections in the Insert Field dropdown (Contact, Location, Business, Metadata, System, Referral Partner).

For the Lead Summary Table insertion, let users pick which fields to include from this same list.

## FIX 5: Email type dropdown font
The Type dropdown in the email template editor is STILL not using the Outfit font. This has been flagged before. Find the specific select/dropdown element for email type selection and force Outfit font on it. Check:
- The select element itself
- The option elements inside it
- Any custom dropdown wrapper
- Apply: font-family: 'Outfit', sans-serif !important if needed
- Test in Chrome and make sure it renders correctly

## FEATURE 1: Email Types management in Admin Settings
Create a new admin settings section: "Email Types"
- List all existing email types with their name, color, and referral flag
- Add new email type: name (text), color (color picker), is_referral (boolean toggle)
- Edit existing types: change name, color, referral flag
- Delete custom types (prevent deletion if templates are using that type)
- Pre-seed defaults: Intro Email (keep current color), Follow-Up Email, Referral Email (flagged as referral), Internal Handoff
- Store email types in a database table: id, name, color (hex), is_referral (boolean), sort_order, created_at, updated_at
- The color should be reflected everywhere the type badge appears:
  - Template list page badges
  - Email selection popup on lead detail page
  - Template editor Type dropdown
- The email template editor Type dropdown should pull from this database table, not a hardcoded list
- When is_referral is true, show "Referral" badge in the email selection popup

## FEATURE 2: Customizable Lead Inbox widget boxes
The 4 stat boxes at the top of the Lead Inbox (currently New Today, Uncontacted, High Quality, Follow-Up) need to become fully customizable widgets:

- Each box should have a settings gear icon that opens a configuration modal
- Users can select what metric/data each box displays from a list of options including:
  - New Today (count)
  - New This Week (count)
  - New This Month (count)
  - Total Leads (count)
  - Uncontacted (count)
  - Unread (count)
  - High Quality / A Leads (count)
  - B Leads (count)
  - C Leads (count)
  - Poor Fit (count)
  - Follow-Up Needed (count)
  - Referred Out (count)
  - Contacted (count)
  - Disqualified (count)
  - Duplicates (count)
  - Average Score (number)
  - Contact Rate (percentage)
  - Leads in Good States (count)
  - Leads in Bad States (count)
  - Total Estimated Value (sum of balance_amount)
  - Total Units (sum of units)
  - Mini chart: Leads by tier (small bar/donut)
  - Mini chart: Leads by status (small bar/donut)
  - Mini chart: Daily lead volume (sparkline)
  - Mini chart: Score distribution (small histogram)
- Each widget box should support:
  - The metric value (big number)
  - A label
  - An icon
  - Optional mini chart/sparkline
  - Optional trend indicator (up/down vs previous period)
  - Optional color coding
- Save widget configuration per user
- Include a "Reset to Default" option
- Allow users to also change the number of widget boxes (4, 5, or 6) if screen width allows

## FEATURE 3: State Management System in Admin Settings
Create a new admin settings section: "State Configuration"

### Default state classifications (pre-seed these):

GOOD STATES (green):
AL, AR, FL, GA, IL, KS, KY, LA, MI, MS, MO, MT, NE, NJ, NM, OH, OK, PA, SC, TN, TX, UT, VT, VA, WI

BAD/BANNED STATES (red/orange):
AK, AZ, CA, CO, CT, DE, DC, HI, ID, IN, IA, ME, MD, MA, MN, NV, NH, NY, NC, ND, OR, RI, SD, WA, WV, WY

Some banned states have notes like "Can Collect, No Solicit" — store this as a note/sub-status.

### Admin UI:
- Show all 50 states + DC in a table or grid
- Each state has:
  - Abbreviation
  - Full name
  - Classification: Good / Banned / Unknown (dropdown or toggle)
  - Sub-status/note: free text (e.g., "Can Collect, No Solicit", "Open except NY City, Buffalo & Yonkers")
  - Active toggle
- Color-coded: green rows for good, red/orange rows for banned
- Bulk actions: select multiple states and change classification
- Search/filter

### Integration with Scoring Rules:
- Scoring rules should be able to reference state classification
- Example rules the system should support:
  - "If ALL lead states are Good states: +15"
  - "If ANY lead state is a Banned state: -20"
  - "If more than 50% of lead states are Banned: disqualify"
  - "If lead has states in both Good and Banned: flag for manual review"
- Add state classification as a condition type in the scoring rules engine

### State pills throughout the app:
- Everywhere a state is displayed (lead inbox, lead detail, referral partners, etc.):
  - Good states: green pill/badge
  - Banned states: red or orange pill/badge
  - Unknown/unclassified states: default blue pill/badge
- This applies to:
  - Lead inbox State column
  - Lead detail page state display
  - Referral partner "States Served" display
  - Any filters or dropdowns showing states
  - Geographic heatmap (use green/red coloring)

## Implementation order:
1. Replace all browser popups with CSS modals (quick, touches everything)
2. Email type management system in admin settings (foundational for template editor)
3. State management system in admin settings (foundational for scoring and display)
4. Rich text editor replacement (Tiptap or equivalent)
5. Image upload system
6. Insert Field complete list + summary table
7. Email type dropdown font fix
8. Customizable inbox widget boxes
9. State pill colors throughout the app
10. Scoring rules state classification integration