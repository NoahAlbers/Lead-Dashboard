import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";

/** Application timezone — all business logic uses Eastern Time */
export const APP_TZ = "America/New_York";

/** Get current time in EST */
export function estNow(): Date {
  return toZonedTime(new Date(), APP_TZ);
}

/**
 * Get the start of today (midnight) in EST, returned as a UTC Date
 * suitable for Prisma queries.
 */
export function estStartOfDay(date?: Date): Date {
  const zoned = toZonedTime(date ?? new Date(), APP_TZ);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, APP_TZ);
}

/**
 * Get the end of today (23:59:59.999) in EST, returned as a UTC Date.
 */
export function estEndOfDay(date?: Date): Date {
  const zoned = toZonedTime(date ?? new Date(), APP_TZ);
  zoned.setHours(23, 59, 59, 999);
  return fromZonedTime(zoned, APP_TZ);
}

/**
 * Convert a "YYYY-MM-DD" date string (interpreted as EST) to a UTC Date
 * at the start of that EST day.
 */
export function estDateStringToUtcStart(dateStr: string): Date {
  // Parse as local date in EST
  const [year, month, day] = dateStr.split("-").map(Number);
  const estDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  return fromZonedTime(estDate, APP_TZ);
}

/**
 * Convert a "YYYY-MM-DD" date string (interpreted as EST) to a UTC Date
 * at the end of that EST day.
 */
export function estDateStringToUtcEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const estDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  return fromZonedTime(estDate, APP_TZ);
}

/**
 * Convert a UTC Date to a "YYYY-MM-DD" string in EST.
 * Use this for day-bucketing in charts.
 */
export function toEstDateString(date: Date): string {
  return format(toZonedTime(date, APP_TZ), "yyyy-MM-dd");
}

/**
 * Whole Eastern calendar days between `date` and now (0 = today, 1 =
 * yesterday). Wall-clock math, so a lead created at 11:50 PM is "Yesterday"
 * ten minutes later, not "Today" for another 24 hours.
 */
export function estCalendarDaysSince(date: Date | string): number {
  const then = toZonedTime(new Date(date), APP_TZ);
  const now = toZonedTime(new Date(), APP_TZ);
  const thenDay = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((nowDay - thenDay) / 86400000));
}

/** "Today", "Yesterday", or "Nd" by Eastern calendar day. */
export function relativeDayLabel(date: Date | string): string {
  const days = estCalendarDaysSince(date);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d`;
}

/**
 * Start of the Eastern day `daysAgo` days before today, as a UTC Date.
 * estStartOfDayDaysAgo(0) is midnight this morning; (1) is midnight yesterday.
 */
export function estStartOfDayDaysAgo(daysAgo: number): Date {
  const zoned = toZonedTime(new Date(), APP_TZ);
  zoned.setDate(zoned.getDate() - daysAgo);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, APP_TZ);
}
