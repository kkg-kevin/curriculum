const asyncHandler = require("express-async-handler");
const CertificateService = require("./certificate.service");
const CertificateModel = require("./certificate.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { assertOwn } = require("../../shared/middleware/scope.middleware");
const { revokeSchema, settingsSchema, listSchema } = require("./certificate.validation");

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

// The hubs whose certificates an admin or a school can see and manage: an admin every hub in
// their workspace, a school its own. Worked out once per request.
async function ownHubIds(req) {
  if (req.user.role === "school") return req.ownSchool?.id ? [req.ownSchool.id] : [];
  if (req.user.role === "admin") {
    const hubs = await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true });
    return hubs.map((h) => h.id);
  }
  return [];
}

// Whether this member of staff can see a certificate — the same ownership a final report has
// (report.controller.js's assertClassAccess): a school and an admin by hub, a teacher by a class
// they teach a course in (so a teacher sees course and bootcamp certificates from their classes,
// not a pathway certificate, which belongs to no single class).
async function canAccess(req, certificate, hubIds) {
  if (!certificate) return false;
  if (req.user.role === "teacher") {
    if (!certificate.classId) return false;
    const links = await ClassCourseTeacherLinkModel.findByClassId(certificate.classId);
    return links.some((l) => l.teacherId === req.ownTeacher?.id);
  }
  return (hubIds || (await ownHubIds(req))).includes(certificate.hubId);
}

// Learner-facing: this learner's own certificates (a guardian's, for the child they're viewing).
const listMyCertificates = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: [], count: 0 });
  const data = await CertificateService.listForLearner(learner.id, req.query.hubId || null);
  res.json({ success: true, data, count: data.length });
});

// Learner-facing: what they can earn next and how far along they are (their profile's
// achievements section).
const getMyProgress = asyncHandler(async (req, res) => {
  const learner = req.ownLearner;
  if (!learner) return res.json({ success: true, data: { courses: [], pathways: [] } });
  res.json({ success: true, data: await CertificateService.progressForLearner(learner.id, req.query.hubId || null) });
});

// Staff-facing, three ways in:
//   ?learnerId=            one learner's, from wherever this member of staff can reach
//   ?classId=&courseId=    a class's (optionally one course)
//   neither                every certificate in the admin's workspace / the school's hub, with
//                          ?hubId= ?kind= ?status= ?q= to narrow it (not for teachers)
const listCertificates = asyncHandler(async (req, res) => {
  const { classId, courseId, learnerId } = req.query;
  const hubIds = await ownHubIds(req);

  if (learnerId) {
    await CertificateService.ensureForReports({ learnerId });
    const all = await CertificateService.withSignatory(await CertificateModel.findAll({ learnerId }));
    const data = [];
    for (const certificate of all) if (await canAccess(req, certificate, hubIds)) data.push(certificate);
    return res.json({ success: true, data, count: data.length });
  }

  if (classId) {
    const all = await CertificateService.listForClass(classId, courseId || null);
    // An empty class has nothing to check ownership against, and nothing to show either.
    const data = [];
    for (const certificate of all) if (await canAccess(req, certificate, hubIds)) data.push(certificate);
    return res.json({ success: true, data, count: data.length });
  }

  if (req.user.role === "teacher") fail(400, "classId or learnerId is required");
  const filters = listSchema.parse(req.query);
  if (filters.hubId) assertOwn(hubIds.includes(filters.hubId));
  let data = await CertificateService.listForHubs(filters.hubId ? [filters.hubId] : hubIds, filters);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    data = data.filter((c) =>
      [c.certificateNumber, c.snapshot?.learnerName, c.snapshot?.title, c.snapshot?.hubName].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }
  res.json({ success: true, data, count: data.length });
});

// One certificate: a learner their own (and only while it stands), staff one they can reach.
const getCertificate = asyncHandler(async (req, res) => {
  const certificate = await CertificateService.getById(req.params.id);
  if (!certificate) fail(404, "Certificate not found");
  if (req.user.role === "learner") {
    assertOwn(certificate.learnerId === req.ownLearner?.id);
    assertOwn(certificate.status === "issued");
  } else {
    assertOwn(await canAccess(req, certificate));
  }
  res.json({ success: true, data: certificate });
});

async function loadManageableOrThrow(req) {
  const certificate = await CertificateModel.findById(req.params.id);
  if (!certificate) fail(404, "Certificate not found");
  assertOwn(await canAccess(req, certificate));
  return certificate;
}

const revokeCertificate = asyncHandler(async (req, res) => {
  await loadManageableOrThrow(req);
  const { reason } = revokeSchema.parse(req.body);
  res.json({ success: true, data: await CertificateService.revoke(req.params.id, reason) });
});

const reinstateCertificate = asyncHandler(async (req, res) => {
  await loadManageableOrThrow(req);
  res.json({ success: true, data: await CertificateService.reinstate(req.params.id) });
});

// Who signs this workspace's certificates (Settings → Certificates). Owner only — see app.js.
const getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await CertificateService.getSettings(req.ownerAdminId) });
});

const updateSettings = asyncHandler(async (req, res) => {
  const values = settingsSchema.parse(req.body);
  res.json({ success: true, data: await CertificateService.saveSettings(req.ownerAdminId, values) });
});

// No sign-in: what anyone holding the verification link (the QR on the certificate) sees.
const verifyCertificate = asyncHandler(async (req, res) => {
  const data = await CertificateService.verify(req.params.token);
  res.json({ success: true, data });
});

module.exports = {
  listMyCertificates, getMyProgress, listCertificates, getCertificate, revokeCertificate, reinstateCertificate,
  getSettings, updateSettings, verifyCertificate,
};
