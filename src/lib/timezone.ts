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
