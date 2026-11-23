const crypto = require("crypto");
const db = require("../../config/db");
const CertificateModel = require("./certificate.model");
const CertificateSettingsModel = require("./certificate-settings.model");
const ReportModel = require("../reports/report.model");
const LearnerModel = require("../learners/learner.model");
const CourseModel = require("../courses/course.model");
const ModuleModel = require("../courses/module.model");
const ClassModel = require("../classes/class.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const PathwayModel = require("../curriculum/competency-framework/pathway.model");
const LearnerPathwayModel = require("../curriculum/competency-framework/learner-pathway.model");
const NotificationService = require("../notifications/notification.service");
const { courseOrder } = require("../courses/session-numbering");
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
const moduleKey = (moduleId, classId) => `module:${moduleId}:${classId}`;
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

// The modules a certificate names (20 Nov 2026): each course's modules that have sessions, in
// order — the same modules certificateScopes gives a certificate of their own, so empty when the
// course has fewer than two. Map courseId → [{ id, name }]. Two queries for any number of courses.
async function courseOutlines(courseIds) {
  const ids = [...new Set((courseIds || []).filter(Boolean))];
  const out = new Map(ids.map((id) => [id, []]));
  if (ids.length === 0) return out;
  const [modules, sessionModules] = await Promise.all([
    db("course_modules").whereIn("courseId", ids).select("id", "courseId", "name", "order"),
    db("course_sessions").whereIn("courseId", ids).whereNotNull("moduleId").distinct("moduleId"),
  ]);
  const withSessions = new Set(sessionModules.map((s) => s.moduleId));
  for (const courseId of ids) {
    const list = modules
      .filter((m) => m.courseId === courseId && withSessions.has(m.id))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((m) => ({ id: m.id, name: m.name }));
    out.set(courseId, list.length >= 2 ? list : []);
  }
  return out;
}

// What a module or course certificate records about the course's shape: a module's place in it
// ("Module 2 of 3"), a course's module names. Frozen into the snapshot at issue.
function outlineFields(kind, outline, moduleId = null) {
  if (kind === "module") {
    const at = outline.findIndex((m) => m.id === moduleId);
    return at >= 0 ? { moduleNumber: at + 1, moduleCount: outline.length } : {};
  }
  if (kind === "course") return outline.length ? { modules: outline.map((m) => m.name) } : {};
  return {};
}

// A partner school's logo for the certificate's foot ("In partnership with", 20 Nov 2026): only a
// school hub (B2B) with a logo of its own — never a club, co-working space or Home Learning holder.
function hubLogoOf(hub) {
  return hub && hub.hubType === "school" && hub.photo ? hub.photo : null;
}

async function hubFor(hubId) {
  const hub = hubId ? await LearningHubModel.findById(hubId) : null;
  return { hubId: hub?.id || hubId || null, hubName: hub?.name || null, hubLogo: hubLogoOf(hub), ownerAdminId: hub?.ownerAdminId || null };
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
      status: "issued", revokedAt: null, revokeReason: null, reportId: reportId ?? existing.reportId ?? null, hubId, ownerAdminId,
      snapshot: { ...snapshot, signatory: existing.snapshot?.signatory || null },
    });
    return { certificate, isNew: false };
  }
  return insertCertificate({ learnerId, identityKey, kind, subjectId, courseId, classId, hubId, ownerAdminId, reportId, issuedAt, issuedBy, snapshot });
}

// A final course report has neither a sessionId nor a moduleId; a module report (19 Nov 2026) has
// a moduleId. Session reports never earn a certificate.
const isPublishedFinalReport = (report) => ReportModel.isFinalCourseReport(report) && report.status === "published";
const isPublishedModuleReport = (report) => ReportModel.isModuleReport(report) && report.status === "published";


const CertificateService = {
  // ---- Course certificates --------------------------------------------------------------------

  // Issues the certificate a published final course report carries — or reinstates the one revoked
  // when that report was withdrawn — then checks whether it completes a pathway or a bootcamp.
  // Returns the course certificate, or null for a report that doesn't carry one. Called when the
  // educator issues it (issueForReportByStaff) — never on publish since 19 Nov 2026.
  //
  // `notify` tells the family (in-app + email). A reinstatement never notifies: they were told the
  // first time.
  async issueForReport(report, { issuedBy = null, notify = true } = {}) {
    if (isPublishedModuleReport(report)) return CertificateService.issueForModuleReport(report, { issuedBy, notify });
    if (!isPublishedFinalReport(report)) return null;
    const [course, cls] = await Promise.all([CourseModel.findById(report.courseId), ClassModel.findById(report.classId)]);
    const { hubId, hubName, hubLogo, ownerAdminId } = await hubFor(report.hubId || cls?.schoolId);
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
      snapshot: {
        learnerName: await learnerName(report.learnerId), title, courseName: title, hubName, hubLogo, signatory: await currentSignatory(ownerAdminId),
        ...outlineFields("course", (await courseOutlines([report.courseId])).get(report.courseId) || []),
      },
    });
    if (isNew && notify) await NotificationService.certificateIssued(certificate);
    // An educator in training (modules/tot/) who has finished a whole TOT curriculum moves up a level.
    await require("../tot/tot.service").onCourseCertificate(certificate);
    await CertificateService.syncProgrammes(report.learnerId, report.classId, { notify });
    return certificate;
  },

  // The report was withdrawn (see ReportService.unpublishReport) — so is what it earned, and any
  // pathway or bootcamp certificate that rested on it.
  async revokeForReport(report) {
    if (!report || report.sessionId) return null;
    if (report.moduleId) {
      // A module report withdrawn — its module certificate goes with it (nothing rests on one).
      const held = await CertificateModel.findByIdentity(report.learnerId, moduleKey(report.moduleId, report.classId));
      if (!held || held.status === "revoked") return held;
      return CertificateModel.update(held.id, { status: "revoked", revokedAt: new Date(), revokeReason: null });
    }
    const existing = await CertificateModel.findByIdentity(report.learnerId, courseKey(report.courseId, report.classId));
    if (!existing || existing.status === "revoked") return existing;
    const revoked = await CertificateModel.update(existing.id, { status: "revoked", revokedAt: new Date(), revokeReason: null });
    await CertificateService.syncProgrammes(report.learnerId, report.classId, { notify: false });
    return revoked;
  },

  // Never lets a certificate problem undo the caller's own change.
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

  // ---- Generated by the educator at the last session (19 Nov 2026, user — the simple flow) ------
  //
  // "Assessment issued → marked → report sent; at the last session of a module, generate the
  // certificate." No module or final report needed. A course with two or more modules (that have
  // sessions) offers a certificate per module, opening at that module's last session; every course
  // offers a course certificate at its last session. "Last session reached" is the timetable's
  // (ReportService.filingWindows): reached, or no timetable, or the timetable never gets there.

  // Which certificates this class's course offers, and when each opens.
  // { modules: [{ moduleId, moduleName, lastSessionId, window }], course: { lastSessionId, window } }
  async certificateScopes(classId, courseId) {
    const ReportService = require("../reports/report.service");
    let [modules, sessions, windows] = await Promise.all([
      ModuleModel.findByCourseId(courseId),
      db("course_sessions").where({ courseId }).orderBy("order", "asc").select("id", "moduleId", "order"),
      ReportService.filingWindows(classId, courseId),
    ]);
    const ordered = [...modules].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const withSessions = ordered.filter((m) => sessions.some((s) => s.moduleId === m.id));
    // The course order the course pages show (modules in order, then each module's sessions).
    sessions = courseOrder(sessions, modules);
    const lastOf = (moduleId) => sessions.filter((s) => s.moduleId === moduleId).pop();
    return {
      modules: withSessions.length >= 2
        ? withSessions.map((m) => ({ moduleId: m.id, moduleName: m.name, lastSessionId: lastOf(m.id)?.id || null, window: windows.modules.get(m.id) || windows.course }))
        : [],
      course: { lastSessionId: sessions[sessions.length - 1]?.id || null, window: windows.course },
    };
  },

  // One learner's module or course certificate, straight from the educator — no report behind it.
  // A revoked one comes back with its number. Returns { certificate, isNew }.
  async issueDirect({ kind, learnerId, classId, courseId, moduleId = null, issuedBy = null, notify = true }) {
    const [course, cls] = await Promise.all([CourseModel.findById(courseId), ClassModel.findById(classId)]);
    const { hubId, hubName, hubLogo, ownerAdminId } = await hubFor(cls?.schoolId);
    const courseName = course?.name || "Course";
    const base = { learnerId, courseId, classId, hubId, ownerAdminId, reportId: null, issuedAt: new Date(), issuedBy };
    const people = { learnerName: await learnerName(learnerId), hubName, hubLogo, signatory: await currentSignatory(ownerAdminId) };
    const outline = (await courseOutlines([courseId])).get(courseId) || [];
    if (kind === "module") {
      const courseModule = await ModuleModel.findById(moduleId);
      const moduleName = courseModule?.name || "Module";
      const result = await issueOrReinstate({ ...base, identityKey: moduleKey(moduleId, classId), kind: "module", subjectId: moduleId, snapshot: { ...people, title: moduleName, moduleName, courseName, ...outlineFields("module", outline, moduleId) } });
      if (result.isNew && notify) await NotificationService.certificateIssued(result.certificate);
      return result;
    }
    const result = await issueOrReinstate({ ...base, identityKey: courseKey(courseId, classId), kind: "course", subjectId: courseId, snapshot: { ...people, title: courseName, courseName, ...outlineFields("course", outline) } });
    if (result.isNew && notify) await NotificationService.certificateIssued(result.certificate);
    await require("../tot/tot.service").onCourseCertificate(result.certificate);
    await CertificateService.syncProgrammes(learnerId, classId, { notify });
    return result;
  },

  // Generate certificates for a class: one module's (moduleId) or the course's; every active
  // learner, or just learnerIds. Learners already holding it are skipped. { done, skipped }.
  async generateForClass({ classId, courseId, moduleId = null, learnerIds = null, issuedBy = null }) {
    const cls = await ClassModel.findById(classId);
    if (!cls) fail(404, "Class not found");
    const scopes = await CertificateService.certificateScopes(classId, courseId);
    let window = scopes.course.window;
    if (moduleId) {
      const scope = scopes.modules.find((m) => m.moduleId === moduleId);
      if (!scope) fail(409, "This module has no certificate of its own — the course certificate covers it.");
      window = scope.window;
    }
    if (!scopes.course.lastSessionId) fail(409, "This course has no sessions yet.");
    if (!window.open) fail(409, `Certificates open when the class reaches the ${moduleId ? "module's" : "course's"} last session${window.date ? ` (${window.date})` : ""}.`);
    const active = (await db("learner_hub_links").where({ classId, status: "active" }).pluck("learnerId"));
    const targets = learnerIds ? active.filter((id) => learnerIds.includes(id)) : active;
    if (learnerIds && targets.length === 0) fail(400, "That learner isn't active in this class.");
    let done = 0;
    let skipped = 0;
    for (const learnerId of targets) {
      const heldNow = await CertificateModel.findByIdentity(learnerId, moduleId ? moduleKey(moduleId, classId) : courseKey(courseId, classId));
      if (heldNow?.status === "issued") { skipped += 1; continue; }
      await CertificateService.issueDirect({ kind: moduleId ? "module" : "course", learnerId, classId, courseId, moduleId, issuedBy });
      done += 1;
    }
    return { done, skipped };
  },

  // ---- Issued by the educator from a report (19 Nov 2026, superseded the same day) --------------
  //
  // Certificates are no longer issued when a report is published (and no longer filled in when
  // certificates are read): once a learner's module report or final course report is published, the
  // educator (or an admin / hub) issues the certificate — one learner, or the whole class. Issuing
  // a revoked one again brings it back with the same number (and doesn't tell the family again).
  async issueForReportByStaff(reportId, issuedBy = null) {
    const report = await ReportModel.findById(reportId);
    if (!report) fail(404, "Report not found");
    if (report.sessionId) fail(409, "Session reports don't carry a certificate — issue it from the module or final course report.");
    if (report.status !== "published") fail(409, "Publish this report first — then issue the certificate.");
    const certificate = await CertificateService.issueForReport(report, { issuedBy, notify: true });
    if (!certificate) fail(409, "This report doesn't carry a certificate.");
    return certificate;
  },

  // The module or course certificate a learner holds (issued or revoked) for one class's course
  // (moduleId: that module's), or null.
  async findForScope({ learnerId, courseId, classId, moduleId = null }) {
    return CertificateModel.findByIdentity(learnerId, moduleId ? moduleKey(moduleId, classId) : courseKey(courseId, classId));
  },

  // ---- Module certificates (19 Nov 2026) ------------------------------------------------------
  //
  // Every module earns its own certificate ("Intro to Python" in the Python course): it follows the
  // module's combined report exactly as a course certificate follows the final report — issued
  // automatically when the educator publishes the module report, revoked when it's withdrawn,
  // reinstated (same number) on re-publish.
  async issueForModuleReport(report, { issuedBy = null, notify = true } = {}) {
    const courseModule = await ModuleModel.findById(report.moduleId);
    if (!courseModule) return null;
    const [course, cls] = await Promise.all([CourseModel.findById(report.courseId), ClassModel.findById(report.classId)]);
    const { hubId, hubName, hubLogo, ownerAdminId } = await hubFor(report.hubId || cls?.schoolId);
    // Names as the report froze them, else the live records.
    const moduleName = report.content?.moduleName || courseModule.name;
    const courseName = report.content?.courseName || course?.name || null;
    const { certificate, isNew } = await issueOrReinstate({
      learnerId: report.learnerId,
      identityKey: moduleKey(report.moduleId, report.classId),
      kind: "module",
      subjectId: report.moduleId,
      courseId: report.courseId,
      classId: report.classId,
      hubId,
      ownerAdminId,
      reportId: report.id,
      issuedAt: report.publishedAt || new Date(),
      issuedBy: issuedBy || report.publishedBy || null,
      snapshot: {
        learnerName: await learnerName(report.learnerId), title: moduleName, moduleName, courseName, hubName, hubLogo, signatory: await currentSignatory(ownerAdminId),
        ...outlineFields("module", (await courseOutlines([report.courseId])).get(report.courseId) || [], report.moduleId),
      },
    });
    if (isNew && notify) await NotificationService.certificateIssued(certificate);
    return certificate;
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
      const { hubId, hubName, hubLogo, ownerAdminId } = await hubFor(cls.schoolId);

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
      for (const held of mine.filter((c) => (c.kind === "pathway" || c.kind === "bootcamp") && c.status === "issued")) {
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
            hubLogo,
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
  //
  // Also fills in the course outline (a module's "Module 2 of 3", a course's module names) on
  // module and course certificates issued before 20 Nov 2026, from the course as it is now, so
  // every sheet reads the same way. Newer certificates carry their own, frozen at issue.
  async withSignatory(certificates) {
    const current = new Map();
    const needsOutline = (c) => (c.kind === "module" && c.snapshot?.moduleNumber == null) || (c.kind === "course" && !c.snapshot?.modules);
    const outlines = await courseOutlines(certificates.filter(needsOutline).map((c) => c.courseId));
    // Certificates from before the partner-school logo (20 Nov 2026) take the hub's logo as it is now.
    const needsLogo = (c) => c.hubId && c.snapshot && !("hubLogo" in c.snapshot);
    const logoHubIds = [...new Set(certificates.filter(needsLogo).map((c) => c.hubId))];
    const hubLogos = new Map(logoHubIds.length
      ? (await db("learning_hubs").whereIn("id", logoHubIds).select("id", "hubType", "photo")).map((h) => [h.id, hubLogoOf(h)])
      : []);
    const out = [];
    for (const certificate of certificates) {
      let signatory = certificate.snapshot?.signatory || null;
      if (!signatory && certificate.ownerAdminId) {
        if (!current.has(certificate.ownerAdminId)) current.set(certificate.ownerAdminId, await currentSignatory(certificate.ownerAdminId));
        signatory = current.get(certificate.ownerAdminId);
      }
      let snapshot = needsOutline(certificate)
        ? { ...(certificate.snapshot || {}), ...outlineFields(certificate.kind, outlines.get(certificate.courseId) || [], certificate.subjectId) }
        : certificate.snapshot;
      if (needsLogo(certificate)) snapshot = { ...snapshot, hubLogo: hubLogos.get(certificate.hubId) || null };
      out.push({ ...certificate, snapshot, signatory });
    }
    return out;
  },

  // A learner's own certificates — only ones still standing. hubId scopes to the hub the portal
  // switcher is on, like every other learner-portal list.
  async listForLearner(learnerId, hubId = null) {
    const certificates = await CertificateModel.findAll({ learnerId, status: "issued" });
    return CertificateService.withSignatory(hubId ? certificates.filter((c) => c.hubId === hubId) : certificates);
  },

  // Staff view of a class (optionally one course in it), revoked ones included.
  async listForClass(classId, courseId = null) {
    const filter = courseId ? { classId, courseId } : { classId };
    return CertificateService.withSignatory(await CertificateModel.findAll(filter));
  },

  // Staff: every certificate across a set of hubs (an admin's workspace, or a school's own hub),
  // revoked ones included. kind / status narrow it; the search box is applied by the caller.
  async listForHubs(hubIds, { kind = null, status = null } = {}) {
    if (hubIds.length === 0) return [];
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
    // Only the pathway(s) the learner is actually in — placed by their diagnostic or by staff
    // (learner_pathways) — not every pathway their curriculum offers.
    const placedPathwayIds = new Set((await LearnerPathwayModel.findByLearner(learnerId)).map((p) => p.pathwayId));
    // Classes they were in before (published reports there) — on the same curriculum + grade as a
    // class they're in now, their sessions done there count toward progress here (17 Nov 2026).
    const reportedClassIds = (await db("reports").where({ learnerId, status: "published" }).whereNotNull("sessionId").distinct("classId")).map((r) => r.classId).filter(Boolean);
    const reportedClasses = reportedClassIds.length ? await db("classes").whereIn("id", reportedClassIds).select("id", "curriculumId", "gradeId") : [];
    const earlierFor = (cls) => reportedClasses.filter((c) => c.id !== cls.id && c.curriculumId === cls.curriculumId && c.gradeId === cls.gradeId).map((c) => c.id);

    // Keyed by course: a learner in two classes that run the same course sees it once, at
    // whichever class they're furthest along in — and not at all once they hold its certificate.
    const courses = new Map();
    const modules = new Map();
    const pathways = new Map();
    for (const link of links) {
      const cls = await ClassModel.findById(link.classId);
      if (!cls) continue;
      const { hubName } = await hubFor(cls.schoolId);

      const classCourses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
      for (const course of classCourses) {
        if (heldCourseIds.has(course.id)) continue;
        const progress = await ReportService.getCourseProgressForLearner(course.id, cls.id, learnerId, earlierFor(cls));
        if (progress.totalSessions === 0) continue;
        const entry = { kind: "course", id: course.id, classId: cls.id, title: course.name, hubName, done: progress.doneSessions, total: progress.totalSessions };
        const seen = courses.get(course.id);
        if (!seen || entry.done / entry.total > seen.done / seen.total) courses.set(course.id, entry);

        // Its modules with their own certificate (19 Nov 2026) that they don't hold yet.
        const { modules: reportable } = await ReportService.reportableModules(course.id);
        if (reportable.length) {
          const mp = await ReportService.getModulesProgress(cls.id, course.id, reportable.map((m) => m.id), [learnerId]);
          for (const m of reportable) {
            if (heldKeys.has(moduleKey(m.id, cls.id))) continue;
            const p = mp.get(m.id).get(learnerId);
            if (!p?.total) continue;
            modules.set(`${m.id}:${cls.id}`, { kind: "module", id: m.id, classId: cls.id, title: m.name, partOf: course.name, hubName, done: p.done, total: p.total });
          }
        }
      }

      for (const pathway of cls.curriculumId ? await PathwayModel.findByCurriculumId(cls.curriculumId) : []) {
        const courseIds = Array.isArray(pathway.courses) ? pathway.courses.filter(Boolean) : [];
        if (!placedPathwayIds.has(pathway.id)) continue;
        if (courseIds.length === 0 || heldKeys.has(pathwayKey(pathway.id)) || pathways.has(pathway.id)) continue;
        pathways.set(pathway.id, {
          kind: "pathway", id: pathway.id, title: pathway.name, hubName,
          done: courseIds.filter((id) => heldCourseIds.has(id)).length, total: courseIds.length,
        });
      }
    }
    // Closest to finished first — the one worth chasing sits at the top.
    const byNearest = (a, b) => b.done / b.total - a.done / a.total || a.title.localeCompare(b.title);
    return { courses: [...courses.values()].sort(byNearest), modules: [...modules.values()].sort(byNearest), pathways: [...pathways.values()].sort(byNearest) };
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

    // A module or course certificate is the educator's decision (19 Nov 2026) — nothing to check.
    if (certificate.kind !== "course" && certificate.kind !== "module") {
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
      // A module certificate also names the course the module is part of.
      courseName: certificate.kind === "module" ? certificate.snapshot?.courseName || null : null,
      // The course's shape (20 Nov 2026): "Module 2 of 3" on a module's, the modules on a course's.
      moduleNumber: certificate.kind === "module" ? certificate.snapshot?.moduleNumber ?? null : null,
      moduleCount: certificate.kind === "module" ? certificate.snapshot?.moduleCount ?? null : null,
      modules: certificate.kind === "course" ? certificate.snapshot?.modules || [] : [],
      hubName: certificate.snapshot?.hubName || null,
      // A partner school's logo ("In partnership with") — school hubs only.
      hubLogo: certificate.snapshot?.hubLogo || null,
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
