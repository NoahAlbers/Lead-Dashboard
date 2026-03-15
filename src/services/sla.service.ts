import { prisma } from "@/lib/db";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { createNotification, createNotificationsForRole } from "./notification.service";
import { logEvent } from "./activity-log.service";
import type { Lead } from "@prisma/client";

// Terminal statuses where SLA doesn't apply
const TERMINAL_STATUSES = new Set([
  "WON", "LOST", "DISQUALIFIED", "DUPLICATE", "REFERRED_OUT", "ARCHIVED", "MERGED",
]);

// Default SLA thresholds (business minutes)
const DEFAULT_SLA_CONFIGS: Record<string, { firstContact: number; followUp: number; escalation: number | null }> = {
  "A Lead": { firstContact: 120, followUp: 480, escalation: 960 },
  "B Lead": { firstContact: 240, followUp: 960, escalation: 1440 },
  "C Lead": { firstContact: 480, followUp: 1440, escalation: 2400 },
  "Poor Fit": { firstContact: 960, followUp: 2400, escalation: null },
};

// Default office hours
const DEFAULT_OFFICE_HOURS = {
  startTime: "09:00",
  endTime: "16:00",
  activeDays: [1, 2, 3, 4, 5], // Mon-Fri
  timezone: "America/New_York",
};

export interface OfficeHoursConfig {
  startTime: string;
  endTime: string;
  activeDays: number[];
  timezone: string;
}

export interface SlaInfo {
  slaStatus: string;
  elapsedMinutes: number;
  thresholdMinutes: number;
  remainingMinutes: number;
  percentElapsed: number;
  slaType: "first_contact" | "follow_up";
  clockStartedAt: Date;
}

export async function getOfficeHoursConfig(): Promise<OfficeHoursConfig> {
  const config = await prisma.officeHoursConfig.findFirst();
  if (!config) return DEFAULT_OFFICE_HOURS;
  return {
    startTime: config.startTime,
    endTime: config.endTime,
    activeDays: config.activeDays as number[],
    timezone: config.timezone,
  };
}

export async function getHolidayDates(): Promise<Set<string>> {
  const holidays = await prisma.officeHoursHoliday.findMany({ select: { date: true } });
  const set = new Set<string>();
  for (const h of holidays) {
    // Format as YYYY-MM-DD
    set.add(h.date.toISOString().slice(0, 10));
  }
  return set;
}

export async function getSlaConfigForTier(tier: string): Promise<{ firstContact: number; followUp: number; escalation: number | null }> {
  const config = await prisma.slaConfig.findUnique({ where: { qualityTier: tier } });
  if (config) {
    return {
      firstContact: config.firstContactMinutes,
      followUp: config.followUpMinutes,
      escalation: config.escalationMinutes,
    };
  }
  return DEFAULT_SLA_CONFIGS[tier] ?? DEFAULT_SLA_CONFIGS["C Lead"];
}

/**
 * Calculate business minutes between two timestamps.
 * Only counts minutes that fall within office hours on active days, excluding holidays.
 */
export function calculateBusinessMinutes(
  start: Date,
  end: Date,
  officeHours: OfficeHoursConfig,
  holidays: Set<string>
): number {
  if (end <= start) return 0;

  const tz = officeHours.timezone;
  const [startH, startM] = officeHours.startTime.split(":").map(Number);
  const [endH, endM] = officeHours.endTime.split(":").map(Number);
  const officeStartMinutes = startH * 60 + startM;
  const officeEndMinutes = endH * 60 + endM;
  const officeDayMinutes = officeEndMinutes - officeStartMinutes;

  if (officeDayMinutes <= 0) return 0;

  let totalMinutes = 0;
  const current = new Date(start);

  // Iterate day by day
  while (current < end) {
    const zoned = toZonedTime(current, tz);
    const dayOfWeek = zoned.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to ISO day (1=Mon, 7=Sun)
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
    const dateStr = zoned.toISOString().slice(0, 10);

    // Check if this is an active business day and not a holiday
    if (officeHours.activeDays.includes(isoDay) && !holidays.has(dateStr)) {
      // Get start of this day in the timezone
      const dayStart = new Date(zoned);
      dayStart.setHours(startH, startM, 0, 0);

      const dayEnd = new Date(zoned);
      dayEnd.setHours(endH, endM, 0, 0);

      // Convert back to UTC for comparison
      const dayStartUtc = fromZonedTime(dayStart, tz);
      const dayEndUtc = fromZonedTime(dayEnd, tz);

      // Calculate overlap between [start, end] and [dayStartUtc, dayEndUtc]
      const overlapStart = new Date(Math.max(start.getTime(), dayStartUtc.getTime()));
      const overlapEnd = new Date(Math.min(end.getTime(), dayEndUtc.getTime()));

      if (overlapEnd > overlapStart) {
        totalMinutes += (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      }
    }

    // Move to next day start
    const nextDay = new Date(zoned);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    current.setTime(fromZonedTime(nextDay, tz).getTime());
  }

  return Math.floor(totalMinutes);
}

/**
 * Compute SLA info for a single lead.
 */
export async function computeLeadSla(lead: Lead): Promise<SlaInfo | null> {
  if (TERMINAL_STATUSES.has(lead.status)) return null;

  const tier = lead.qualityTier;
  if (!tier) return null;

  const [slaConfig, officeHours, holidays] = await Promise.all([
    getSlaConfigForTier(tier),
    getOfficeHoursConfig(),
    getHolidayDates(),
  ]);

  // Determine which SLA applies
  const hasFirstContact = !!lead.firstContactAt;
  const slaType: "first_contact" | "follow_up" = hasFirstContact ? "follow_up" : "first_contact";
  const thresholdMinutes = slaType === "first_contact" ? slaConfig.firstContact : slaConfig.followUp;
  const escalationMinutes = slaConfig.escalation;

  // Clock starts at lead creation (first contact) or last activity (follow-up)
  const clockStartedAt = slaType === "first_contact"
    ? lead.createdAt
    : (lead.lastActivityAt ?? lead.createdAt);

  const now = new Date();
  const elapsedMinutes = calculateBusinessMinutes(clockStartedAt, now, officeHours, holidays);

  const remainingMinutes = thresholdMinutes - elapsedMinutes;
  const percentElapsed = thresholdMinutes > 0 ? (elapsedMinutes / thresholdMinutes) * 100 : 0;

  let slaStatus: string;
  if (percentElapsed < 75) {
    slaStatus = "on_track";
  } else if (percentElapsed < 100) {
    slaStatus = "warning";
  } else if (escalationMinutes && elapsedMinutes >= escalationMinutes) {
    slaStatus = "escalated";
  } else {
    slaStatus = "breached";
  }

  return {
    slaStatus,
    elapsedMinutes,
    thresholdMinutes,
    remainingMinutes,
    percentElapsed,
    slaType,
    clockStartedAt,
  };
}

/**
 * Recalculate SLA status for all active leads.
 * Detects transitions and fires notifications.
 */
export async function recalculateAllSlas(): Promise<{ updated: number; transitions: number }> {
  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ["WON", "LOST", "DISQUALIFIED", "DUPLICATE", "REFERRED_OUT", "ARCHIVED", "MERGED"] },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      qualityTier: true,
      firstContactAt: true,
      lastActivityAt: true,
      slaStatus: true,
      assignedUserId: true,
      companyName: true,
      fullName: true,
    },
  });

  let updated = 0;
  let transitions = 0;

  for (const lead of leads) {
    const slaInfo = await computeLeadSla(lead as Lead);
    if (!slaInfo) continue;

    const oldStatus = lead.slaStatus;
    const newStatus = slaInfo.slaStatus;

    if (oldStatus !== newStatus) {
      // Update lead
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          slaStatus: newStatus,
          slaBreachedAt: newStatus === "breached" && oldStatus !== "breached" ? new Date() : undefined,
        },
      });
      updated++;

      // Detect transitions and fire notifications
      const leadLabel = lead.companyName || lead.fullName || "Lead";
      const tierLabel = lead.qualityTier ?? "";

      if (oldStatus !== "warning" && newStatus === "warning") {
        transitions++;
        if (lead.assignedUserId) {
          await createNotification(
            lead.assignedUserId,
            "sla_warning",
            `SLA Warning: ${leadLabel}`,
            `${tierLabel} — ${slaInfo.remainingMinutes}m remaining before SLA breach`,
            lead.id,
            "HIGH"
          );
        }
        await logEvent(lead.id, "sla_warning", { elapsed: slaInfo.elapsedMinutes, threshold: slaInfo.thresholdMinutes });
      }

      if (oldStatus !== "breached" && newStatus === "breached") {
        transitions++;
        if (lead.assignedUserId) {
          await createNotification(
            lead.assignedUserId,
            "sla_breach",
            `SLA Breached: ${leadLabel}`,
            `${tierLabel} — ${Math.abs(slaInfo.remainingMinutes)}m overdue`,
            lead.id,
            "CRITICAL"
          );
        }
        await createNotificationsForRole("MANAGER", "sla_breach", `SLA Breached: ${leadLabel}`, `${tierLabel} — ${Math.abs(slaInfo.remainingMinutes)}m overdue`, lead.id, "CRITICAL");
        await logEvent(lead.id, "sla_breach", { elapsed: slaInfo.elapsedMinutes, threshold: slaInfo.thresholdMinutes });
      }

      if (oldStatus !== "escalated" && newStatus === "escalated") {
        transitions++;
        await createNotificationsForRole("MANAGER", "sla_escalation", `SLA Escalated: ${leadLabel}`, `${tierLabel} — requires immediate attention`, lead.id, "CRITICAL");
        await logEvent(lead.id, "sla_escalated", { elapsed: slaInfo.elapsedMinutes, threshold: slaInfo.thresholdMinutes });
      }
    } else if (!lead.slaStatus) {
      // First time setting SLA
      await prisma.lead.update({
        where: { id: lead.id },
        data: { slaStatus: newStatus },
      });
      updated++;
    }
  }

  return { updated, transitions };
}
