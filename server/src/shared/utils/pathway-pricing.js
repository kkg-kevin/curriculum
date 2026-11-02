// What a pathway costs on the website (Settings → Pathways → On the website → Price), from its
// catalogue entry (pathway_templates):
//   "none"      — no price: the website takes an enquiry instead of a paid enrolment
//   "whole"     — one price for the pathway (per child)
//   "by_course" — each course priced; a family pays for the course the learner starts at
// mysql2 auto-parses JSON columns, but a row never given one holds null.

const list = (v) => (Array.isArray(v) ? v : typeof v === "string" && v ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []);
const amountOf = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

function pathwayPricing(entry) {
  const mode = ["whole", "by_course"].includes(entry?.pricingMode) ? entry.pricingMode : "none";
  const coursePrices = list(entry?.coursePrices)
    .map((p) => ({ courseId: p?.courseId, amount: amountOf(p?.amount) }))
    .filter((p) => p.courseId && p.amount != null && p.amount >= 0);
  return {
    mode,
    currency: entry?.priceCurrency || "KES",
    amount: mode === "whole" ? amountOf(entry?.priceAmount) : null,
    coursePrices,
  };
}

// A course's own price under a by_course pathway — null when it has none.
function coursePrice(pricing, courseId) {
  if (pricing?.mode !== "by_course") return null;
  return pricing.coursePrices.find((p) => p.courseId === courseId)?.amount ?? null;
}

// Whether the website can take a paid enrolment for it: priced (a whole price, or at least one
// priced course).
function isPriced(pricing) {
  return pricing?.mode === "whole" ? pricing.amount != null : pricing?.mode === "by_course" ? pricing.coursePrices.length > 0 : false;
}

module.exports = { pathwayPricing, coursePrice, isPriced };
