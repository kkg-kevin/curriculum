const VALID_ASSESSMENT_MODES = ["individual", "group"];

function normalizeAssessmentMode(mode) {
  return VALID_ASSESSMENT_MODES.includes(mode) ? mode : "individual";
}

function normalizeAssessmentAttachments(session) {
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

function getSessionAssessmentIds(session) {
  return [...new Set(normalizeAssessmentAttachments(session).map((attachment) => attachment.assessmentId))];
}

function sessionHasAssessment(session, assessmentId) {
  return normalizeAssessmentAttachments(session).some((attachment) => attachment.assessmentId === assessmentId);
}

module.exports = {
  VALID_ASSESSMENT_MODES,
  normalizeAssessmentAttachments,
  getSessionAssessmentIds,
  sessionHasAssessment,
};
