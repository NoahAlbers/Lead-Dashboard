import { z } from "zod";

export const leadStatusSchema = z.enum([
  "NEW",
  "REVIEWED",
  "QUALIFIED",
  "CONTACTED",
  "FOLLOW_UP_NEEDED",
  "REFERRED_OUT",
  "IMPORTED_TO_CRM",
  "WON",
  "LOST",
  "DISQUALIFIED",
  "DUPLICATE",
]);

export const leadFilterSchema = z.object({
  search: z.string().optional(),
  status: z.array(leadStatusSchema).optional(),
  qualityTier: z.array(z.enum(["A", "B", "C", "POOR"])).optional(),
  state: z.string().optional(),
  assignedUserId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  sortField: z.string().default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadFilters = z.infer<typeof leadFilterSchema>;
