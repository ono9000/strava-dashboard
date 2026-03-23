import { clamp } from "@/lib/ingestion/providers/helpers";
import type { CalendarSnapshot } from "@/lib/ingestion/types";

interface GoogleEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  attendees?: Array<{ responseStatus?: string }>;
}

interface GoogleEventsResponse {
  items?: GoogleEvent[];
}

function estimateFocusBlocks(events: GoogleEvent[]): number {
  const timedEvents = events.filter((event) => event.start?.dateTime && event.end?.dateTime);
  const totalMeetingMinutes = timedEvents.reduce((total, event) => {
    const start = event.start?.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
    const end = event.end?.dateTime ? new Date(event.end.dateTime).getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return total;
    const minutes = Math.max(0, Math.round((end - start) / 60000));
    return total + minutes;
  }, 0);

  const focusedMinutes = Math.max(0, 480 - totalMeetingMinutes);
  return clamp(Math.floor(focusedMinutes / 90), 0, 4);
}

export async function fetchGoogleCalendarSnapshot(
  accessToken: string,
  startIso: string,
  endIso: string,
): Promise<{ calendar: CalendarSnapshot; events: GoogleEvent[] }> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", startIso);
  url.searchParams.set("timeMax", endIso);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Calendar request failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as GoogleEventsResponse;
  const events = payload.items ?? [];
  const meetings = events.filter((event) => Boolean(event.start?.dateTime));

  const heavyKeywords = ["strategy", "interview", "board", "review", "negotiation", "decision", "1:1", "hiring"];
  const socialHeavyMeetings = meetings.filter((event) => {
    const title = (event.summary ?? "").toLowerCase();
    return heavyKeywords.some((keyword) => title.includes(keyword));
  }).length;

  const travelLoad = meetings.filter((event) => Boolean(event.location)).length * 20;
  const decisionLoad = socialHeavyMeetings * 18 + Math.max(0, meetings.length - socialHeavyMeetings) * 8;

  return {
    events,
    calendar: {
      meetingsCount: meetings.length,
      focusBlocksPlanned: estimateFocusBlocks(events),
      decisionLoad: clamp(decisionLoad, 0, 100),
      travelLoad: clamp(travelLoad, 0, 100),
      socialHeavyMeetings,
    },
  };
}
