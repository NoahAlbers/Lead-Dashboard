Two fixes needed — tier pill readability and referral partner fields. Read both then implement.

## FIX 1: Tier pill colors — too low contrast, hard to read
The quality tier pills (A Lead, B Lead, C Lead, Poor Fit) currently have very light/pastel backgrounds with light text, making them nearly unreadable. Fix:

- Increase the contrast significantly. Two approaches (pick whichever looks better):
  
  Option A — Darker background, white text:
  - A Lead: solid medium green background (#22c55e or similar), white text
  - B Lead: solid blue background (#3b82f6 or similar), white text
  - C Lead: solid amber/yellow background (#f59e0b or similar), dark text (black or dark brown for contrast since yellow + white is unreadable)
  - Poor Fit: solid red background (#ef4444 or similar), white text

  Option B — Tinted background, dark colored text:
  - A Lead: light green bg, dark green text, medium green left border
  - B Lead: light blue bg, dark blue text, medium blue left border
  - C Lead: light amber bg, dark amber text, medium amber left border
  - Poor Fit: light red bg, dark red text, medium red left border

- Whichever approach you use, ensure WCAG AA contrast ratio (4.5:1 minimum for normal text)
- These colors should still pull from the tier configuration in settings, but the rendering logic needs to compute a readable text color based on the background
- Add a utility function: given a background color (hex), return either white or dark text for best contrast
- Apply this fix everywhere tier pills appear: inbox table, lead detail, reports charts, filters
- The status pills (New, Contacted, Disqualified, etc.) look fine — don't change those, just the tier pills

## FIX 2: Referral partner form — add business/financial fields
The referral partner edit form needs additional fields for business terms and operational details. Add these fields to both the database schema and the edit form:

### New fields to add:

Financial Terms section:
- contingency_rate (text or number) — Label: "Contingency Rate (%)" — e.g., "25%", "20-30% depending on age"
- upfront_costs (text) — Label: "Upfront Costs / Fees" — e.g., "$25 per account", "No upfront fees", "$500 setup + $10/account"
- payment_terms (text) — Label: "Payment Terms" — e.g., "Net 30", "Monthly remittance"
- commission_structure (text) — Label: "Commission / Revenue Share" — for any referral fee or kickback arrangement

Account Requirements section:
- minimum_accounts (number, nullable) — Label: "Minimum # of Accounts" — minimum number of accounts they'll accept in a placement
- minimum_total_balance (number, nullable) — Label: "Minimum Total Balance ($)" — minimum total dollar amount for a placement
- average_account_age_preference (text) — Label: "Preferred Account Age" — e.g., "60-180 days", "Any age", "Under 1 year"
- account_types_accepted (text) — Label: "Account Types Accepted" — e.g., "Commercial only", "Consumer and commercial", "Medical debt"

Service Details section:
- collection_methods (text) — Label: "Collection Methods" — e.g., "Letters, calls, skip tracing", "Legal collections", "Debt buying"
- licensed_states (text, comma-separated or JSON array) — Label: "Licensed / Bonded States" — states where they're actually licensed, which may differ from states_served
- insurance_info (text) — Label: "Insurance / Bonding Info" — e.g., "Bonded in all 50 states", "$2M E&O coverage"
- years_in_business (number, nullable) — Label: "Years in Business"
- compliance_notes (text) — Label: "Compliance Notes" — any compliance certifications, audit info, etc.

### Form layout:
- Group these into clear sections with headers on the edit form:
  1. Basic Info (existing: name, contact, email, phone, website, ranking)
  2. Service Area (existing: states served, industries)
  3. Account Requirements (new: min accounts, min balance, claim size range, account age, account types)
  4. Financial Terms (new: contingency rate, upfront costs, payment terms, commission)
  5. Service Details (new: collection methods, licensed states, insurance, years in business, compliance)
  6. Notes (existing)
  7. Status (existing: active toggle)

### Also:
- These new fields should be visible in the referral partner detail view
- These fields should be visible in the expanded partner info panel during the referral email partner selection flow
- Add merge variables for key financial fields so they can be used in referral email templates:
  - {{referral_partner_contingency_rate}}
  - {{referral_partner_upfront_costs}}
  - {{referral_partner_minimum_accounts}}
  - {{referral_partner_minimum_total_balance}}
- Run a database migration to add these columns to the referral_partners table

Implement in this order:
1. Tier pill contrast fix (quick visual fix)
2. Referral partner schema migration + new fields
3. Update referral partner edit form with sections
4. Update partner detail views and selection panel
5. Add new merge variables to email template system