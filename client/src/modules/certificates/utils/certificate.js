// What each kind of certificate is called, on the sheet and in lists.
export const KIND_LABELS = { course: "Course", module: "Module", pathway: "Pathway", bootcamp: "Bootcamp" };
const KIND_NOUN = { course: "the course", module: "the module", pathway: "the pathway", bootcamp: "the bootcamp" };

// A certificate arrives in two shapes: the full record (signed-in reads — names under
// `snapshot`) and the narrow public one (verification link, shared profile — names at the top
// level). Everything that draws a certificate goes through `certificateFields` so it takes either.
export function certificateFields(certificate) {
  const s = certificate?.snapshot || {};
  const kind = certificate?.kind || "course";
  const signatory = certificate?.signatory || s.signatory || null;
  return {
    number: certificate?.certificateNumber || "",
    kind,
    kindLabel: KIND_LABELS[kind] || "Course",
    // "has successfully completed the course / the pathway / the bootcamp"
    kindNoun: KIND_NOUN[kind] || KIND_NOUN.course,
    status: certificate?.status || "issued",
    learnerName: certificate?.learnerName || s.learnerName || "",
    title: certificate?.title || s.title || s.courseName || "",
    // A module certificate (19 Nov 2026) also names the course the module is part of.
    partOf: kind === "module" ? certificate?.courseName || s.courseName || "" : "",
    // The course's shape (20 Nov 2026): a module's place ("Module 2 of 3") and a course's modules.
    moduleNumber: kind === "module" ? certificate?.moduleNumber ?? s.moduleNumber ?? null : null,
    moduleCount: kind === "module" ? certificate?.moduleCount ?? s.moduleCount ?? null : null,
    modules: kind === "course" ? (certificate?.modules?.length ? certificate.modules : s.modules || []) : [],
    heading: `${KIND_LABELS[kind] || "Course"} Certificate`,
    hubName: certificate?.hubName || s.hubName || "",
    issuedAt: certificate?.issuedAt || null,
    revokeReason: certificate?.revokeReason || null,
    verifyToken: certificate?.verifyToken || "",
    // { name, title, image } — or null when the workspace has no signatory.
    signatory: signatory && (signatory.name || signatory.image) ? signatory : null,
  };
}

// How the sheet words what was completed (20 Nov 2026). The course is the large title; a module
// certificate says which module above it ("has successfully completed Module 2 of") and its place
// and own name under it ("Module 2 of 3 · Getting Started with Scratch"). A module named
// "Module 2…" isn't prefixed again: "Module 2: Loops" → "Module 2 of 3 · Loops", "Module 2" alone
// → "Module 2 of 3". Older certificates without a number say "a module of" and show the name.
// Pathways and bootcamps: "the pathway" / "the bootcamp" with their name as the title.
const MODULE_PREFIX = /^\s*module\s*\d+\s*[:.\-–—·|]?\s*/i;

export function certificateWording(fields) {
  const f = fields;
  if (f.kind === "module") {
    const n = f.moduleNumber;
    const rest = (f.title || "").replace(MODULE_PREFIX, "").trim();
    const place = n ? `Module ${n}${f.moduleCount ? ` of ${f.moduleCount}` : ""}` : "";
    const detail = [place, n ? rest : f.title].filter(Boolean).join(" · ");
    if (!f.partOf) return { lead: "has successfully completed the module", title: f.title, detail: place, modules: [] };
    return { lead: `has successfully completed ${n ? `Module ${n}` : "a module"} of`, title: f.partOf, detail, modules: [] };
  }
  if (f.kind === "course") return { lead: "has successfully completed the course", title: f.title, detail: "", modules: f.modules || [] };
  return { lead: `has successfully completed ${f.kindNoun}`, title: f.title, detail: "", modules: [] };
}

// Long names step down in size so they stay on one or two lines of the sheet.
export function fitSize(text, steps) {
  const length = (text || "").length;
  const step = steps.find(([max]) => length <= max);
  return step ? step[1] : steps[steps.length - 1][1];
}

// Where the QR on a certificate leads — a page anyone can open, no sign-in.
export function verifyUrl(token) {
  return token ? `${window.location.origin}/certificates/verify/${token}` : "";
}

export function formatCertificateDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export function certificateFilename(certificate) {
  const { learnerName, title, partOf } = certificateFields(certificate);
  const slug = `${learnerName}-${partOf ? `${partOf}-` : ""}${title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${slug || "certificate"}-certificate.pdf`;
}
