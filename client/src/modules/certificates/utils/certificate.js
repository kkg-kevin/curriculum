// What each kind of certificate is called, on the sheet and in lists.
export const KIND_LABELS = { course: "Course", pathway: "Pathway", bootcamp: "Bootcamp" };
const KIND_NOUN = { course: "the course", pathway: "the pathway", bootcamp: "the bootcamp" };

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
    hubName: certificate?.hubName || s.hubName || "",
    issuedAt: certificate?.issuedAt || null,
    revokeReason: certificate?.revokeReason || null,
    verifyToken: certificate?.verifyToken || "",
    // { name, title, image } — or null when the workspace has no signatory.
    signatory: signatory && (signatory.name || signatory.image) ? signatory : null,
  };
}

// Where the QR on a certificate leads — a page anyone can open, no sign-in.
export function verifyUrl(token) {
  return token ? `${window.location.origin}/certificates/verify/${token}` : "";
}

export function formatCertificateDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export function certificateFilename(certificate) {
  const { learnerName, title } = certificateFields(certificate);
  const slug = `${learnerName}-${title}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${slug || "certificate"}-certificate.pdf`;
}
