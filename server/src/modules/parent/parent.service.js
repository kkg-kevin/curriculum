const LearnerService = require("../learners/learner.service");
const LearnerModel = require("../learners/learner.model");
const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");
const CourseModel = require("../courses/course.model");
const AttendanceModel = require("../attendance/attendance.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");
const { redactUnpublishedReport } = require("../assessments/submissions/grading.utils");
const ReportService = require("../reports/report.service");
const CertificateService = require("../certificates/certificate.service");
const TimetableService = require("../timetable/timetable.service");
const BillingService = require("../billing/billing.service");
const { todayInKenya, addDays } = require("../checkins/checkin.dates");

// The parent portal (/parent): one family, several children. Everything here is about the
// children of the signed-in parent — req.ownLearners, resolved by scope.middleware.js from the
// parent's email — and a child is only ever reached through that list.

const PENDING = ["not_started", "in_progress"];
const PAYABLE = ["issued", "partially_paid", "overdue"];

// One section failing (a hub that's gone, a calendar that can't resolve) leaves that section
// empty rather than the whole family page.
const safe = (promise, fallback) => Promise.resolve(promise).catch(() => fallback);

function childOf(req, childId) {
  const child = (req.ownLearners || []).find((l) => l.id === childId);
  if (!child) throw Object.assign(new Error("Not one of your children"), { statusCode: 404 });
  return child;
}

const courseNames = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = await Promise.all(unique.map((id) => safe(CourseModel.findById(id), null)));
  return new Map(rows.filter(Boolean).map((c) => [c.id, c.name]));
};

async function loginOf(learner) {
  if (!learner.username) return { username: null, hasOwnLogin: false };
  const user = await safe(UserModel.findByUsername(learner.username), null);
  return { username: learner.username, hasOwnLogin: !!user };
}

// What one child's card on the family page needs.
async function childSummary(learner, today) {
  const [hubs, issued, stageDiagnostic, pathwayDiagnostics, reports, certificates, calendar, attendance, login] = await Promise.all([
    safe(LearnerService.getLearnerHubs(learner.id), []),
    safe(AssessmentSubmissionService.getIssuedRowsForLearner(learner.id), []),
    safe(AssessmentSubmissionService.getDiagnosticForLearner(learner.id), null),
    safe(AssessmentSubmissionService.getPathwayDiagnosticsForLearner(learner.id), []),
    safe(ReportService.listForLearner(learner.id), []),
    safe(CertificateService.listForLearner(learner.id), []),
    safe(TimetableService.resolveLearnerCalendar(learner.id, today, addDays(today, 14)), { events: [] }),
    safe(AttendanceModel.findAll({ learnerId: learner.id, dateFrom: addDays(today, -30), dateTo: today }), []),
    loginOf(learner),
  ]);

  const rows = issued.map((row) => ({ ...row, submission: redactUnpublishedReport(row.submission || {}) }));
  const pending = rows
    .filter((r) => PENDING.includes(r.submission.status))
    .sort((a, b) => (a.issue.dueDate || "9999").localeCompare(b.issue.dueDate || "9999"));
  const graded = rows
    .filter((r) => r.submission.status === "graded" && r.assessment?.type !== "survey")
    .sort((a, b) => String(b.submission.gradedAt || b.submission.updatedAt || "").localeCompare(String(a.submission.gradedAt || a.submission.updatedAt || "")));
  const diagnosticsWaiting = [stageDiagnostic, ...pathwayDiagnostics]
    .filter((r) => r && PENDING.includes(r.submission?.status || "not_started"))
    .map((r) => ({ issueId: r.issue.id, name: r.assessment?.name || "Placement diagnostic" }));

  const upcoming = (calendar.events || [])
    .filter((e) => e.date >= today)
    .sort((a, b) => `${a.date} ${a.startTime || ""}`.localeCompare(`${b.date} ${b.startTime || ""}`));
  const latestReport = [...reports].sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")))[0] || null;
  const names = await courseNames([upcoming[0]?.courseId, latestReport?.courseId]);

  // Excused absences don't count either way.
  const marked = attendance.filter((a) => a.status && a.status !== "excused");
  const present = marked.filter((a) => a.status === "present" || a.status === "late").length;

  return {
    id: learner.id,
    firstName: learner.firstName,
    lastName: learner.lastName,
    photo: learner.photo || null,
    accountStatus: learner.accountStatus || "active",
    ...login,
    hubs: hubs.filter((h) => h.status === "active").map((h) => ({
      id: h.id, name: h.name,
      className: h.class ? [h.class.gradeName, h.class.streamName].filter(Boolean).join(" ") : null,
      classId: h.class?.id || null,
      gradeId: h.class?.gradeId || null,
      curriculumId: h.class?.curriculumId || null,
      currentStageId: h.currentStageId || null,
    })),
    work: {
      dueCount: pending.length,
      overdueCount: pending.filter((r) => r.issue.dueDate && r.issue.dueDate < today).length,
      due: pending.slice(0, 3).map((r) => ({ issueId: r.issue.id, name: r.assessment?.name || "Assessment", dueDate: r.issue.dueDate || null, status: r.submission.status })),
      results: graded.slice(0, 3).map((r) => ({
        issueId: r.issue.id,
        name: r.assessment?.name || "Assessment",
        score: r.submission.totalScore,
        maxScore: r.submission.maxScore,
        percent: r.submission.maxScore ? Math.round((Number(r.submission.totalScore || 0) / Number(r.submission.maxScore)) * 100) : null,
      })),
    },
    diagnosticsWaiting,
    latestReport: latestReport && {
      id: latestReport.id,
      courseName: names.get(latestReport.courseId) || null,
      final: !latestReport.sessionId,
      publishedAt: latestReport.publishedAt,
    },
    certificateCount: certificates.filter((c) => c.status !== "revoked").length,
    nextSession: upcoming[0] && {
      date: upcoming[0].date,
      startTime: upcoming[0].startTime || null,
      endTime: upcoming[0].endTime || null,
      courseName: names.get(upcoming[0].courseId) || null,
      sessionTitle: upcoming[0].sessionTitle || null,
    },
    attendance: marked.length ? { percent: Math.round((present / marked.length) * 100), sessions: marked.length } : null,
  };
}

const ParentService = {
  async overview(req) {
    const today = todayInKenya();
    const children = await Promise.all((req.ownLearners || []).map((l) => childSummary(l, today)));
    const invoices = await safe(BillingService.listInvoices(req), []);
    const open = invoices.filter((inv) => PAYABLE.includes(inv.status) && Number(inv.amountDue) > 0);
    const byDue = [...open].sort((a, b) => String(a.dueAt || "9999").localeCompare(String(b.dueAt || "9999")));
    return {
      parent: { name: req.user.name || null, email: req.user.email },
      children,
      billing: {
        openCount: open.length,
        amountDue: open.reduce((sum, inv) => sum + Number(inv.amountDue || 0), 0),
        currency: open[0]?.currency || "KES",
        next: byDue[0] ? { id: byDue[0].id, invoiceNumber: byDue[0].invoiceNumber, amountDue: Number(byDue[0].amountDue), dueAt: byDue[0].dueAt || null } : null,
      },
    };
  },

  // Every child's sessions in one calendar; each event says whose it is (siblings in the same
  // class share one event).
  async timetable(req, from, to) {
    const children = req.ownLearners || [];
    const results = await Promise.all(children.map((l) => safe(TimetableService.resolveLearnerCalendar(l.id, from, to), { events: [], breaks: [], skippedSessions: [] })));
    const byKey = new Map();
    results.forEach((result, i) => {
      for (const event of result.events || []) {
        const key = `${event.classId}|${event.date}|${event.startTime}|${event.courseId}|${event.sessionId || ""}`;
        const existing = byKey.get(key);
        if (existing) existing.learnerIds.push(children[i].id);
        else byKey.set(key, { ...event, learnerIds: [children[i].id] });
      }
    });
    const breaks = new Map();
    results.flatMap((r) => r.breaks || []).forEach((b) => breaks.set(`${b.label}|${b.startDate}|${b.endDate}`, b));
    return { events: [...byKey.values()], breaks: [...breaks.values()], skippedSessions: results.flatMap((r) => r.skippedSessions || []) };
  },

  async childLogin(req, childId) {
    return loginOf(childOf(req, childId));
  },

  // The parent sets (or resets) a child's own login. A child with no username yet gets the one
  // the parent picks — unique across every learner, same rule as the learner form.
  async setChildLogin(req, childId, { username, password }) {
    const child = childOf(req, childId);
    let current = child.username;
    if (!current) {
      if (!username) throw Object.assign(new Error("Choose a username for this login"), { statusCode: 400 });
      const taken = await LearnerModel.findByUsername(username);
      if ((taken && taken.id !== child.id) || (await UserModel.findByUsername(username))) {
        throw Object.assign(new Error("That username is already taken — try another"), { statusCode: 409 });
      }
      await LearnerModel.update(child.id, { username });
      current = username;
    }
    await AuthService.setOrCreatePasswordByUsername({
      name: `${child.firstName} ${child.lastName}`.trim(),
      username: current,
      password,
      role: "learner",
    });
    return { username: current, hasOwnLogin: true };
  },
};

module.exports = ParentService;
