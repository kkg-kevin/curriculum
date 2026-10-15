const { z } = require("zod");

// The website's X-Visit-Source header (digifunzi-landing's utils/visitSource.js): how the visitor
// first found the site, sent with every form it posts. URI-encoded JSON. It is the visitor's own
// browser talking, so anything malformed, oversized or odd is dropped rather than refused — a
// family's enquiry must never fail over where they came from.
const text = z.string().trim().max(300).optional();

const visitSourceSchema = z.object({
  landingPage: z.string().trim().startsWith("/").max(300),
  referrer: text,
  utmSource: text,
  utmMedium: text,
  utmCampaign: text,
  firstVisitAt: z.string().datetime().optional(),
});

const MAX_HEADER = 2000;

// { landingPage, referrer?, utmSource?, utmMedium?, utmCampaign?, firstVisitAt? } or null.
function visitSourceFrom(req) {
  const raw = req.get("X-Visit-Source");
  if (!raw || raw.length > MAX_HEADER) return null;
  try {
    const parsed = visitSourceSchema.safeParse(JSON.parse(decodeURIComponent(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

module.exports = { visitSourceFrom };
