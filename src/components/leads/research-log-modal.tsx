"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { logResearch } from "@/actions/lead.actions";

interface ResearchLogModalProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
}

const SOURCE_OPTIONS = ["Google", "LinkedIn", "BBB", "Website", "Phone Call", "Other"];
const VERIFIED_OPTIONS = ["Yes", "No", "Unclear"];
const SIZE_OPTIONS = ["1-10 employees", "11-50", "51-200", "200+", "Unknown"];
const RED_FLAG_OPTIONS = ["None", "Complaints found", "No web presence", "Possible fraud", "Business closed", "Other"];
const RECOMMENDATION_OPTIONS = ["Proceed as normal", "Proceed with caution", "Do not proceed", "Needs more research"];

export function ResearchLogModal({ open, onClose, leadId }: ResearchLogModalProps) {
  const [isPending, startTransition] = useTransition();
  const [sources, setSources] = useState<string[]>([]);
  const [companyVerified, setCompanyVerified] = useState("Unclear");
  const [contactVerified, setContactVerified] = useState("Unclear");
  const [companySize, setCompanySize] = useState("Unknown");
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [recommendation, setRecommendation] = useState("Needs more research");
  const [findings, setFindings] = useState("");

  function toggleSource(source: string) {
    setSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  }

  function toggleRedFlag(flag: string) {
    if (flag === "None") {
      setRedFlags((prev) => (prev.includes("None") ? [] : ["None"]));
      return;
    }
    setRedFlags((prev) => {
      const without = prev.filter((f) => f !== "None" && f !== flag);
      return prev.includes(flag) ? without : [...without, flag];
    });
  }

  function resetForm() {
    setSources([]);
    setCompanyVerified("Unclear");
    setContactVerified("Unclear");
    setCompanySize("Unknown");
    setRedFlags([]);
    setRecommendation("Needs more research");
    setFindings("");
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await logResearch(leadId, {
          sources,
          companyVerified,
          contactVerified,
          companySize,
          redFlags: redFlags.filter((f) => f !== "None"),
          recommendation,
          findings,
        });
        toast({ title: "Research logged", variant: "success" });
        resetForm();
        onClose();
      } catch {
        toast({ title: "Failed to log research", variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Research Findings</DialogTitle>
          <DialogDescription>
            Record the results of your research on this lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sources Checked */}
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Sources Checked</legend>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((src) => (
                <label key={src} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sources.includes(src)}
                    onChange={() => toggleSource(src)}
                    className="rounded border-input"
                  />
                  {src}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Company Verified */}
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Company Verified</legend>
            <div className="flex gap-4">
              {VERIFIED_OPTIONS.map((opt) => (
                <label key={opt} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="companyVerified"
                    value={opt}
                    checked={companyVerified === opt}
                    onChange={() => setCompanyVerified(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Contact Verified */}
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Contact Verified</legend>
            <div className="flex gap-4">
              {VERIFIED_OPTIONS.map((opt) => (
                <label key={opt} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="contactVerified"
                    value={opt}
                    checked={contactVerified === opt}
                    onChange={() => setContactVerified(opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Estimated Company Size */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Estimated Company Size</label>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Red Flags */}
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Red Flags</legend>
            <div className="flex flex-wrap gap-2">
              {RED_FLAG_OPTIONS.map((flag) => (
                <label key={flag} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redFlags.includes(flag)}
                    onChange={() => toggleRedFlag(flag)}
                    className="rounded border-input"
                  />
                  {flag}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Recommendation */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Recommendation</label>
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RECOMMENDATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Key Findings */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Key Findings</label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              placeholder="Free-form notes about what you found..."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving..." : "Save Research"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
