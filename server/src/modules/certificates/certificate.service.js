const crypto = require("crypto");
const CertificateModel = require("./certificate.model");
const CertificateSettingsModel = require("./certificate-settings.model");
const ReportModel = require("../reports/report.model");
const LearnerModel = require("../learners/learner.model");
const CourseModel = require("../courses/course.model");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const NotificationService = require("../notifications/notification.service");
const logger = require("../../shared/utils/logger");

const NUMBER_PREFIX = "DF";
const NUMBER_DIGITS = 6;
const NUMBER_ATTEMPTS = 5;

function fail(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

// What makes a certificate unique for a learner — see the migration.
const courseKey = (courseId, classId) => `course:${courseId}:${classId}`;
const pathwayKey = (pathwayId) => `pathway:${pathwayId}`;
const bootcampKey = (bootcampId, classId) => `bootcamp:${bootcampId}:${classId}`;

// "DF-2026-000123" — the year it was completed, then a counter that restarts each year.
async function nextCertificateNumber(issuedAt) {
  const prefix = `${NUMBER_PREFIX}-${new Date(issuedAt).getFullYear()}-`;
  const last = await CertificateModel.lastNumberWithPrefix(prefix);
  const next = (last ? Number(last.slice(prefix.length)) : 0) + 1;
  return `${prefix}${String(next).padStart(NUMBER_DIGITS, "0")}`;
}

// The signatory as it stands today, for freezing into a new certificate's snapshot. Null when the
// workspace hasn't set one.
async function currentSignatory(ownerAdminId) {
  const s = await CertificateSettingsModel.get(ownerAdminId);
  if (!s.signatoryName && !s.signatureImage) return null;
  return { name: s.signatoryName, title: s.signatoryTitle, image: s.signatureImage };
}

async function learnerName(learnerId) {
  const learner = await LearnerModel.findById(learnerId);
  return [learner?.firstName, learner?.lastName].filter(Boolean).join(" ").trim() || "Learner";
}

async function hubFor(hubId) {
  const hub = hubId ? await LearningHubModel.findById(hubId) : null;
  return { hubId: hub?.id || hubId || null, hubName: hub?.name || null, ownerAdminId: hub?.ownerAdminId || null };
}

// Inserts a certificate, retrying when two issued at the same moment pick the same next number —
// the unique index rejects the second, which simply takes the one after. If the collision was on
// the certificate itself (another request issued this very one first), theirs is returned.
async function insertCertificate(fields) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const created = await CertificateModel.create({
        ...fields,
        certificateNumber: await nextCertificateNumber(fields.issuedAt),
        verifyToken: crypto.randomBytes(24).toString("base64url"),
        status: "issued",
        revokedAt: null,
        revokeReason: null,
      });
      return { certificate: { ...created, snapshot: fields.snapshot }, isNew: true };
    } catch (err) {
      if (err.code !== "ER_DUP_ENTRY" || attempt >= NUMBER_ATTEMPTS) throw err;
      const raced = await CertificateModel.findByIdentity(fields.learnerId, fields.identityKey);
      if (raced) return { certificate: raced, isNew: false };
    }
  }
}

// Issues the certificate with this identity, or reinstates it if it was revoked (keeping its
// number and verification link). Returns { certificate, isNew } — isNew only for a first issue,
// which is the one moment the family is told.
async function issueOrReinstate({ learnerId, identityKey, kind, subjectId, courseId = null, classId = null, hubId, ownerAdminId, reportId = null, issuedAt, issuedBy = null, snapshot }) {
  const existing = await CertificateModel.findByIdentity(learnerId, identityKey);
  if (existing) {
    if (existing.status === "issued") return { certificate: existing, isNew: false };
    // Names are refreshed (a corrected spelling should show), but the signatory is left exactly
    // as it was first issued — including "none", which goes on showing the workspace's current one.
    const certificate = await CertificateModel.update(existing.id, {
      status: "issued", revokedAt: null, revokeReason: null, reportId, hubId, ownerAdminId,
      snapshot: { ...snapshot, signatory: existing.snapshot?.signatory || null },
    });
    return { certificate, isNew: false };
  }
  return insertCertificate({ learnerId, identityKey, kind, subjectId, courseId, classId, hubId, ownerAdminId, reportId, issuedAt, issuedBy, snapshot });
}

// A final course report is the one with no sessionId — session reports never earn a certificate.
const isPublishedFinalReport = (report) => Boolean(report) && !report.sessionId && report.status === "published";

const CertificateService = {
  // ---- Course certificates --------------------------------------------------------------------

  // Issues the certificate a published final course report earns — or reinstates the one revoked
  // when that report was withdrawn — then checks whether it completes a pathway or a bootcamp.
  // Returns the course certificate, or null for a report that doesn't earn one.
  //
  // `notify` tells the family (in-app + email). It is off when a certificate is being filled in
  // after the fact — see ensureForReports — so nobody is emailed about a course they finished
  // long ago. A reinstatement never notifies: they were told the first time.
  async issueForReport(report, { issuedBy = null, notify = true } = {}) {
    if (!isPublishedFinalReport(report)) return null;
    const [course, cls] = await Promise.all([CourseModel.findById(report.courseId), ClassModel.findById(report.classId)]);
    const { hubId, hubName, ownerAdminId } = await hubFor(report.hubId || cls?.schoolId);
    // The published report already carries the course's name as it was when the learner finished;
    // fall back to the live record for older reports that predate that snapshot.
    const title = report.content?.courseName || course?.name || "Course";

    const { certificate, isNew } = await issueOrReinstate({
      learnerId: report.learnerId,
      identityKey: courseKey(report.courseId, report.classId),
      kind: "course",
      subjectId: report.courseId,
      courseId: report.courseId,
      classId: report.classId,
      hubId,
      ownerAdminId,
      reportId: report.id,
      issuedAt: report.publishedAt || new Date(),
      issuedBy: issuedBy || report.publishedBy || null,
      snapshot: { learnerName: await learnerName(report.learnerId), title, courseName: title, hubName, signatory: await currentSignatory(ownerAdminId) },
    });
    if (isNew && notify) await NotificationService.certificateIssued(certificate);
    await CertificateService.syncProgrammes(report.learnerId, report.classId, { notify });
    return certificate;
  },

  // The report was withdrawn (see ReportService.unpublishReport) — so is what it earned, and any
  // pathway or bootcamp certificate that rested on it.
  async revokeForReport(report) {
    if (!report || report.sessionId) return null;
    const existing = await CertificateModel.findByIdentity(report.learnerId, courseKey(report.courseId, report.classId));
    if (!existing || existing.status === "revoked") return existing;
    const revoked = await CertificateModel.update(existing.id, { status: "revoked", revokedAt: new Date(), revokeReason: null });
    await CertificateService.syncProgrammes(report.learnerId, report.classId, { notify: false });
    return revoked;
  },

  // Never lets a certificate problem undo a publish: the report is the record, the certificate
  // follows it, and ensureForReports below fills in any that were missed.
  async issueForReportSafely(report, options) {
    try {
      return await CertificateService.issueForReport(report, options);
    } catch (err) {
      logger.error("Certificate not issued for report", report?.id, err.message);
      return null;
    }
  },

  async revokeForReportSafely(report) {
    try {
      return await CertificateService.revokeForReport(report);
    } catch (err) {
      logger.error("Certificate not revoked for report", report?.id, err.message);
      return null;
    }
  },

  // Fills in the certificate for every published final report that doesn't have one — reports
  // published before certificates existed, or one whose certificate failed to issue. Runs when
  // certificates are read (no cron, the same lazy pattern as ensureSessionReportsGenerated) and
  // never notifies: the certificate is dated to when the report was published.
  async ensureForReports(filter) {
    const reports = (await ReportModel.findAll({ ...filter, status: "published" })).filter(isPublishedFinalReport);
    if (reports.length === 0) return;
    const existing = await CertificateModel.findAll({ ...filter, kind: "course" });
    const have = new Set(existing.map((c) => c.identityKey + c.learnerId));
    // Oldest first, so certificate numbers run in the order the courses were completed.
    reports.sort((a, b) => new Date(a.publishedAt || 0) - new Date(b.publishedAt || 0));
    for (const report of reports) {
      const key = courseKey(report.courseId, report.classId);
      if (have.has(key + report.learnerId)) continue;
      // Belt and braces: this only ever creates. A certificate that already exists — above all
      // one a member of staff revoked by hand — is never brought back by a read.
      if (await CertificateModel.findByIdentity(report.learnerId, key)) continue;
      await CertificateService.issueForReportSafely(report, { notify: false });
    }
  },

  // ---- Pathway and bootcamp certificates ------------------------------------------------------

  // Re-works out the pathway and bootcamp certificates a learner's course certificates add up to,
  // for the curriculum and bootcamp behind one class. Called whenever one of their course
  // certificates is issued, reinstated or revoked.
  //
  //   pathway  — earned once the learner holds a standing course certificate for every course in
  //              the pathway (from any class).
  //   bootcamp — earned once they hold one, from this class, for every course this bootcamp class
  //              runs.
  //
  // Each records the courses it was earned on. It is revoked only if one of THOSE certificates is
  // revoked — never because a course was added to the pathway afterwards. Never throws: a
  // problem here must not undo the course certificate that triggered it.
  async syncProgrammes(learnerId, classId, { notify = false } = {}) {
    try {
      const cls = classId ? await ClassModel.findById(classId) : null;
      if (!cls) return;
      const mine = await CertificateModel.findAll({ learnerId });
      const standingCourses = mine.filter((c) => c.kind === "course" && c.status === "issued");
      const { hubId, hubName, ownerAdminId } = await hubFor(cls.schoolId);

      const programmes = [];
      const pathways = cls.curriculumId ? await PathwayModel.findByCurriculumId(cls.curriculumId) : [];
      for (const pathway of pathways) {
        const courseIds = Array.isArray(pathway.courses) ? pathway.courses.filter(Boolean) : [];
        programmes.push({ kind: "pathway", identityKey: pathwayKey(pathway.id), subjectId: pathway.id, title: pathway.name, courseIds, classId: null, basis: standingCourses });
      }
      const bootcamp = await CertificateService.bootcampForClass(cls);
      if (bootcamp) {
        programmes.push({
          kind: "bootcamp", identityKey: bootcampKey(bootcamp.id, cls.id), subjectId: bootcamp.id, title: bootcamp.name,
          courseIds: bootcamp.courseIds, classId: cls.id, basis: standingCourses.filter((c) => c.classId === cls.id),
        });
      }

      // First, everything they already hold: a pathway or bootcamp certificate stands for as long
      // as the course certificates it was earned on do — whichever class or curriculum it came
      // from, not only the one that triggered this.
      for (const held of mine.filter((c) => c.kind !== "course" && c.status === "issued")) {
        const basis = held.kind === "bootcamp" ? standingCourses.filter((c) => c.classId === held.classId) : standingCourses;
        const stillHeld = new Set(basis.map((c) => c.courseId));
        if ((held.snapshot?.courseIds || []).some((courseId) => !stillHeld.has(courseId))) {
          await CertificateModel.update(held.id, { status: "revoked", revokedAt: new Date(), revokeReason: null });
          held.status = "revoked";
        }
      }

      // Then, what this class's pathways and bootcamp now add up to.
      for (const programme of programmes) {
        const existing = mine.find((c) => c.identityKey === programme.identityKey) || null;
        const held = new Set(programme.basis.map((c) => c.courseId));
        if (existing?.status === "issued") continue;
        // A certificate a member of staff revoked by hand stays revoked until they reinstate it.
        if (existing?.revokeReason) continue;
        if (programme.courseIds.length === 0 || !programme.courseIds.every((courseId) => held.has(courseId))) continue;

        // Dated to the last course completed, so a certificate filled in later carries the day
        // the programme was actually finished.
        const completedOn = programme.basis
          .filter((c) => programme.courseIds.includes(c.courseId))
          .reduce((latest, c) => (new Date(c.issuedAt) > latest ? new Date(c.issuedAt) : latest), new Date(0));
        const { certificate, isNew } = await issueOrReinstate({
          learnerId,
          identityKey: programme.identityKey,
          kind: programme.kind,
          subjectId: programme.subjectId,
          classId: programme.classId,
          hubId,
          ownerAdminId,
          issuedAt: completedOn,
          snapshot: {
            learnerName: await learnerName(learnerId),
            title: programme.title,
            hubName,
            courseIds: programme.courseIds,
            signatory: await currentSignatory(ownerAdminId),
          },
        });
        if (isNew && notify) await NotificationService.certificateIssued(certificate);
      }
    } catch (err) {
      logger.error("Pathway/bootcamp certificates not updated for learner", learnerId, err.message);
    }
  },

  // The bootcamp a class belongs to, with the courses that class runs — or null for an ordinary
  // class. Required lazily: these modules reach back into classes and reports.
  async bootcampForClass(cls) {
    const BootcampHubModel = require("../bootcamps/bootcamp-hub.model");
    const offering = await BootcampHubModel.findByClassId(cls.id);
    if (!offering) return null;
    const bootcamp = await require("../bootcamps/bootcamp.model").findById(offering.bootcampId);
    if (!bootcamp) return null;
    const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
    const courses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
    return { id: bootcamp.id, name: bootcamp.name, courseIds: courses.map((c) => c.id) };
  },

  // ---- Reading --------------------------------------------------------------------------------

  // Adds `signatory` — the one frozen into the certificate when it was issued, or, for one issued
  // before the workspace set a signatory, the current one.
  async withSignatory(certificates) {
    const current = new Map();
    const out = [];
    for (const certificate of certificates) {
      let signatory = certificate.snapshot?.signatory || null;
      if (!signatory && certificate.ownerAdminId) {
        if (!current.has(certificate.ownerAdminId)) current.set(certificate.ownerAdminId, await currentSignatory(certificate.ownerAdminId));
        signatory = current.get(certificate.ownerAdminId);
      }
      out.push({ ...certificate, signatory });
    }
    return out;
  },

  // A learner's own certificates — only ones still standing. hubId scopes to the hub the portal
  // switcher is on, like every other learner-portal list.
  async listForLearner(learnerId, hubId = null) {
    await CertificateService.ensureForReports({ learnerId });
    const certificates = await CertificateModel.findAll({ learnerId, status: "issued" });
    return CertificateService.withSignatory(hubId ? certificates.filter((c) => c.hubId === hubId) : certificates);
  },

  // Staff view of a class (optionally one course in it), revoked ones included.
  async listForClass(classId, courseId = null) {
    const filter = courseId ? { classId, courseId } : { classId };
    await CertificateService.ensureForReports(filter);
    return CertificateService.withSignatory(await CertificateModel.findAll(filter));
  },

  // Staff: every certificate across a set of hubs (an admin's workspace, or a school's own hub),
  // revoked ones included. kind / status narrow it; the search box is applied by the caller.
  async listForHubs(hubIds, { kind = null, status = null } = {}) {
    if (hubIds.length === 0) return [];
    for (const hubId of hubIds) await CertificateService.ensureForReports({ hubId });
    return CertificateService.withSignatory(
      await CertificateModel.findAll({ hubIds, kind: kind || undefined, status: status || undefined })
    );
  },

  async getById(id) {
    const certificate = await CertificateModel.findById(id);
    return certificate ? (await CertificateService.withSignatory([certificate]))[0] : null;
  },

  // What a learner can earn next, and how far along they are — for the achievements section of
  // their profile. Real counts, not an estimate:
  //   courses   — every course of each class they're in that they don't hold a certificate for,
  //               with how many of its assessed sessions already have a published report.
  //               A course with nothing to assess can't earn a certificate, so it isn't listed.
  //   pathways  — every pathway of those classes' curricula they don't hold one for, with how
  //               many of its courses they have a certificate for.
  // hubId scopes it to the hub the portal switcher is on.
  async progressForLearner(learnerId, hubId = null) {
    // Required lazily: report.service.js requires this module, and these reach back into classes.
    const ReportService = require("../reports/report.service");
    const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
    const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");

    const links = (await LearnerHubLinkModel.findByLearnerId(learnerId))
      .filter((l) => l.status === "active" && l.classId && (!hubId || l.hubId === hubId));
    const standing = await CertificateModel.findAll({ learnerId, status: "issued" });
    const heldKeys = new Set(standing.map((c) => c.identityKey));
    const heldCourseIds = new Set(standing.filter((c) => c.kind === "course").map((c) => c.courseId));

    // Keyed by course: a learner in two classes that run the same course sees it once, at
    // whichever class they're furthest along in — and not at all once they hold its certificate.
    const courses = new Map();
    const pathways = new Map();
    for (const link of links) {
      const cls = await ClassModel.findById(link.classId);
      if (!cls) continue;
      const { hubName } = await hubFor(cls.schoolId);

      const classCourses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
      for (const course of classCourses) {
        if (heldCourseIds.has(course.id)) continue;
        const progress = await ReportService.getCourseProgressForLearner(course.id, cls.id, learnerId);
        if (progress.totalSessions === 0) continue;
        const entry = { kind: "course", id: course.id, classId: cls.id, title: course.name, hubName, done: progress.doneSessions, total: progress.totalSessions };
        const seen = courses.get(course.id);
        if (!seen || entry.done / entry.total > seen.done / seen.total) courses.set(course.id, entry);
      }

      for (const pathway of cls.curriculumId ? await PathwayModel.findByCurriculumId(cls.curriculumId) : []) {
        const courseIds = Array.isArray(pathway.courses) ? pathway.courses.filter(Boolean) : [];
        if (courseIds.length === 0 || heldKeys.has(pathwayKey(pathway.id)) || pathways.has(pathway.id)) continue;
        pathways.set(pathway.id, {
          kind: "pathway", id: pathway.id, title: pathway.name, hubName,
          done: courseIds.filter((id) => heldCourseIds.has(id)).length, total: courseIds.length,
        });
      }
    }
    // Closest to finished first — the one worth chasing sits at the top.
    const byNearest = (a, b) => b.done / b.total - a.done / a.total || a.title.localeCompare(b.title);
    return { courses: [...courses.values()].sort(byNearest), pathways: [...pathways.values()].sort(byNearest) };
  },

  // ---- Staff actions --------------------------------------------------------------------------

  // Revokes a certificate by hand — a mistake that withdrawing the report wouldn't cover (wrong
  // learner record, a programme certificate that shouldn't stand). The reason is kept, and marks
  // it as a deliberate decision: nothing reinstates it automatically.
  async revoke(id, reason) {
    const certificate = await CertificateModel.findById(id);
    if (!certificate) fail(404, "Certificate not found");
    if (certificate.status === "revoked") return certificate;
    const revoked = await CertificateModel.update(id, { status: "revoked", revokedAt: new Date(), revokeReason: reason });
    if (certificate.kind === "course") await CertificateService.syncProgrammes(certificate.learnerId, certificate.classId);
    return revoked;
  },

  // Puts a revoked certificate back — only while what earned it still holds: the final report is
  // still published (course), or every course certificate it rested on still stands (pathway,
  // bootcamp).
  async reinstate(id) {
    const certificate = await CertificateModel.findById(id);
    if (!certificate) fail(404, "Certificate not found");
    if (certificate.status === "issued") return certificate;

    if (certificate.kind === "course") {
      const report = await ReportModel.findOne({ learnerId: certificate.learnerId, courseId: certificate.courseId, classId: certificate.classId });
      if (!isPublishedFinalReport(report)) fail(409, "Publish this learner's final course report first — the certificate follows the report.");
    } else {
      const standing = new Set(
        (await CertificateModel.findAll({ learnerId: certificate.learnerId, kind: "course", status: "issued" })).map((c) => c.courseId)
      );
      if ((certificate.snapshot?.courseIds || []).some((courseId) => !standing.has(courseId))) {
        fail(409, "One of the course certificates this was earned on is no longer valid. Reinstate that one first.");
      }
    }
    const reinstated = await CertificateModel.update(id, { status: "issued", revokedAt: null, revokeReason: null });
    if (certificate.kind === "course") await CertificateService.syncProgrammes(certificate.learnerId, certificate.classId);
    return reinstated;
  },

  // ---- Signatory ------------------------------------------------------------------------------

  getSettings: (ownerAdminId) => CertificateSettingsModel.get(ownerAdminId),
  saveSettings: (ownerAdminId, values) => CertificateSettingsModel.save(ownerAdminId, values),

  // ---- Public ---------------------------------------------------------------------------------

  // What anyone holding a certificate's verification link sees. A hand-built allow-list, like the
  // public learner profile: what is printed on the certificate and whether it still stands —
  // no ids, no scores, nothing about the guardian, and not why it was revoked.
  async verify(token) {
    const certificate = token ? await CertificateModel.findByVerifyToken(token) : null;
    if (!certificate) fail(404, "We couldn't find a certificate for this link");
    return CertificateService.toPublic((await CertificateService.withSignatory([certificate]))[0]);
  },

  toPublic(certificate) {
    return {
      certificateNumber: certificate.certificateNumber,
      kind: certificate.kind,
      status: certificate.status,
      learnerName: certificate.snapshot?.learnerName || null,
      title: certificate.snapshot?.title || certificate.snapshot?.courseName || null,
      hubName: certificate.snapshot?.hubName || null,
      issuedAt: certificate.issuedAt,
      revokedAt: certificate.status === "revoked" ? certificate.revokedAt : null,
      signatory: certificate.signatory || null,
      verifyToken: certificate.verifyToken,
    };
  },

  // For the shared public profile: this learner's standing certificates, in the same narrow shape.
  async listPublicForLearner(learnerId) {
    const certificates = await CertificateService.listForLearner(learnerId);
    return certificates.map(CertificateService.toPublic);
  },
};

module.exports = CertificateService;
