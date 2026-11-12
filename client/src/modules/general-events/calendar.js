// "Add to calendar" for a general event, made in the browser from the event the API sends
// (startsAt / endsAt are ISO moments). The website has its own copy (digifunzi-landing
// src/utils/eventCalendar.js) — keep the two in step.
const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (text) => String(text || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function calendarText(event, { url } = {}) {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Digifunzi//Events//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${event.id}@digifunzi-events`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${esc(event.title)}`,
    `LOCATION:${esc(event.format === "online" ? "Online" : [event.venueName, event.venueAddress].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc([event.tagline, url].filter(Boolean).join("\n\n"))}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadCalendar(event, opts) {
  const blob = new Blob([calendarText(event, opts)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${event.slug || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Google Calendar's own "add" page — handy on phones.
export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(event.endsAt)}`,
    details: event.tagline || "",
    location: event.format === "online" ? "Online" : [event.venueName, event.venueAddress].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
