import { Inngest } from "inngest";

function resolveInngestDevMode(): boolean {
  const explicit = process.env.INNGEST_DEV;

  if (explicit === undefined || explicit === "") {
    return process.env.NODE_ENV !== "production";
  }

  const normalized = explicit.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false" && normalized !== "off";
}

export const inngest = new Inngest({
  id: "axial-day",
  isDev: resolveInngestDevMode(),
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
  baseUrl: process.env.INNGEST_BASE_URL || undefined,
});
