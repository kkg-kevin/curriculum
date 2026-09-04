const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const competencyRoutes = require("./modules/settings/competencies/competency.routes");
const pathwayTemplateRoutes = require("./modules/settings/pathways/pathway-template.routes");
const systemLevelRoutes = require("./modules/settings/system-levels/system-level.routes");
const inventoryRoutes = require("./modules/settings/inventory/inventory.routes");
const itemsRoutes = require("./modules/settings/items/items.routes");
const learningHubRoutes = require("./modules/learning-hubs/learning-hub.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const classRoutes = require("./modules/classes/class.routes");
const classGroupRoutes = require("./modules/classes/groups/class-group.routes");
const roomRoutes = require("./modules/rooms/room.routes");
const learnerRoutes = require("./modules/learners/learner.routes");
const publicLearnerProfileRoutes = require("./modules/learners/public-profile.routes");
const courseRoutes = require("./modules/courses/course.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const timetableRoutes = require("./modules/timetable/timetable.routes");
const assessmentRoutes = require("./modules/assessments/assessment.routes");
const assessmentSubmissionRoutes = require("./modules/assessments/submissions/assessment-submission.routes");
const reportRoutes = require("./modules/reports/report.routes");
const uploadRoutes = require("./modules/uploads/upload.routes");
const programRoutes = require("./modules/programs/program.routes");
const notificationRoutes = require("./modules/notifications/notification.routes");
const billingRoutes = require("./modules/billing/billing.routes");
const publicLeadRoutes = require("./modules/leads/public-lead.routes");
const leadRoutes = require("./modules/leads/lead.routes");
const publicSiteRoutes = require("./modules/public-site/public-site.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");
const { protect: protectBase, authorize, blockIfSuspended } = require("./shared/middleware/auth.middleware");
const { attachOwnRecords } = require("./shared/middleware/scope.middleware");

// Every authenticated route already mounts `protect`; pairing it here with `blockIfSuspended`
// means a suspended account keeps a read-only session everywhere but is refused every write in
// one place, without touching each route file. `protect` is exported as `protectBase` and
// re-exposed as this array so the existing `protect, ...` mount calls below need no change.
const protect = [protectBase, blockIfSuspended];

const app = express();

app.use(
  helmet({
    // This is a JSON API — the only HTML-adjacent response is the "/" health check, which
    // returns JSON too, so there's no page for a CSP to protect and the default policy only
    // risks conflicting with the client's own. Static /uploads files (photos, assessment
    // media) are fetched cross-origin by the client's <img>/<video> tags, so the default
    // same-origin resource policy would silently block them from loading.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
// The admin client (CLIENT_URL) sends cookies and needs credentials: true. The public
// digifunzi-landing site (PUBLIC_SITE_URL) never sends a JWT/cookie (see its src/services/api.js)
// and only ever reaches the /api/public/* routes below, but still needs its origin allowed or the
// browser blocks the request before it reaches Express at all.
//
// PUBLIC_SITE_URL is comma-separated: the landing site is served from more than one origin
// (apex + www + staging) and its build-time prerender step runs from yet another origin
// (http://localhost:4199) — see Guide/WEBSITE_INTEGRATION_CONTRACT.md §5. A request with no
// Origin header at all (server-to-server curl, same-origin) is always allowed.
const allowedOrigins = [
  env.CLIENT_URL,
  ...String(env.PUBLIC_SITE_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
].filter(Boolean);
app.use(cors({
  // A disallowed origin gets `false` (no CORS headers set → the browser blocks it), not a
  // thrown Error — throwing would surface as a confusing 500 in our logs for what is really
  // just an un-whitelisted caller. A request with no Origin header (server-to-server curl,
  // the prerender step in some modes) is always allowed.
  origin(origin, cb) {
    cb(null, !origin || allowedOrigins.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

// General abuse/runaway-loop backstop for everything under /api — login already has its own
// stricter limiter layered on top of this one. Deliberately generous (same reasoning as
// loginLimiter in auth.routes.js: a school/office network puts many real concurrent users
// behind one shared IP, and this app's own polling — notifications every 60s, a teacher's
// per-class dashboard queries — can legitimately add up to a lot of requests from one IP over
// 15 minutes). This isn't meant to shape normal traffic, just cap the pathological case (a
// broken client retry loop, a scraper) before it can degrade the shared connection pool for
// everyone else.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
// Unauthenticated by design — the "share via QR" destination for a learner's public profile
// link. Deliberately its own router (not a route inside learnerRoutes) so it can never end up
// behind the `protect` chain every other /api/learners route is mounted with below. Read-only,
// and scoped by learner.service.js's getPublicProfile to a hand-picked, deliberately narrow
// field set — see that function's comment for exactly what it excludes.
app.use("/api/public/learners", publicLearnerProfileRoutes);
// Unauthenticated by design — the digifunzi-landing site's Enroll/Contact forms (see
// public-lead.routes.js). Mounted at /api/public rather than /api/public/leads since it
// serves both /api/public/leads and /api/public/contact.
app.use("/api/public", publicLeadRoutes);
// Unauthenticated by design — the digifunzi-landing site's Pathways listing and detail pages
// (see public-site.routes.js).
app.use("/api/public", publicSiteRoutes);

// Everything below requires a logged-in session. Curriculum authoring, settings, assessments
// (builder) and uploads are admin-only in full; curriculum.routes.js carves out the two
// non-admin reads a school inherits (its curriculum, and that curriculum's current courses)
// before the router-wide admin gate — attachOwnRecords is mounted here too so those routes can
// verify the requested curriculum is actually the caller's own. Learning hubs/teachers/classes/
// learners are read (and, for "school"-type hubs, written) by more than one role, so their
// own routes files apply per-method role checks plus attachOwnRecords-based ownership scoping —
// a school/teacher/learner account can only ever touch its own school's data, never another's.
app.use("/api/curricula", protect, attachOwnRecords, curriculumRoutes);
app.use("/api/competencies", protect, authorize("admin"), competencyRoutes);
app.use("/api/pathway-templates", protect, authorize("admin"), pathwayTemplateRoutes);
app.use("/api/system-levels", protect, authorize("admin"), systemLevelRoutes);
app.use("/api/inventory", protect, authorize("admin"), inventoryRoutes);
app.use("/api/items", protect, authorize("admin"), itemsRoutes);
app.use("/api/learning-hubs", protect, attachOwnRecords, learningHubRoutes);
app.use("/api/teachers", protect, attachOwnRecords, teacherRoutes);
app.use("/api/classes", protect, attachOwnRecords, classRoutes);
// Reusable class-level learner groups, for group-based assessments — see class-group.routes.js.
app.use("/api/class-groups", protect, attachOwnRecords, classGroupRoutes);
app.use("/api/rooms", protect, attachOwnRecords, roomRoutes);
app.use("/api/learners", protect, attachOwnRecords, learnerRoutes);
app.use("/api/courses", protect, attachOwnRecords, courseRoutes);
app.use("/api/attendance", protect, attachOwnRecords, attendanceRoutes);
// Same shape as attendance — a timetable slot belongs to a Class, ownership resolved through it.
app.use("/api/timetable", protect, attachOwnRecords, timetableRoutes);
// Authoring stays admin-only, but one read (an assessment's linked competencies) is needed by
// teacher/school too, when grading — see assessment.routes.js for the per-route split.
app.use("/api/assessments", protect, assessmentRoutes);
// Issuing/taking/grading is not authoring — teacher/school/learner reach it here, scoped by
// attachOwnRecords, while the assessment *builder* above stays admin-only.
app.use("/api/assessment-submissions", protect, attachOwnRecords, assessmentSubmissionRoutes);
// Course reports read off graded submissions above — same not-authoring, multi-role,
// attachOwnRecords-scoped shape.
app.use("/api/reports", protect, attachOwnRecords, reportRoutes);
// Learner access is scoped to assessment-submission file uploads (documentUpload/imageUpload/
// videoUpload/audioUpload/codeUpload items and project deliverables) — see AssessmentTaker.jsx.
// teacher/school need this too, for their own profile-photo uploads (teacher-portal/
// school-portal profile pages, and the admin-side Teacher/LearningHub forms).
app.use("/api/uploads", protect, authorize("admin", "teacher", "school", "learner"), uploadRoutes);
app.use("/api/programs", protect, authorize("admin"), programRoutes);
// Scoped entirely by req.user.id (see notification.routes.js) — every role shares this one
// router, no attachOwnRecords/authorize needed.
app.use("/api/notifications", protect, notificationRoutes);
app.use("/api/billing", protect, attachOwnRecords, billingRoutes);
// Enquiries page — the staff-facing read/triage side of the public leads above.
app.use("/api/leads", protect, authorize("admin"), leadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;