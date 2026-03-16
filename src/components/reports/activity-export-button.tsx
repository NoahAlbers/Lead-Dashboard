"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ActivityExportDialog } from "./activity-export-dialog";

interface ActivityExportButtonProps {
  userRole: string;
}

export function ActivityExportButton({ userRole }: ActivityExportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
      >
        <Download className="h-4 w-4" />
        Export Activity Log
      </button>
      <ActivityExportDialog
        open={open}
        onClose={() => setOpen(false)}
        userRole={userRole}
      />
    </>
  );
}
