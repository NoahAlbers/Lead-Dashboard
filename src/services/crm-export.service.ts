import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";
import Papa from "papaparse";

// Default field mapping for Act! CRM
const DEFAULT_ACT_MAPPING: Record<string, string> = {
  "Company": "companyName",
  "Contact": "fullName",
  "First Name": "firstName",
  "Last Name": "lastName",
  "Title": "title",
  "Phone": "phone",
  "Alt. Phone": "alternatePhone",
  "E-mail": "email",
  "Address 1": "address1",
  "Address 2": "address2",
  "City": "city",
  "State": "state",
  "Zip": "zip",
  "Country": "country",
  "Industry": "industry",
  "Debt Type": "debtType",
  "Balance Amount": "balanceAmount",
  "Service Requested": "serviceRequested",
  "Notes": "notesFromForm",
  "Lead Source": "leadSource",
  "Lead Score": "score",
  "Quality Tier": "qualityTier",
  "Status": "status",
};

function getFieldValue(lead: Lead, field: string): string {
  const val = (lead as Record<string, unknown>)[field];
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function generateCsv(leads: Lead[], fieldMapping?: Record<string, string>): string {
  const mapping = fieldMapping ?? DEFAULT_ACT_MAPPING;

  const rows = leads.map((lead) => {
    const row: Record<string, string> = {};
    for (const [crmField, leadField] of Object.entries(mapping)) {
      row[crmField] = getFieldValue(lead, leadField);
    }
    return row;
  });

  return Papa.unparse(rows);
}

export async function exportLeadsForCrm(
  leadIds: string[],
  userId: string
): Promise<{ csv: string; exportId: string }> {
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
  });

  const csv = generateCsv(leads);

  // Create export record
  const exportRecord = await prisma.crmExport.create({
    data: {
      leadId: leads[0].id,
      systemName: "act_crm",
      status: "success",
      payloadJson: { leadIds, fieldCount: Object.keys(DEFAULT_ACT_MAPPING).length },
      completedAt: new Date(),
    },
  });

  // Log events for each lead
  for (const lead of leads) {
    await prisma.leadEvent.create({
      data: {
        leadId: lead.id,
        eventType: "crm_exported",
        eventDataJson: { exportId: exportRecord.id, system: "act_crm" },
        userId,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { crmStatus: "exported", lastActivityAt: new Date() },
    });
  }

  return { csv, exportId: exportRecord.id };
}
