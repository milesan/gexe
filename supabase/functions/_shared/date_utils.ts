import { format } from "https://esm.sh/date-fns@2.29.3";

/**
 * Normalizes a Date object or ISO string to UTC midnight.
 * @param date The Date object or ISO string.
 * @returns A new Date object set to UTC midnight.
 */
export function normalizeToUTCDate(date: Date | string): Date {
  const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
  // Check if the date is valid before attempting to set UTC hours
  if (isNaN(dateObj.getTime())) {
      console.error("[date_utils] Invalid date provided to normalizeToUTCDate:", date);
      // Return a default invalid date or throw an error, depending on desired handling
      return new Date(NaN); // Or throw new Error("Invalid date provided");
  }
  dateObj.setUTCHours(0, 0, 0, 0);
  return dateObj;
}

/**
 * Formats a Date object or ISO string into YYYY-MM-DD format (UTC).
 * @param date The Date object or ISO string.
 * @returns The date formatted as YYYY-MM-DD, or an empty string if invalid.
 */
export function formatDateOnly(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : new Date(date);
  // Check if the date is valid before attempting to format
  if (isNaN(dateObj.getTime())) {
      console.error("[date_utils] Invalid date provided to formatDateOnly:", date);
      return ""; // Return empty string for invalid dates
  }
  return format(dateObj, "yyyy-MM-dd"); // Assumes UTC because normalizeToUTCDate should be used prior if needed
} 