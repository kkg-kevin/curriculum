const env = require("../../config/env");

// The one HTML shell every account email shares — table-based and inline-styled, because that's
// what mail clients actually render. Each email supplies its content as plain data and gets back
// both the HTML and the matching plain-text version, so the two can't drift apart.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A link into the client app, e.g. appUrl("/reset-password?token=…").
function appUrl(path = "/") {
  const base = String(env.CLIENT_URL || "").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// {
//   heading, greeting?, paragraphs: [string],
//   rows?: [[label, value]]        a small summary table (an invoice's number, amount, due date)
//   button?: { label, url },
//   afterParagraphs?: [string]     shown under the button
//   footerNote?: string            why the recipient got this email
//   brandName?: string             defaults to MAIL_BRAND_NAME
// }
function renderEmail({ heading, greeting, paragraphs = [], rows = [], button, afterParagraphs = [], footerNote, brandName }) {
  const brand = brandName || env.MAIL_BRAND_NAME;
  const p = (text) => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#374151;">${escapeHtml(text)}</p>`;

  const rowsHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;">${rows
        .map(
          ([label, value], i) =>
            `<tr><td style="padding:10px 14px;font-size:12.5px;color:#6B7280;${i ? "border-top:1px solid #F3F4F6;" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:10px 14px;font-size:13.5px;font-weight:700;color:#111827;${i ? "border-top:1px solid #F3F4F6;" : ""}">${escapeHtml(value)}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:10px;background-color:#25476a;"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(button.label)}</a></td></tr></table><p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#9CA3AF;">If the button doesn't work, copy this link into your browser:<br/><a href="${escapeHtml(button.url)}" style="color:#2e7db5;word-break:break-all;">${escapeHtml(button.url)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;padding:0;background-color:#F5F7FA;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F7FA;padding:28px 12px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
<tr><td style="background-color:#25476a;padding:18px 28px;font-size:17px;font-weight:800;color:#ffffff;">${escapeHtml(brand)}</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:#111827;">${escapeHtml(heading)}</h1>
${greeting ? p(greeting) : ""}${paragraphs.map(p).join("")}${rowsHtml}${buttonHtml}${afterParagraphs.map(p).join("")}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #F3F4F6;font-size:11.5px;line-height:1.6;color:#9CA3AF;">${escapeHtml(footerNote || `You're receiving this email because you have an account on ${brand}.`)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    ...(greeting ? [greeting, ""] : []),
    ...paragraphs.flatMap((line) => [line, ""]),
    ...(rows.length ? [...rows.map(([label, value]) => `${label}: ${value}`), ""] : []),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...afterParagraphs.flatMap((line) => [line, ""]),
    `— ${brand}`,
  ].join("\n");

  return { html, text };
}

module.exports = { renderEmail, appUrl, escapeHtml };
