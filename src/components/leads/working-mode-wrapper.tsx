"use client";

import { useSearchParams } from "next/navigation";
import { useWorkingMode } from "./working-mode-provider";
import { WorkingModeBar } from "./working-mode-bar";
import { DispositionPanel } from "./disposition-panel";
import { SessionSummaryModal } from "./session-summary-modal";

interface WorkingModeWrapperProps {
  leadId: string;
  leadLabel: string;
}

export function WorkingModeBarWrapper() {
  const { isWorkingMode } = useWorkingMode();
  const searchParams = useSearchParams();

  if (!isWorkingMode && searchParams.get("workingMode") !== "true") return null;
  return <WorkingModeBar />;
}

export function DispositionPanelWrapper({ leadId, leadLabel }: WorkingModeWrapperProps) {
  const { isWorkingMode } = useWorkingMode();
  const searchParams = useSearchParams();

  if (!isWorkingMode && searchParams.get("workingMode") !== "true") return null;
  return <DispositionPanel leadId={leadId} leadLabel={leadLabel} />;
}

export function SessionSummaryWrapper() {
  const { isWorkingMode, dispositions } = useWorkingMode();
  // Show summary when user exits working mode but has dispositions
  if (isWorkingMode || dispositions.length === 0) return null;
  return <SessionSummaryModal />;
}
