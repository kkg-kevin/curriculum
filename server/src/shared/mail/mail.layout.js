const env = require("../../config/env");
const { toAbsoluteMediaUrl } = require("../utils/media-url");

// The one HTML shell every email shares — table-based and inline-styled, because that's what mail
// clients actually render. Each email supplies its content as plain data and gets back both the
// HTML and the matching plain-text version, so the two can't drift apart.
//
// Nothing here depends on an image loading: many mail apps block images until the reader allows
// them, so the icon badge, the highlighted figure and the avatars are built from colour and text,
// and every image has a text fallback.

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

// A stored photo/logo as something a mail client can fetch: an absolute http(s) URL, or null.
// A relative "/uploads/…" path only becomes one when API_PUBLIC_URL is set; a data: URI is
// dropped (Gmail doesn't show them).
function imageUrl(value) {
  const url = toAbsoluteMediaUrl(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

// The brand logo sits on this API (see app.js's /email-assets), so it needs API_PUBLIC_URL —
// or MAIL_LOGO_URL to point somewhere else. With neither, the header shows the brand name as text.
const LOGOS = {
  capable: { file: "capable-logo.png", width: 138, height: 30 },
  digifunzi: { file: "digifunzi-logo.png", width: 105, height: 34 },
};
function brandLogo(brand) {
  if (env.MAIL_LOGO_URL) return { url: env.MAIL_LOGO_URL, width: null, height: 34 };
  const logo = LOGOS[String(brand).trim().toLowerCase()];
  if (!logo) return null;
  const url = imageUrl(`/email-assets/${logo.file}`);
  return url ? { ...logo, url } : null;
}

// What kind of email this is, at a glance: the bar across the top, the icon badge and the
// highlighted figure all take their colour from the tone.
const TONES = {
  brand: { accent: "#25476a", tint: "#e8f5fb", ink: "#25476a" },
  info: { accent: "#2e7db5", tint: "#e8f5fb", ink: "#1f5f8b" },
  success: { accent: "#059669", tint: "#ECFDF5", ink: "#047857" },
  celebrate: { accent: "#feb139", tint: "#FEF3C7", ink: "#B45309" },
  warning: { accent: "#D97706", tint: "#FEF3C7", ink: "#B45309" },
  danger: { accent: "#DC2626", tint: "#FEF2F2", ink: "#B91C1C" },
};

// Text-presentation symbols (the trailing U+FE0E stops phones swapping in a colour emoji).
const ICONS = {
  check: "✓︎",
  star: "★︎",
  document: "≡",
  pencil: "✎︎",
  envelope: "✉︎",
  home: "⌂",
  alert: "!",
  cross: "✕︎",
  refresh: "↻︎",
};

const FONT = "Inter,Segoe UI,Helvetica,Arial,sans-serif";
const initialsOf = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";

// A round photo, or the person's initials on a tinted disc. The initials are also the photo's
// alt text, styled, so a blocked image still reads as the same disc.
function avatar({ name, photo, size, tone, radius = "50%" }) {
  const initials = escapeHtml(initialsOf(name));
  const disc = `width:${size}px;height:${size}px;border-radius:${radius};background-color:${tone.tint};color:${tone.ink};font-family:${FONT};font-size:${Math.round(size * 0.36)}px;font-weight:800;text-align:center;line-height:${size}px;`;
  const url = imageUrl(photo);
  return url
    ? `<img src="${escapeHtml(url)}" width="${size}" height="${size}" alt="${initials}" style="display:block;${disc}object-fit:cover;border:0;" />`
    : `<div style="${disc}">${initials}</div>`;
}

const websiteUrl = () => env.MAIL_WEBSITE_URL || String(env.PUBLIC_SITE_URL || "").split(",").map((o) => o.trim()).find((o) => /^https:\/\//i.test(o)) || null;
// MAIL_SOCIAL_LINKS="Facebook=https://…,Instagram=https://…"
const socialLinks = () => String(env.MAIL_SOCIAL_LINKS || "").split(",").map((pair) => {
  const at = pair.indexOf("=");
  const label = at > 0 ? pair.slice(0, at).trim() : "";
  const url = at > 0 ? pair.slice(at + 1).trim() : "";
  return label && /^https?:\/\//i.test(url) ? { label, url } : null;
}).filter(Boolean);

// {
//   heading, greeting?, paragraphs: [string],
//   tone?: "brand" | "info" | "success" | "celebrate" | "warning" | "danger"
//   icon?: one of ICONS' names      the badge above the heading
//   eyebrow?: string               the small label beside the badge ("Invoice", "Payment received")
//   preview?: string               the line a mail app shows next to the subject
//   person?: { name, photo?, caption? }      who the email is about (a learner)
//   highlight?: { label, value, note? }      the one figure that matters (an amount, a new level)
//   rows?: [[label, value]]        a small summary table (an invoice's number, total, due date)
//   button?: { label, url },
//   afterParagraphs?: [string]     shown under the button
//   sender?: { name, logo? }       a hub sending through the platform — heads the email instead of the brand
//   supportEmail?: string          where questions go; defaults to MAIL_REPLY_TO
//   footerNote?: string            why the recipient got this email
//   footerLink?: { label, url }    shown after the footer note ("Manage email preferences")
//   brandName?: string             defaults to MAIL_BRAND_NAME
// }
function renderEmail({
  heading, greeting, paragraphs = [], tone: toneName, icon, eyebrow, preview, person, highlight, rows = [], button,
  afterParagraphs = [], sender, supportEmail, footerNote, footerLink, brandName,
}) {
  const brand = brandName || env.MAIL_BRAND_NAME;
  const tone = TONES[toneName] || TONES.brand;
  const glyph = ICONS[icon] || null;
  const p = (text) => `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.6;color:#374151;">${escapeHtml(text).replace(/\r?\n/g, "<br/>")}</p>`;

  const logo = brandLogo(brand);
  const brandMark = logo
    ? `<img src="${escapeHtml(logo.url)}" ${logo.width ? `width="${logo.width}" ` : ""}height="${logo.height}" alt="${escapeHtml(brand)}" style="display:block;border:0;height:${logo.height}px;${logo.width ? `width:${logo.width}px;` : ""}font-family:${FONT};font-size:18px;font-weight:800;color:#25476a;" />`
    : `<span style="font-size:18px;font-weight:800;color:#25476a;">${escapeHtml(brand)}</span>`;
  const headerHtml = sender?.name
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding-right:12px;vertical-align:middle;">${avatar({ name: sender.name, photo: sender.logo, size: 40, tone: TONES.brand, radius: "10px" })}</td><td style="vertical-align:middle;"><div style="font-size:16px;font-weight:800;color:#111827;line-height:1.3;">${escapeHtml(sender.name)}</div><div style="font-size:11.5px;color:#9CA3AF;line-height:1.4;">via ${escapeHtml(brand)}</div></td></tr></table>`
    : brandMark;

  const badgeHtml = glyph || eyebrow
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>${glyph ? `<td style="width:40px;height:40px;border-radius:50%;background-color:${tone.tint};color:${tone.ink};font-size:19px;font-weight:800;text-align:center;line-height:40px;">${glyph}</td>` : ""}${eyebrow ? `<td style="${glyph ? "padding-left:11px;" : ""}font-size:11.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${tone.ink};">${escapeHtml(eyebrow)}</td>` : ""}</tr></table>`
    : "";

  const personHtml = person?.name
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="padding-right:11px;vertical-align:middle;">${avatar({ name: person.name, photo: person.photo, size: 38, tone: TONES.brand })}</td><td style="vertical-align:middle;">${person.caption ? `<div style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9CA3AF;line-height:1.4;">${escapeHtml(person.caption)}</div>` : ""}<div style="font-size:14px;font-weight:700;color:#111827;line-height:1.3;">${escapeHtml(person.name)}</div></td></tr></table>`
    : "";

  const highlightHtml = highlight?.value
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;"><tr><td style="background-color:${tone.tint};border-radius:12px;padding:16px 18px;border-left:4px solid ${tone.accent};">${highlight.label ? `<div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${tone.ink};">${escapeHtml(highlight.label)}</div>` : ""}<div class="df-figure" style="margin-top:3px;font-size:26px;line-height:1.25;font-weight:800;color:#111827;">${escapeHtml(highlight.value)}</div>${highlight.note ? `<div style="margin-top:3px;font-size:12.5px;color:#4B5563;">${escapeHtml(highlight.note)}</div>` : ""}</td></tr></table>`
    : "";

  const rowsHtml = rows.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0 18px;border:1px solid #E5E7EB;border-radius:10px;border-collapse:separate;">${rows
        .map(
          ([label, value], i) =>
            `<tr><td style="padding:10px 14px;font-size:12.5px;color:#6B7280;${i ? "border-top:1px solid #F3F4F6;" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:10px 14px;font-size:13.5px;font-weight:700;color:#111827;${i ? "border-top:1px solid #F3F4F6;" : ""}">${escapeHtml(value)}</td></tr>`
        )
        .join("")}</table>`
    : "";

  // The fallback is a short link, not the address spelled out: an invoice or reset link is long
  // enough to push everything under it off a phone screen.
  const buttonHtml = button
    ? `<table role="presentation" class="df-btn" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;"><tr><td align="center" style="border-radius:10px;background-color:#25476a;"><a href="${escapeHtml(button.url)}" style="display:block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(button.label)}</a></td></tr></table><p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:#9CA3AF;">Button not working? <a href="${escapeHtml(button.url)}" style="color:#2e7db5;text-decoration:underline;">Open this link instead</a>.</p>`
    : "";

  const support = supportEmail || env.MAIL_REPLY_TO || null;
  const supportAddress = support ? ((String(support).match(/<([^>]+)>/) || [])[1] || String(support)).trim() : null;
  const site = websiteUrl();
  const footerLinks = [
    ...(site ? [{ label: site.replace(/^https?:\/\//i, "").replace(/\/+$/, ""), url: site }] : []),
    ...socialLinks(),
  ];
  const linkStyle = "color:#6B7280;text-decoration:underline;";
  const footerHtml = `<div style="font-size:13px;font-weight:800;color:#25476a;">${escapeHtml(sender?.name || brand)}</div>${
    supportAddress ? `<div style="margin-top:4px;">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(supportAddress)}" style="${linkStyle}">${escapeHtml(supportAddress)}</a>.</div>` : ""
  }${
    footerLinks.length ? `<div style="margin-top:4px;">${footerLinks.map((l) => `<a href="${escapeHtml(l.url)}" style="${linkStyle}">${escapeHtml(l.label)}</a>`).join(" &nbsp;·&nbsp; ")}</div>` : ""
  }<div style="margin-top:12px;padding-top:12px;border-top:1px solid #E5E7EB;">${escapeHtml(footerNote || `You're receiving this email because you have an account on ${brand}.`)}${
    footerLink ? `<div style="margin-top:6px;"><a href="${escapeHtml(footerLink.url)}" style="color:#25476a;font-weight:700;text-decoration:underline;">${escapeHtml(footerLink.label)}</a></div>` : ""
  }</div>`;

  // What a mail app shows beside the subject. Padded so it doesn't run on into the header text.
  const previewText = preview || paragraphs[0] || "";
  const previewHtml = previewText
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(previewText)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`
    : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title>
<style>@media only screen and (max-width:480px){.df-pad{padding-left:20px!important;padding-right:20px!important}.df-btn{width:100%!important}.df-figure{font-size:23px!important}}</style></head>
<body style="margin:0;padding:0;background-color:#F5F7FA;font-family:${FONT};">${previewHtml}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F7FA;padding:28px 12px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
<tr><td style="height:5px;line-height:5px;font-size:0;background-color:${tone.accent};">&nbsp;</td></tr>
<tr><td class="df-pad" style="padding:20px 28px;border-bottom:1px solid #F3F4F6;">${headerHtml}</td></tr>
<tr><td class="df-pad" style="padding:26px 28px 12px;">
${badgeHtml}<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;font-weight:800;color:#111827;">${escapeHtml(heading)}</h1>
${personHtml}${greeting ? p(greeting) : ""}${paragraphs.map(p).join("")}${highlightHtml}${rowsHtml}${buttonHtml}${afterParagraphs.map(p).join("")}
</td></tr>
<tr><td class="df-pad" style="padding:18px 28px 22px;background-color:#F9FAFB;border-top:1px solid #F3F4F6;font-size:11.5px;line-height:1.6;color:#9CA3AF;">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    ...(person?.name ? [`${person.caption ? `${person.caption}: ` : ""}${person.name}`, ""] : []),
    ...(greeting ? [greeting, ""] : []),
    ...paragraphs.flatMap((line) => [line, ""]),
    ...(highlight?.value ? [`${highlight.label ? `${highlight.label}: ` : ""}${highlight.value}${highlight.note ? ` (${highlight.note})` : ""}`, ""] : []),
    ...(rows.length ? [...rows.map(([label, value]) => `${label}: ${value}`), ""] : []),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...afterParagraphs.flatMap((line) => [line, ""]),
    `— ${sender?.name ? `${sender.name} via ${brand}` : brand}`,
    ...(supportAddress ? [`Questions? Write to ${supportAddress}`] : []),
    ...(footerLink ? ["", `${footerLink.label}: ${footerLink.url}`] : []),
  ].join("\n");

  return { html, text };
}

module.exports = { renderEmail, appUrl, escapeHtml };
