// Shared lead-event presentation helpers. Used by the activity timeline, the
// print summary, and anywhere else a LeadEvent row needs a human label and a
// one-line detail string.

export interface EventDetailInput {
  eventType: string;
  eventDataJson: unknown;
}

export const eventLabels: Record<string, string> = {
  lead_created: "Lead created",
  score_calculated: "Score calculated",
  status_changed: "Status changed",
  note_added: "Note added",
  email_action_opened: "Email action opened",
  call_action_opened: "Call action opened",
  referral_action_opened: "Referral action opened",
  referral_marked_sent: "Referral marked as sent",
  crm_exported: "Exported for CRM",
  crm_imported: "Imported to CRM",
  duplicate_flagged: "Duplicate flagged",
  assigned_user_changed: "Assignment changed",
  quick_log: "Quick log action",
  research_completed: "Research completed",
  auto_research: "Auto research ran",
  prospect_comment: "Comment from the prospect",
  first_contact_recorded: "First contact recorded",
  email_reply_received: "Replied by email",
  onboarding_profile_created: "Onboarding portal created",
  onboarding_milestone: "Onboarding progress",
  onboarding_portal_deleted: "Onboarding portal deleted",
  follow_up_scheduled: "Follow-up scheduled",
  follow_up_completed: "Follow-up completed",
  follow_up_cancelled: "Follow-up cancelled",
  follow_up_due: "Follow-up due",
  lead_data_received: "Submission data received",
  interaction_logged: "Interaction logged",
  contact_added: "Contact added",
  contact_updated: "Contact updated",
  contact_removed: "Contact removed",
  onboarding_deleted: "Onboarding portal deleted",
  lead_edited: "Lead edited",
  leads_merged: "Leads merged",
  merge_undone: "Merge undone",
  recapture_email_sent: "Recapture email sent",
  recapture_email_failed: "Recapture email failed",
  recapture_stopped: "Recapture stopped",
  recapture_link_opened: "Opened their resume link",
  confirmation_email_sent: "Confirmation email sent",
  confirmation_email_failed: "Confirmation email failed",
  edit_link_opened: "Opened their edit link",
  prospect_updated_details: "Prospect updated their details",
  sla_warning: "SLA warning",
  sla_breach: "SLA breached",
  sla_escalated: "SLA escalated",
  sla_escalation: "SLA escalated",
};

export function formatEventDetail(event: EventDetailInput): string | null {
  const data = event.eventDataJson as Record<string, unknown> | null;
  if (!data) return null;

  if (event.eventType === "status_changed") {
    return `${String(data.from ?? "").replace(/_/g, " ")} → ${String(data.to ?? "").replace(/_/g, " ")}`;
  }
  if (event.eventType === "score_calculated") {
    return `Score: ${data.score} (${data.qualityTier})`;
  }
  if (event.eventType === "quick_log") {
    return String(data.actionType ?? "").replace(/_/g, " ");
  }
  if (event.eventType === "duplicate_flagged" && Array.isArray(data.matches)) {
    return `${data.matches.length} potential duplicate(s) found`;
  }
  if (event.eventType === "research_completed") {
    const d = data as { recommendation?: string; sources?: string[] };
    return d.recommendation ? `Recommendation: ${d.recommendation}` : null;
  }
  if (event.eventType === "email_reply_received") {
    const d = data as { subject?: string; snippet?: string | null };
    return [d.subject ? `Subject: ${d.subject}` : null, d.snippet ?? null].filter(Boolean).join(" · ") || null;
  }
  if (event.eventType === "follow_up_scheduled") {
    const d = data as { reminderAt?: string; note?: string };
    const when = d.reminderAt ? new Date(d.reminderAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " EST" : "";
    return [when, d.note].filter(Boolean).join(" · ") || null;
  }
  if (event.eventType === "prospect_comment") {
    return typeof data.comment === "string" ? data.comment : null;
  }
  if (event.eventType === "auto_research") {
    const d = data as { domain?: string; profiles?: Array<{ kind: string }> };
    const found = d.profiles?.length ?? 0;
    return `Read ${d.domain ?? "their site"}; found ${found} linked profile${found !== 1 ? "s" : ""}`;
  }
  if (event.eventType === "lead_edited" && Array.isArray(data.changes)) {
    const changes = data.changes as Array<{ field: string; from?: string | null; to?: string | null }>;
    return changes
      .map((c) => `${c.field}: "${c.from ?? "empty"}" → "${c.to ?? "empty"}"`)
      .join(" · ");
  }
  if (event.eventType === "recapture_email_sent") {
    return `Recapture email ${data.step ?? ""}: ${data.subject ?? ""}`;
  }
  if (event.eventType === "confirmation_email_sent") {
    return `Confirmation sent to ${data.to ?? ""}${data.isHot ? " (high value)" : ""}`;
  }
  if (event.eventType === "recapture_link_opened") {
    return "Opened their resume link from a recapture email";
  }
  if (event.eventType === "onboarding_profile_created") {
    return `${data.emailed ? "Emailed to the client" : "Link not emailed"} · ${data.portalUrl ?? ""}`;
  }
  if (event.eventType === "onboarding_portal_deleted") {
    return "Deleted in the onboarding tool; its progress was removed from this lead";
  }
  if (event.eventType === "contact_added" || event.eventType === "contact_updated" || event.eventType === "contact_removed") {
    const d = data as { name?: string; title?: string | null };
    if (!d.name) return null;
    return d.title ? `${d.name}, ${d.title}` : d.name;
  }
  if (event.eventType === "interaction_logged") {
    const d = data as { kind?: string; outcomeLabel?: string; note?: string | null };
    const what = d.kind === "email" ? "Email" : "Call";
    return [`${what}: ${d.outcomeLabel ?? "logged"}`, d.note ?? null].filter(Boolean).join(" · ");
  }
  if (event.eventType === "onboarding_milestone") {
    const d = data as { label?: string; detail?: string | null };
    return [d.label, d.detail].filter(Boolean).join(" · ") || null;
  }
  if (event.eventType === "prospect_updated_details") {
    return data.wasAbandoned
      ? "Finished the form they had abandoned; lead updated and rescored"
      : "Updated their details through the edit link; lead rescored";
  }
  if (event.eventType === "edit_link_opened") {
    return "Opened the edit link from their confirmation email";
  }
  if (event.eventType.startsWith("email_")) {
    return `${event.eventType.replace("email_", "Email ").replace(/_/g, " ")}${data.subject ? `: ${data.subject}` : ""}`;
  }
  return null;
}
