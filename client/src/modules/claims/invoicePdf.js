import { buildInvoicePdf } from "../billing/components/pdf";
import { BRAND_NAME } from "../../branding";
import { formatMoney, rateDetail, unitsLabel } from "./shared";

// The invoice the system generates for an educator's claim — one of its two invoices, next to
// the eTIMS invoice the educator uploads. Drawn from the claim's own figures (fixed when it was
// submitted), so it always says exactly what was claimed, and laid out by the same PDF builder
// as the workspace's billing invoices. Before a claim is sent, the same invoice is drawn from the
// figures on screen as a draft (`draftClaim`), so the educator can check it first.

// A claim-shaped record for a request not sent yet.
export function draftClaim(course, figures, type) {
  return {
    claimNumber: null,
    type,
    status: "draft",
    createdAt: new Date().toISOString(),
    teacherName: course.teacher?.name,
    teacherEmail: course.teacher?.email,
    teacherPhone: course.teacher?.phone,
    courseName: course.courseName,
    className: course.className,
    hubName: course.hub?.name,
    currency: figures.currency,
    rateType: figures.rateType,
    rate: figures.rate,
    unitsTotal: figures.unitsTotal,
    unitsDelivered: figures.unitsDelivered,
    courseAmount: figures.courseAmount,
    advanceDeducted: type === "full" ? figures.advanceRequested : 0,
    amount: type === "advance" ? figures.advanceAmount : figures.balance,
  };
}

function invoiceFor(claim) {
  const currency = claim.currency || "KES";
  const rateType = claim.rateType || "session";
  const rate = Number(claim.rate ?? claim.sessionRate) || 0;
  const where = [claim.className, claim.hubName].filter(Boolean).join(" · ");
  const course = `${claim.courseName}${where ? ` — ${where}` : ""}`;
  const amount = Number(claim.amount) || 0;
  const courseAmount = Number(claim.courseAmount) || 0;

  let items;
  if (claim.type === "advance") {
    const unitsTotal = claim.unitsTotal ?? claim.sessionsTotal;
    const percent = courseAmount > 0 ? Math.round((amount / courseAmount) * 100) : 0;
    items = [{
      description: `${course}\nAdvance: ${percent}% of the course's value of ${formatMoney(courseAmount, currency)} (${unitsLabel(unitsTotal, rateType)} × ${rateDetail({ ...claim, rate, rateType, currency })})`,
      quantity: 1,
      unitAmount: amount,
      totalAmount: amount,
    }];
  } else {
    const delivered = claim.unitsDelivered ?? claim.sessionsDelivered;
    items = [{
      description: `${course}\n${unitsLabel(delivered, rateType)} delivered at ${rateDetail({ ...claim, rate, rateType, currency })}`,
      quantity: Number(delivered) || 0,
      unitAmount: rate,
      totalAmount: courseAmount,
    }];
    const advance = Number(claim.advanceDeducted) || 0;
    if (advance > 0) items.push({ description: "Less the advance already claimed for this course", quantity: 1, unitAmount: -advance, totalAmount: -advance });
  }

  const notes = [
    claim.claimNumber ? `Claim ${claim.claimNumber}.` : "Draft — the claim number is given when it is sent.",
    claim.invoiceFilename ? `eTIMS invoice attached: ${claim.invoiceFilename}.` : "The eTIMS invoice is attached to the claim separately.",
    claim.note ? `Note: ${claim.note}` : null,
  ].filter(Boolean).join(" ");

  return {
    invoiceNumber: claim.claimNumber || "DRAFT",
    status: claim.status === "draft" ? "draft" : "issued",
    invoiceType: claim.type === "advance" ? "educator_claim_—_advance" : "educator_claim_—_full_payment",
    issuedAt: claim.createdAt,
    dueAt: null,
    // A short label only — the meta row has narrow columns; the course is in the line itself.
    periodLabel: claim.className || "—",
    currency,
    issuedBy: { name: claim.teacherName || "Educator", email: claim.teacherEmail || null, phone: claim.teacherPhone || null },
    billTo: { name: BRAND_NAME },
    learner: null,
    items,
    subtotal: amount,
    discount: 0,
    total: amount,
    amountDue: claim.status === "paid" ? 0 : amount,
    notes,
  };
}

export function downloadClaimInvoice(claim) {
  return buildInvoicePdf(invoiceFor(claim));
}

// The same invoice as a file to show on screen: { blob, filename }.
export function claimInvoiceFile(claim) {
  return buildInvoicePdf(invoiceFor(claim), { output: "blob" });
}
