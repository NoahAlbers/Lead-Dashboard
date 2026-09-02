import { notFound } from "next/navigation";
import { format, toZonedTime } from "date-fns-tz";
import { getLead } from "@/actions/lead.actions";
import { getLeadNotes } from "@/actions/note.actions";
import { getLeadEvents } from "@/services/activity-log.service";
import { PrintTrigger } from "@/components/leads/print-trigger";
import { eventLabels, formatEventDetail } from "@/lib/event-detail";

const EST_TZ = "America/New_York";

function fmtDate(d: Date | string): string {
  return format(toZonedTime(new Date(d), EST_TZ), "MMM d, yyyy h:mm a", {
    timeZone: EST_TZ,
  });
}

function fmtDateShort(d: Date | string): string {
  return format(toZonedTime(new Date(d), EST_TZ), "MM/dd/yy h:mm a", {
    timeZone: EST_TZ,
  });
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-0.5 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadPrintPage({ params }: PageProps) {
  const { id } = await params;

  const [lead, notes, events] = await Promise.all([
    getLead(id),
    getLeadNotes(id),
    getLeadEvents(id),
  ]);

  if (!lead) notFound();

  const scoreReasons = (lead.scoreReasons ?? []) as Array<{
    ruleName: string;
    scoreAdjustment: number;
    reason: string;
  }>;

  const rawPayload = lead.rawPayloadJson as Record<string, unknown> | null;
  const raw = rawPayload
    ? ((rawPayload._rawIntakeForm as Record<string, unknown>) ?? rawPayload)
    : null;

  const intakeStates = raw?.states as string[] | undefined;
  const displayStates =
    intakeStates && intakeStates.length > 0
      ? intakeStates.join(", ")
      : lead.state;

  const debtTypes = raw?.debtTypes as string[] | undefined;
  const totalUnits = raw?.totalUnits as string | undefined;
  const avgRent = raw?.avgRent as number | undefined;
  const ownershipType = raw?.ownershipType as string | undefined;
  const propertyTypes = raw?.propertyTypes as string[] | undefined;
  const pmSoftware = raw?.pmSoftware as string[] | undefined;
  const companyWebsite = raw?.companyWebsite as string | undefined;

  const generatedAt = fmtDate(new Date());
  const recentEvents = events.slice(0, 10);
  const recentNotes = notes.slice(0, 5);

  const hasBusinessDetails =
    lead.debtType ||
    (debtTypes && debtTypes.length > 0) ||
    lead.balanceAmount ||
    lead.accountVolume ||
    totalUnits ||
    avgRent ||
    ownershipType ||
    (propertyTypes && propertyTypes.length > 0) ||
    (pmSoftware && pmSoftware.length > 0) ||
    lead.industry ||
    lead.serviceRequested;

  return (
    <>
      {/* Print-specific styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { margin: 0 !important; padding: 0 !important; background: white !important; }
              nav, header, aside { display: none !important; }
              .print-page section { break-inside: avoid; }
            }
            .print-page {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #111;
              background: #fff;
              max-width: 800px;
              margin: 0 auto;
              padding: 24px 32px;
              font-size: 13px;
              line-height: 1.5;
            }
            .print-page h1 { font-size: 20px; margin: 0 0 4px 0; font-weight: 700; }
            .print-page h2 { font-size: 13px; margin: 16px 0 8px 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .print-page table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
            .print-page th, .print-page td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
            .print-page th { background: #f5f5f5; font-weight: 600; font-size: 10px; text-transform: uppercase; }
          `,
        }}
      />

      <div className="print-page">
        <PrintTrigger />

        {/* HEADER */}
        <section>
          <h1>ACB Lead Summary Report</h1>
          <p className="text-xs text-gray-500 mb-3">Generated {generatedAt} EST</p>
          <hr className="border-t-2 border-gray-800 mb-4" />
        </section>

        {/* CONTACT INFO */}
        <section>
          <h2>Contact Information</h2>
          <div className="grid grid-cols-2 gap-x-6">
            <InfoRow label="Name" value={lead.fullName} />
            <InfoRow label="Company" value={lead.companyName} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Alt. Phone" value={lead.alternatePhone} />
            <InfoRow label="Website" value={companyWebsite} />
          </div>
          {displayStates && (
            <div className="mt-1 text-xs">
              <span className="text-gray-500">States: </span>
              <span className="font-medium">{displayStates}</span>
            </div>
          )}
        </section>

        {/* BUSINESS / PORTFOLIO DETAILS */}
        {hasBusinessDetails && (
          <section>
            <h2>Business / Portfolio Details</h2>
            <div className="grid grid-cols-2 gap-x-6">
              {debtTypes && debtTypes.length > 0 && (
                <InfoRow label="Debt Types" value={debtTypes.join(", ")} />
              )}
              {!debtTypes?.length && <InfoRow label="Debt Type" value={lead.debtType} />}
              <InfoRow
                label="Balance"
                value={
                  lead.balanceAmount
                    ? `$${lead.balanceAmount.toLocaleString()}`
                    : null
                }
              />
              <InfoRow label="Account Volume" value={lead.accountVolume} />
              <InfoRow label="Total Units" value={totalUnits} />
              <InfoRow
                label="Avg Rent"
                value={avgRent ? `$${avgRent.toLocaleString()}/mo` : null}
              />
              <InfoRow label="Ownership" value={ownershipType} />
              <InfoRow label="Industry" value={lead.industry} />
              <InfoRow label="Service Requested" value={lead.serviceRequested} />
              {propertyTypes && propertyTypes.length > 0 && (
                <InfoRow label="Property Types" value={propertyTypes.join(", ")} />
              )}
              {pmSoftware && pmSoftware.length > 0 && (
                <InfoRow label="PM Software" value={pmSoftware.join(", ")} />
              )}
            </div>
          </section>
        )}

        {/* QUALIFICATION */}
        <section>
          <h2>Qualification</h2>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-extrabold">{lead.score ?? "—"}</span>
            {lead.qualityTier && (
              <span className="text-xs text-gray-500">Tier: {lead.qualityTier}</span>
            )}
            {lead.recommendedAction && (
              <span className="text-xs text-gray-500">
                | Recommended: {lead.recommendedAction.replace(/_/g, " ")}
              </span>
            )}
          </div>
          {scoreReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Top Scoring Rules:</p>
              {scoreReasons.slice(0, 8).map((rule, i) => (
                <div key={i} className="flex justify-between text-xs py-px">
                  <span>{rule.reason}</span>
                  <span
                    className={
                      rule.scoreAdjustment >= 0
                        ? "text-green-700 font-semibold"
                        : "text-red-600 font-semibold"
                    }
                  >
                    {rule.scoreAdjustment >= 0 ? "+" : ""}
                    {rule.scoreAdjustment}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CURRENT STATUS */}
        <section>
          <h2>Current Status</h2>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="flex justify-between py-0.5 text-xs">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold bg-gray-200 rounded px-2 py-px text-xs">
                {lead.status.replace(/_/g, " ")}
              </span>
            </div>
            <InfoRow
              label="Assigned To"
              value={lead.assignedUser?.name ?? "Unassigned"}
            />
            <InfoRow label="SLA Status" value={lead.slaStatus ?? "N/A"} />
            <InfoRow
              label="CRM Status"
              value={
                lead.crmStatus
                  ? lead.crmStatus.replace(/_/g, " ")
                  : "Not exported"
              }
            />
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        {recentEvents.length > 0 && (
          <section>
            <h2>Recent Activity (Last 10)</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((evt) => {
                  const data = evt.eventDataJson as Record<string, unknown> | null;
                  const detail =
                    formatEventDetail(evt) ??
                    (data && typeof data.reason === "string" ? data.reason : "");
                  return (
                    <tr key={evt.id}>
                      <td className="whitespace-nowrap">{fmtDateShort(evt.createdAt)}</td>
                      <td>{eventLabels[evt.eventType] ?? evt.eventType.replace(/_/g, " ")}</td>
                      <td>{detail || "\u2014"}</td>
                      <td>{evt.user?.name ?? "System"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* NOTES */}
        {recentNotes.length > 0 && (
          <section>
            <h2>Notes (Last 5)</h2>
            {recentNotes.map((note) => (
              <div key={note.id} className="mb-2">
                <p className="text-[10px] text-gray-400 mb-0.5">
                  {fmtDateShort(note.createdAt)} — {note.user?.name ?? "Unknown"}
                </p>
                <div className="text-xs whitespace-pre-wrap bg-gray-50 rounded p-2">
                  {note.noteBody}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* FOOTER */}
        <div className="mt-6 pt-2 border-t border-gray-300 text-center text-[10px] text-gray-400">
          Confidential — Advanced Collection Bureau, Inc. | Generated {generatedAt} EST
        </div>
      </div>
    </>
  );
}
