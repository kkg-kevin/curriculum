// Small display helpers shared by the parent portal's pages.

export const formatMoney = (amount, currency = "KES") =>
  `${currency === "KES" ? "KSh" : currency} ${Number(amount || 0).toLocaleString("en-KE")}`;

// "Mon 3 Nov" — from a YYYY-MM-DD date, read as a calendar day (no timezone shift).
export function formatDay(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

// "Today" / "Tomorrow" / "Mon 3 Nov".
export function relativeDay(dateStr) {
  if (!dateStr) return "";
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today.getTime() + 86400000);
  if (dateStr === iso(today)) return "Today";
  if (dateStr === iso(tomorrow)) return "Tomorrow";
  return formatDay(dateStr);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
