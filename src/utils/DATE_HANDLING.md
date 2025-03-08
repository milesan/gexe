# Date Handling Best Practices

## The Problem

Date handling in JavaScript can be tricky, especially when dealing with:
- Different timezones
- Date serialization/deserialization
- Date arithmetic across day boundaries
- API interactions

The most common issue is dates "shifting" to the previous day due to timezone conversions, especially when:
1. Creating a Date object in local timezone
2. Converting it to a string (which often uses UTC)
3. Parsing that string back into a Date object

## Our Solution

We've implemented a consistent approach to date handling that focuses on:

1. **Normalizing dates to UTC midnight**
2. **Using explicit timezone conversions when needed**
3. **Consistent date formatting**

## Best Practices

### 1. Creating New Dates

```typescript
// ❌ AVOID: Creates date in local timezone
const date = new Date();
const specificDate = new Date(2023, 5, 15); // June 15, 2023 in local timezone

// ✅ BETTER: Use UTC explicitly
const utcDate = new Date(Date.UTC(2023, 5, 15)); // June 15, 2023 in UTC

// ✅ BEST: Use our utility functions
import { normalizeToUTCDate } from '../utils/dates';
const normalizedDate = normalizeToUTCDate(new Date());
```

### 2. Parsing Date Strings

```typescript
// ❌ AVOID: Direct parsing which is timezone-dependent
const date = new Date('2023-06-15');

// ✅ BETTER: Use date-fns parseISO
import { parseISO } from 'date-fns';
const date = parseISO('2023-06-15');

// ✅ BEST: Use our utility functions
import { safeParseDate, apiDateToUTC } from '../utils/timezone';
const date = safeParseDate('2023-06-15');
const apiDate = apiDateToUTC('2023-06-15T00:00:00Z');
```

### 3. Date Arithmetic

```typescript
// ✅ RECOMMENDED: Use date-fns functions
import { addDays, subWeeks } from 'date-fns';
const tomorrow = addDays(normalizedDate, 1);
const lastWeek = subWeeks(normalizedDate, 1);
```

### 4. Date Comparisons

```typescript
// ❌ AVOID: Direct comparison which includes time
if (date1 < date2) { ... }

// ✅ BETTER: Normalize dates first
import { normalizeToUTCDate } from '../utils/dates';
if (normalizeToUTCDate(date1) < normalizeToUTCDate(date2)) { ... }

// ✅ ALSO GOOD: Use date-fns comparison functions
import { isBefore, isAfter, isSameDay } from 'date-fns';
if (isBefore(date1, date2)) { ... }
if (isSameDay(date1, date2)) { ... }
```

### 5. Formatting Dates for Display

```typescript
// ❌ AVOID: Using toLocaleDateString() which is inconsistent
date.toLocaleDateString();

// ✅ BETTER: Use date-fns format
import { format } from 'date-fns';
format(date, 'yyyy-MM-dd');

// ✅ BEST: Use our utility functions
import { formatDateForDisplay } from '../utils/dates';
formatDateForDisplay(date);
```

### 6. Working with APIs

When sending dates to APIs:
```typescript
// ✅ RECOMMENDED: Send ISO strings
const isoString = normalizedDate.toISOString();
```

When receiving dates from APIs:
```typescript
// ✅ RECOMMENDED: Use our utility function
import { apiDateToUTC } from '../utils/timezone';
const date = apiDateToUTC(apiDateString);
```

## Utility Functions

We've created several utility functions to help with date handling:

- `normalizeToUTCDate(date)`: Converts a date to UTC midnight
- `safeParseDate(dateString)`: Safely parses a date string
- `apiDateToUTC(dateString)`: Converts an API date string to a UTC date
- `formatDateForDisplay(date)`: Formats a date for display
- `formatDateOnly(date)`: Formats just the date portion (YYYY-MM-DD)

## Timezone Considerations

Our application uses UTC+1 as a reference timezone for certain operations. Use these functions when needed:

- `convertToUTC1(date, hour)`: Converts a date to UTC+1 at a specific hour
- `getUTC1Date(date)`: Gets the date at UTC+1 midnight
- `formatDateUTC1(date, formatString)`: Formats a date in UTC+1 timezone

## Type Safety

When using date-fns functions that require specific types (like `Day` for weekdays), use explicit type casting:

```typescript
import { Day } from 'date-fns';
startOfWeek(date, { weekStartsOn: dayNumber as Day });
``` 