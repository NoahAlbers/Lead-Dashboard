export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System configuration
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-6">
        {/* Lead Statuses */}
        <div>
          <h2 className="font-semibold mb-2">Lead Statuses</h2>
          <p className="text-sm text-muted-foreground mb-3">
            The following statuses are available in the system:
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { name: "New", desc: "Freshly received lead" },
              { name: "Reviewed", desc: "Staff has looked at this lead" },
              { name: "Qualified", desc: "Lead meets qualification criteria" },
              { name: "Contacted", desc: "Outreach has been made" },
              { name: "Follow-Up Needed", desc: "Requires another touch" },
              { name: "Referred Out", desc: "Sent to a referral partner" },
              { name: "Imported to CRM", desc: "Exported/pushed to Act!" },
              { name: "Won", desc: "Became a client" },
              { name: "Lost", desc: "Did not convert" },
              { name: "Disqualified", desc: "Does not fit criteria" },
              { name: "Duplicate", desc: "Duplicate of another lead" },
            ].map((status) => (
              <div key={status.name} className="rounded-md border p-3">
                <p className="text-sm font-medium">{status.name}</p>
                <p className="text-xs text-muted-foreground">{status.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Tiers */}
        <div>
          <h2 className="font-semibold mb-2">Quality Tiers</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3 border-emerald-200 bg-emerald-50">
              <p className="text-sm font-medium text-emerald-700">A Lead</p>
              <p className="text-xs text-emerald-600">Score 80–100</p>
            </div>
            <div className="rounded-md border p-3 border-blue-200 bg-blue-50">
              <p className="text-sm font-medium text-blue-700">B Lead</p>
              <p className="text-xs text-blue-600">Score 60–79</p>
            </div>
            <div className="rounded-md border p-3 border-amber-200 bg-amber-50">
              <p className="text-sm font-medium text-amber-700">C Lead</p>
              <p className="text-xs text-amber-600">Score 40–59</p>
            </div>
            <div className="rounded-md border p-3 border-red-200 bg-red-50">
              <p className="text-sm font-medium text-red-700">Poor Fit</p>
              <p className="text-xs text-red-600">Score 0–39</p>
            </div>
          </div>
        </div>

        {/* CRM Field Mapping */}
        <div>
          <h2 className="font-semibold mb-2">Act! CRM Field Mapping</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Default CSV export mappings for Act! CRM import:
          </p>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Act! Field
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Lead Field
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Company", "companyName"],
                  ["Contact", "fullName"],
                  ["First Name", "firstName"],
                  ["Last Name", "lastName"],
                  ["E-mail", "email"],
                  ["Phone", "phone"],
                  ["City", "city"],
                  ["State", "state"],
                  ["Zip", "zip"],
                  ["Industry", "industry"],
                  ["Balance Amount", "balanceAmount"],
                  ["Lead Score", "score"],
                  ["Quality Tier", "qualityTier"],
                  ["Status", "status"],
                ].map(([actField, leadField]) => (
                  <tr key={actField} className="border-b last:border-0">
                    <td className="px-3 py-2">{actField}</td>
                    <td className="px-3 py-2 font-mono text-xs">{leadField}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Webhook Info */}
        <div>
          <h2 className="font-semibold mb-2">Webflow Webhook</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Configure Webflow Logic to POST form submissions to:
          </p>
          <code className="block rounded-md bg-muted px-3 py-2 text-sm font-mono">
            POST /api/webhooks/webflow
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Include header: <code>x-webhook-secret: [your secret]</code>
          </p>
        </div>
      </div>
    </div>
  );
}
