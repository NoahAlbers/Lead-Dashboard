Fix Lead Intake Form → Lead Console Connection
There are two CORS issues preventing the intake form from submitting data. Both need to be fixed.

Issue 1: Lead Console API - CORS Headers Missing
The intake form (hosted on noahalbers.github.io) is trying to POST to https://www.advancedcb.app/api/webhooks/intake-form but getting blocked:
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://www.advancedcb.app/api/webhooks/intake-form. (Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 204.
Fix:
The API endpoint at /api/webhooks/intake-form needs proper CORS headers. Find the API route handler and add:
javascript// For the webhook endpoint, allow cross-origin requests from the intake form
const allowedOrigins = [
  'https://noahalbers.github.io',
  'https://www.advancedcb.com',
  'http://localhost:3000' // for local dev
];

// Handle preflight OPTIONS request
if (req.method === 'OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  return res.status(204).end();
}

// Handle POST request
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
If using Next.js, this goes in the route handler. If using Express, use the cors middleware configured with these origins.
Important: The endpoint is returning a 204 status code, which means the route exists and is being hit, but the CORS headers are missing from the response. This is likely a middleware configuration issue - the CORS middleware needs to run BEFORE the route handler, including for OPTIONS preflight requests.
Verify the webhook endpoint:
After fixing CORS, verify that the endpoint:

Accepts POST requests with JSON body
Parses the incoming payload (which contains all the form fields listed below)
Creates a new lead in the database with all the data
Returns a 200/201 JSON response

Payload the form sends:
json{
  "Name": "Noah Albers",
  "Company": "Test Company Inc.",
  "Email": "test@test.com",
  "Phone Number": "123-123-1234",
  "Website": "<a href=\"https://test.com\">test.com</a>",
  "Debt Types": "Residential Rental Debt, Commercial Rental Debt",
  "Debts Ready Now": "Yes, we have accounts ready",
  "Prior Collection Agency": "Yes",
  "States": "Florida, Georgia, Alabama",
  "Ownership": "We own and manage for others (81% own / 19% manage)",
  "Total Units": "500",
  "Rental Types": "Luxury, Conventional",
  "Property Types": "Single Family Homes, Multi-Family",
  "Avg Rent / Unit": "$1,500",
  "Listing Sites": "Zillow, Apartments.com",
  "PM Software": "Buildium, AppFolio",
  "Comments": "Test comment",
  "Location / IP": "City, State, Country (IP: x.x.x.x)",
  "Device": "Desktop / Chrome / Windows",
  "Referrer": "(Direct visit)",
  "Clarity Recording": "<a href=\"https://clarity.microsoft.com/...\">View Session Recording</a>",
  "Likely Timezone": "America/New_York",
  "Submitted (EST)": "Sat, Mar 15, 2026, 3:36 AM EST"
}
Note: The Website and Clarity Recording fields come in as HTML anchor tags (because FormSubmit renders them as clickable links in emails). The webhook endpoint should parse these to extract the raw URL. For example:

Input: <a href="https://test.com">test.com</a>
Store as: https://test.com

Use a simple regex or HTML parser to extract the href value:
javascriptfunction extractUrl(htmlOrText) {
  if (!htmlOrText) return '';
  const match = htmlOrText.match(/href="([^"]+)"/);
  return match ? match[1] : htmlOrText;
}
Field mapping:
The form sends fields with display names (like "Phone Number", "Debt Types"). Map these to your database field names when creating the lead:
javascriptconst lead = {
  fullName: payload["Name"],
  companyName: payload["Company"],
  email: payload["Email"],
  phone: payload["Phone Number"],
  website: extractUrl(payload["Website"]),
  debtTypes: payload["Debt Types"]?.split(", ") || [],
  debtsNow: payload["Debts Ready Now"],
  priorAgency: payload["Prior Collection Agency"],
  states: payload["States"]?.split(", ") || [],
  ownershipType: parseOwnership(payload["Ownership"]),  // extract type and percentages
  totalUnits: parseInt(payload["Total Units"]) || 0,
  rentalTypes: payload["Rental Types"]?.split(", ") || [],
  propertyTypes: payload["Property Types"]?.split(", ") || [],
  avgRent: parseCurrency(payload["Avg Rent / Unit"]),  // "$1,500" → 1500
  listingSites: payload["Listing Sites"]?.split(", ") || [],
  pmSoftware: payload["PM Software"]?.split(", ") || [],
  comments: payload["Comments"],
  locationIp: payload["Location / IP"],
  device: payload["Device"],
  referrer: payload["Referrer"],
  clarityUrl: extractUrl(payload["Clarity Recording"]),
  timezone: payload["Likely Timezone"],
  submittedAt: payload["Submitted (EST)"],
  // System fields
  status: "New",
  isRead: false,
  createdAt: new Date().toISOString(),
};

Issue 2: FormSubmit.co CORS Error
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at https://formsubmit.co/ajax/dfeca48013a9d6519627f295dd99503c. (Reason: CORS request did not succeed).
This is happening because the form is loaded inside an iframe on advancedcb.com, and the Content Security Policy on the parent page may be blocking the request. FormSubmit.co normally works fine with CORS.
Possible fixes (try in order):
Fix A: Check if https://formsubmit.co is in the connect-src directive of the parent page's CSP header. If not, add it:
connect-src 'self' https: https://formsubmit.co ...
Since the parent page already has https: in connect-src, this should already be allowed. The issue might be something else.
Fix B: The iframe is on a different origin (github.io) from the parent (advancedcb.com). Some browsers partition network requests from third-party iframes. The console shows:
Partitioned cookie or storage access was provided to "https://noahalbers.github.io/acb-form/acb-intake-form.html" because it is loaded in the third-party context and dynamic state partitioning is enabled.
This partitioning can cause fetch requests from the iframe to fail. To fix this, add the allow attribute to the iframe embed in Webflow:
html<iframe 
  src="https://noahalbers.github.io/acb-form/acb-intake-form.html" 
  style="width: 100%; min-height: 100vh; border: none; display: block;"
  allow="cross-origin-isolated"
  title="Get Started Form">
</iframe>
Fix C: If FormSubmit continues to fail from the iframe context, switch to using the lead console API as the PRIMARY submission method and make FormSubmit secondary (fire-and-forget). In the intake form's submitForm function, change the order:
javascript// Primary: send to lead console API (this is more important)
try {
  await fetch('https://www.advancedcb.app/api/webhooks/intake-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
} catch(e) { console.error('Console API error:', e); }

// Secondary: also send email notification via FormSubmit (fire and forget)
try {
  fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {}); // Don't block on this
} catch(e) {}
This way even if FormSubmit fails, the lead still gets into the console.