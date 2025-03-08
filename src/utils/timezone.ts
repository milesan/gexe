import { addHours, format, startOfDay, setHours, setMinutes, parseISO } from 'date-fns';

// UTC+1 offset in hours
const UTC_PLUS_ONE = 1;

/**
 * Converts a date to UTC+1 timezone at the specified hour.
 * This is important for consistent date handling across different user timezones.
 * 
 * @param date The input date to convert
 * @param hour The hour (0-23) to set in the UTC+1 timezone
 * @returns A new Date object representing the date in UTC+1 at the specified hour
 */
export function convertToUTC1(date: Date, hour: number): Date {
  // Normalize the date first to avoid any time-related issues
  const normalizedDate = startOfDay(new Date(date));
  
  // Convert to UTC midnight
  const utcDate = new Date(Date.UTC(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    normalizedDate.getDate(),
    0, 0, 0, 0
  ));
  
  // Then add hours to get to UTC+1 at the specified hour
  return addHours(utcDate, hour + UTC_PLUS_ONE);
}

/**
 * Safely parses a date string to a Date object, ensuring consistent behavior
 * regardless of the user's timezone.
 * 
 * @param dateString The date string to parse (ISO format preferred)
 * @returns A Date object
 */
export function safeParseDate(dateString: string): Date {
  // First try to parse as ISO
  try {
    return parseISO(dateString);
  } catch (e) {
    // Fallback to regular Date constructor
    return new Date(dateString);
  }
}

/**
 * Converts a date string from API to a consistent Date object
 * This helps prevent timezone issues when working with dates from APIs
 * 
 * @param dateString The date string from API (typically ISO format)
 * @returns A normalized Date object at UTC midnight
 */
export function apiDateToUTC(dateString: string): Date {
  const date = safeParseDate(dateString);
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0, 0, 0, 0
  ));
}

/**
 * Formats a date according to the specified format string, adjusted to UTC+1 timezone.
 * 
 * @param date The date to format
 * @param formatString The date-fns format string
 * @returns Formatted date string in UTC+1 timezone
 */
export function formatDateUTC1(date: Date, formatString: string): string {
  // Add UTC+1 offset to the date
  const utc1Date = addHours(new Date(date), UTC_PLUS_ONE);
  return format(utc1Date, formatString);
}

/**
 * Gets the date at UTC+1 timezone (midnight)
 * 
 * @param date The input date 
 * @returns A new Date object representing the date at midnight in UTC+1
 */
export function getUTC1Date(date: Date): Date {
  const normalizedDate = startOfDay(new Date(date));
  
  const utcDate = new Date(Date.UTC(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    normalizedDate.getDate(),
    0, 0, 0, 0
  ));
  return addHours(utcDate, UTC_PLUS_ONE);
}

// Common check-in/check-out hours
export const CHECK_IN_HOUR = 15; // 3 PM
export const CHECK_OUT_HOUR = 12; // 12 PM