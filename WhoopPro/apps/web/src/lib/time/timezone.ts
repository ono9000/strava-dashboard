function getParts(date: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }

  return map;
}

function getOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = getOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offset * 60000);
}

export function getTodayDateInTimeZone(timeZone: string): string {
  const now = new Date();
  const parts = getParts(now, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function getDayRangeInTimeZone(timeZone: string): { startIso: string; endIso: string; date: string } {
  const now = new Date();
  const parts = getParts(now, timeZone);
  const date = getTodayDateInTimeZone(timeZone);

  const start = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
  const end = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, timeZone);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    date,
  };
}
