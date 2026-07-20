export const VALID_ASSESSMENT_MODES = ["individual", "group"];

export function normalizeAssessmentMode(mode) {
  return VALID_ASSESSMENT_MODES.includes(mode) ? mode : "individual";
}

export function normalizeAssessmentAttachments(session) {
  const attachments = Array.isArray(session?.assessmentAttachments) && session.assessmentAttachments.length > 0
    ? session.assessmentAttachments
    : (Array.isArray(session?.assessmentIds)
      ? session.assessmentIds.map((assessmentId) => ({ assessmentId, mode: "individual" }))
      : []);

  return attachments
    .map((attachment) => ({
      assessmentId: attachment?.assessmentId || attachment?.id || "",
      mode: normalizeAssessmentMode(attachment?.mode),
    }))
    .filter((attachment) => attachment.assessmentId);
}

export function getSessionAssessmentIds(session) {
  return [...new Set(normalizeAssessmentAttachments(session).map((attachment) => attachment.assessmentId))];
}

export function getAssessmentAttachmentById(session, assessmentId) {
  return normalizeAssessmentAttachments(session).find((attachment) => attachment.assessmentId === assessmentId) || null;
}
