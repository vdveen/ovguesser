const amsterdamDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in the Netherlands as YYYY-MM-DD. The daily ride changes at midnight Dutch time. */
export const dateKeyFor = (at: Date | number = Date.now()) => amsterdamDate.format(at);

/** YYYY-MM-DD shifted by whole days, calendar arithmetic only. */
export function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
