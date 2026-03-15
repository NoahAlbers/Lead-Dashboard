import { z } from "zod";

export const scoringRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).default(0),
  conditionsJson: z.array(
    z.object({
      field: z.string().min(1),
      operator: z.enum([
        "equals",
        "not_equals",
        "in",
        "not_in",
        "greater_than",
        "less_than",
        "contains",
        "is_empty",
        "is_not_empty",
      ]),
      value: z.unknown(),
    })
  ),
  outcomesJson: z.object({
    scoreAdjustment: z.coerce.number(),
    reason: z.string().min(1),
    hardStop: z.boolean().optional(),
    action: z.string().optional(),
  }),
});

export const referralPartnerSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  contactName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  website: z.string().optional(),
  statesServedJson: z.array(z.string()).optional(),
  industriesServedJson: z.array(z.string()).optional(),
  specialtiesJson: z.array(z.string()).optional(),
  preferredLeadTypesJson: z.array(z.string()).optional(),
  minimumClaimSize: z.coerce.number().optional().nullable(),
  maximumClaimSize: z.coerce.number().optional().nullable(),
  exclusionsJson: z.array(z.string()).optional(),
  notes: z.string().optional(),
  rankingPriority: z.coerce.number().int().default(0),
});

export const emailTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["intro", "referral", "follow_up", "internal_handoff"]),
  subjectTemplate: z.string().min(1),
  bodyTemplate: z.string().min(1),
  active: z.boolean().default(true),
});

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "INTAKE", "SALES", "MANAGER"]),
  active: z.boolean().default(true),
});
