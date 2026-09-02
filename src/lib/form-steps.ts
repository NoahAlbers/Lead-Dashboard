// The intake form's step vocabulary, shared by the funnel report and the
// experiments page. Order matters: it's how "furthest step reached" is ranked.
export const FORM_STEPS: Array<{ key: string; label: string; pitch?: boolean }> = [
  { key: "intro", label: "Intro" },
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "website", label: "Website" },
  { key: "certify", label: "Certify debt" },
  { key: "contact", label: "Contact info" },
  { key: "priorAgency", label: "Prior agency" },
  { key: "debtTypes", label: "Debt types" },
  { key: "debtsNow", label: "Debts ready now" },
  { key: "sellAcbPitch", label: "Pitch: ACB", pitch: true },
  { key: "nonResBranch", label: "Non-residential branch" },
  { key: "sellDedicatedTeam", label: "Pitch: dedicated team", pitch: true },
  { key: "states", label: "States" },
  { key: "nonResStates", label: "States (non-res)" },
  { key: "sellContingency", label: "Pitch: contingency", pitch: true },
  { key: "ownership", label: "Ownership" },
  { key: "sellSkipTrace", label: "Pitch: skip trace", pitch: true },
  { key: "units", label: "Units" },
  { key: "sellRecoverableInsight", label: "Pitch: recoverable", pitch: true },
  { key: "sellBigPortfolio", label: "Pitch: big portfolio", pitch: true },
  { key: "sellUsStaff", label: "Pitch: US staff", pitch: true },
  { key: "rentalTypes", label: "Rental types" },
  { key: "propertyTypes", label: "Property types" },
  { key: "avgRent", label: "Average rent" },
  { key: "sellTeamExtension", label: "Pitch: team extension", pitch: true },
  { key: "listings", label: "Listing sites" },
  { key: "pmSoftware", label: "PM software" },
  { key: "sellReporting", label: "Pitch: reporting", pitch: true },
  { key: "sellStrategy", label: "Pitch: strategy", pitch: true },
  { key: "comments", label: "Comments" },
  { key: "done", label: "Done" },
];
export const STEP_INDEX: Record<string, number> = Object.fromEntries(FORM_STEPS.map((s, i) => [s.key, i]));
export function stepLabel(key: string | null | undefined): string {
  if (!key) return "Did not start";
  return FORM_STEPS.find((s) => s.key === key)?.label ?? key;
}
