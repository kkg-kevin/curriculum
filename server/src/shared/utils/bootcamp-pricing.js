// A bootcamp is priced exactly one of three ways (see bootcamp.service.js's
// assertPricingModeExclusive/assertCourseEntryPricingValid): a single whole-bootcamp price
// (priceAmount), or split across its courses (coursePricing[].priceAmount), or — one level
// deeper — split across an individual course's own modules (coursePricing[].modulePricing[]).
// Only one of these three is ever actually set on a given bootcamp/course.
//
// Bootcamp enrollment (bootcamp-enrollment.service.js) signs a learner up for the WHOLE
// bootcamp's hub+class, not one course or module — there's no course-picker step (see that
// module's own comments). So "the price to pay" has to be a single number regardless of which
// of the three modes the bootcamp actually uses: this resolves priceAmount directly when set,
// otherwise sums every priced course (or every priced module within a by-module course) into one
// total, alongside a breakdown so a confirmation screen or admin view can show what it's made of
// instead of just an opaque total.
//
// mysql2 auto-parses JSON columns on read, but a row that was never given one holds null.
function arr(value) {
  return Array.isArray(value) ? value : [];
}

// Resolves what a bootcamp actually costs right now, from whichever pricing mode is in effect.
// Returns { amount, currency, mode, breakdown } — `amount` is null only when the bootcamp has no
// price configured in any mode yet (an admin hasn't priced it at all). `breakdown` is an array of
// { label, amount, currency } lines (empty for the "whole" mode, since there's nothing to break
// down) - course/module NAMES are not resolved here (would need a DB lookup); callers that want
// human-readable labels should prefer resolveCoursePricing's own richer output and only fall back
// to this for the raw total.
function resolveEffectiveBootcampPrice(bootcamp) {
  if (!bootcamp) return { amount: null, currency: "KES", mode: "none", breakdown: [] };

  if (bootcamp.priceAmount != null) {
    return {
      amount: Number(bootcamp.priceAmount),
      currency: bootcamp.priceCurrency || "KES",
      mode: "whole",
      breakdown: [],
    };
  }

  const coursePricing = arr(bootcamp.coursePricing);
  if (coursePricing.length === 0) {
    return { amount: null, currency: "KES", mode: "none", breakdown: [] };
  }

  const breakdown = [];
  let total = 0;
  let currency = null;
  let hasAny = false;

  for (const course of coursePricing) {
    const modulePricing = arr(course.modulePricing);
    if (modulePricing.length > 0) {
      for (const mod of modulePricing) {
        if (mod.priceAmount == null) continue;
        hasAny = true;
        total += Number(mod.priceAmount);
        currency = currency || mod.priceCurrency || "KES";
        breakdown.push({ courseId: course.courseId, moduleId: mod.moduleId, amount: Number(mod.priceAmount), currency: mod.priceCurrency || "KES" });
      }
    } else if (course.priceAmount != null) {
      hasAny = true;
      total += Number(course.priceAmount);
      currency = currency || course.priceCurrency || "KES";
      breakdown.push({ courseId: course.courseId, moduleId: null, amount: Number(course.priceAmount), currency: course.priceCurrency || "KES" });
    }
  }

  if (!hasAny) return { amount: null, currency: "KES", mode: "none", breakdown: [] };
  return { amount: total, currency: currency || "KES", mode: "by_course", breakdown };
}

module.exports = { resolveEffectiveBootcampPrice };
