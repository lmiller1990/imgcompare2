import { DateTime } from "luxon";

export function nicelyFormat(iso8601: string) {
  const formatted = DateTime.fromISO(iso8601, { zone: "utc" }) // parse as UTC
    .toLocal() // convert to system timezone
    .toLocaleString({
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      hour12: true,
    });
  return formatted;
}
