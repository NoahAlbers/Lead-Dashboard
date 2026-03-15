# Lead Dashboard - Implementation Fixes & Improvements

Read the full codebase first, then implement these changes in order.

---

## 1. LEAD INBOX - Quick Actions (FIX)

The quick action buttons in the lead inbox table are incomplete and poorly implemented. Fix as follows:

### Buttons needed (always visible, not just on hover):
Show these icon buttons in a row in the rightmost column of each lead row:
1. **Email** (envelope icon) - Opens email compose modal
2. **Call** (phone icon) - Opens tel: link with lead's phone number  
3. **Mark Contacted** (green checkmark icon)
4. **Follow-Up Needed** (orange clock icon)
5. **Mark Qualified** (gold star icon)
6. **Disqualify** (red X icon)
7. **Archive** (archive/box icon)

### Tooltip implementation:
Do NOT use HTML `title` attributes. Use CSS-only tooltips:
```css
.action-btn {
  position: relative;
}
.action-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: #1A1A2E;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  z-index: 10;
}
.action-btn:hover::after {
  opacity: 1;
}
```

Each button gets `data-tooltip="Mark Contacted"` etc. The icons should be small (16-18px), with subtle colors that match their meaning (green for contacted, orange for follow-up, gold for qualified, red for disqualify, grey for archive, blue for email/call).

### Email button behavior:
When clicked, opens a modal with:
- A dropdown to select from saved email templates (from the Email Templates section)
- When a template is selected, it auto-populates:
  - Subject line (with merge fields replaced: {firstName}, {companyName}, {totalUnits}, etc.)
  - Body content (with merge fields replaced)
- The "To" field is pre-filled with the lead's email
- A "Send" button and "Cancel" button
- For now, "Send" can open the user's default mail client with `mailto:` populated with the subject and body, OR copy to clipboard with a toast notification. Full SMTP integration can come later.

---

## 2. READ/UNREAD STATUS IN LEAD INBOX

### Add a read/unread indicator:
- On the far LEFT of each row in the lead inbox table, add a small dot indicator:
  - **Unread (new)**: Solid blue dot (8px circle, filled with #3D5AF1)
  - **Read**: No dot (empty space, same width to maintain alignment)
- A lead becomes "read" when a user clicks into its detail view
- Store read/unread status per lead in the database

### Notification badge logic:
- The red badge number on "Lead Inbox" in the sidebar = count of UNREAD leads
- When a user enters a lead's detail view, mark it as read and decrement the badge count
- When a new lead comes in, it starts as unread, incrementing the badge

---

## 3. CUSTOM TIER RANGES (FIX)

The current implementation is broken - custom tiers cannot have their ranges edited. Fix:

### How it should work:
- In Settings, the "Quality Tier Score Ranges" section should show ALL tiers (both default and custom)
- Each tier card should have:
  - The tier name (editable for custom tiers)
  - A color indicator
  - Two number inputs: min score and max score
  - For custom tiers: a delete button
- ALL tiers must have editable min/max ranges, including custom tiers added via "+ Add Tier"
- When a new tier is added, auto-assign it the next available range gap, or split the lowest tier's range
- Validation on save:
  - Ranges must cover 0-100 completely with no gaps
  - Ranges must not overlap
  - Show inline error messages if validation fails
- "Save Ranges" button applies changes and triggers lead score recalculation for all leads

### Data model for tiers:
```
{
  id: string,
  name: string,      // "A Lead", "B Lead", etc.
  color: string,      // hex color for the dot/badge
  minScore: number,   // inclusive
  maxScore: number,   // inclusive
  isDefault: boolean  // can't delete default tiers, only rename
}
```

---

## 4. EMAIL TEMPLATE EDITOR (UPGRADE)

The email template editor needs to be a proper rich text editor, not just a plain textarea.

### Requirements:
- Use a rich text editor. Good options for a React project:
  - **TipTap** (recommended - lightweight, extensible, MIT license)
  - **React-Quill** (easier but heavier)
  - Or build a simple one with `contenteditable` and a formatting toolbar
  
### Editor toolbar should support:
- Bold, italic, underline
- Headings (H1, H2, H3)
- Bullet lists and numbered lists
- Links (insert/edit URL)
- Images (paste URL or upload)
- Text color
- Alignment (left, center, right)
- Insert merge field button → dropdown with: {firstName}, {lastName}, {companyName}, {email}, {phone}, {totalUnits}, {states}, {website}
- HTML source view toggle (for power users)

### Template data model:
```
{
  id: string,
  name: string,           // "Initial Outreach - A Lead"
  subject: string,        // "Let's get {companyName} collecting"
  bodyHtml: string,       // Rich HTML content
  category: string,       // "outreach", "follow-up", "referral"
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Pre-built default templates:
Create these as defaults that users can edit:

**Initial Outreach:**
- Subject: "{companyName} + Advanced Collection Bureau"
- Body: Professional intro, mention their unit count, contingency model, CTA to schedule a call

**Follow-Up (No Response):**
- Subject: "Following up - {companyName}"
- Body: Brief, adds urgency without being pushy

**Follow-Up (After Call):**
- Subject: "Great speaking with you, {firstName}"
- Body: Recap what was discussed, next steps

**Referral:**
- Subject: "A collection agency recommendation for {companyName}"
- Body: For non-residential leads being referred to partner agencies

---

## 5. GENERAL UI/UX FIXES

### All timestamps in EST:
Every timestamp displayed anywhere in the app should be in Eastern Standard Time. Use:
```javascript
new Date(timestamp).toLocaleString('en-US', { 
  timeZone: 'America/New_York',
  month: '2-digit', day: '2-digit', year: '2-digit',
  hour: 'numeric', minute: '2-digit', hour12: true 
}) + ' EST'
```

### Toast notifications:
After any quick action (mark contacted, qualified, etc.), show a brief toast notification:
- Green background for success actions
- Slides in from the bottom-right
- Auto-dismisses after 3 seconds
- Shows the action: "Sunshine Property Management marked as Contacted"

### Lead detail view - Intake Form Details:
Move the "Intake Form Details" section to the BOTTOM of the detail page, below the Activity Timeline. It's reference data, not the primary thing the sales rep needs to see.

### Multi-state support:
In the lead detail view and lead inbox table, the "State" field should support and display multiple states. Show as comma-separated or as small pill badges. The intake form sends states as a comma-separated string like "Florida, Georgia, Alabama".