Multiple improvements needed across email templates, referral partners, UI branding, and favicon system. Read all before starting, then plan.

## EMAIL TEMPLATE EDITOR — Major Overhaul

### Fix broken toolbar buttons
- Bullet point buttons (ordered and unordered lists) don't work — fix them
- Header buttons (H1, H2, H3) don't work — fix them
- Bold, italic, underline should all work properly
- Alignment buttons should work
- The link button popup is currently a browser prompt — replace with a custom CSS modal
- The image button currently asks for a URL via browser prompt — replace with a custom CSS modal that supports BOTH image URL input AND direct image upload from the user's computer. Uploaded images should be stored and served from our system.

### Fix font consistency
- The email Type dropdown is not using the Outfit font. Ensure Outfit is applied consistently across all form elements in the template editor, including selects/dropdowns.

### Custom email types system
- Move email types out of a hardcoded list and into an admin-configurable system
- In admin settings, add an "Email Types" management section where admins can:
  - Create new email types with a custom name
  - Assign a color to each type (color picker)
  - Mark whether the type is a "referral" type or not (boolean flag)
  - Edit and delete custom types
  - Default types (Intro, Follow-Up, Referral, Internal Handoff) should be pre-seeded but editable
- The color assigned to each type should be reflected:
  - In the type badge shown in the template list
  - In the email template selection popup/modal on the lead detail page
  - Anywhere else the type badge appears

### Referral type email enhancements
- If an email type is flagged as "referral" type, show a "Referral" badge in the email selection popup
- When a user selects a referral-type template from the lead detail page:
  1. First prompt them to select which Referral Partner they're referring to
  2. Show the referral partners in a selectable list with key info visible (name, states served, specialties, claim size range)
  3. Allow the user to click an "expand" or "more info" button on any partner to see ALL partner details (full contact info, all emails, industries, exclusions, notes, etc.) in a slide-out panel or modal — without losing their place in the selection flow
  4. After selecting a partner, populate the email template with both lead fields AND referral partner fields
  5. The referral partner's email(s) should auto-populate as the recipient

### Lead field variables in templates
- ALL lead fields should be available as merge variables in email templates, not just the current subset
- Add these to the "Insert Field" dropdown in the template editor:
  - {{units}} (account volume / number of units)
  - {{states}} (all states the lead selected)
  - {{debt_type}}
  - {{service_requested}}
  - {{balance_amount}}
  - {{industry}}
  - {{urgency}}
  - {{notes_from_form}}
  - {{lead_source}}
  - Any other lead fields that aren't already available
- Also add referral partner variables for referral templates:
  - {{referral_partner_name}}
  - {{referral_partner_email}}
  - {{referral_partner_phone}}
  - {{referral_partner_website}}
  - {{referral_partner_contact_name}}

### Lead data table insertion in emails
- Add an "Insert Lead Summary Table" button in the template editor toolbar
- This inserts a formatted HTML table into the email body containing selected lead fields
- The user should be able to choose which fields to include in the table when inserting
- The table should render properly when the email is opened in the mail client
- Alternatively, support a special variable like {{lead_summary_table}} that auto-generates a table of key lead fields, and let admins configure which fields appear in that table

## REFERRAL PARTNERS — Enhancements

### Multiple emails support
- Change the email field from a single text input to support multiple emails
- UI should allow adding/removing email entries (+ button to add another, X to remove)
- Store as an array in the database
- When populating a referral email, use the first/primary email as default recipient but let the user choose which email to send to if multiple exist

### Custom fields
- Add an admin-configurable custom fields system for referral partners
- Admins can define custom fields with a name, field type (text, number, URL, boolean, multi-select), and optional default value
- Custom field values should be visible in the partner detail view and the expanded partner info modal during referral selection
- Store custom field definitions in a separate table, and custom field values as JSON on the partner record or in a related table

## UI / BRANDING FIXES

### Logo fix
- The ACB logo in the top-left of the sidebar is currently squished/distorted
- Fix the aspect ratio — ensure it displays at its natural proportions
- If needed, adjust the sidebar width or logo container to accommodate the correct aspect ratio
- The logo should look clean and professional

### Sidebar color/theme
- The current dark navy sidebar doesn't match ACB's branding
- Look at the ACB logo colors and the overall app theme (which uses light grays, whites, and accent colors)
- Change the sidebar to better match ACB branding — options:
  - A clean white or light gray sidebar with dark text (matching the rest of the app's light theme)
  - Or pull the primary brand color from the ACB logo and use that as a subtle accent
- Make sure active/selected nav items are clearly distinguished
- Keep the sidebar professional and clean, not heavy/dark

## FAVICON — Dynamic unread count

### Implementation
- I have a folder of pre-made favicon images that need to be added to the project:
  - default.webp — no unread leads (normal favicon)
  - 1-unread.webp through 19-unread.webp — favicons showing unread count 1-19
  - 19+-unread.webp — used when unread count is 20 or more
- Add these images to the public assets
- Implement a favicon manager that:
  1. Polls or subscribes to the current unread lead count
  2. Swaps the favicon dynamically based on the count:
     - 0 unread → default.webp
     - 1-19 unread → corresponding numbered favicon
     - 20+ unread → 19+-unread.webp
  3. Updates in near-real-time (poll every 30-60 seconds, or use websocket/SSE if already available)
- The favicon should update across all open tabs
- Convert webp files to .ico or .png if browsers don't support webp favicons well, or serve both formats

Plan this out, then implement in this order:
1. UI/branding fixes (logo, sidebar) — quick wins
2. Favicon system
3. Email type configuration system (admin settings)
4. Email template editor toolbar fixes
5. Referral partner enhancements (multiple emails, custom fields)
6. Referral email flow improvements (partner selection, expanded info)
7. Lead field variables and summary table insertion