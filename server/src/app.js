const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const authRoutes = require("./modules/auth/auth.routes");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const competencyRoutes = require("./modules/settings/competencies/competency.routes");
const learningAreaRoutes = require("./modules/settings/learning-areas/learning-area.routes");
const systemLevelRoutes = require("./modules/settings/system-levels/system-level.routes");
const inventoryRoutes = require("./modules/settings/inventory/inventory.routes");
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
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");
const { protect, authorize } = require("./shared/middleware/auth.middleware");
const { attachOwnRecords } = require("./shared/middleware/scope.middleware");

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
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/auth", authRoutes);
// Unauthenticated by design — the "share via QR" destination for a learner's public profile
// link. Deliberately its own router (not a route inside learnerRoutes) so it can never end up
// behind the `protect` chain every other /api/learners route is mounted with below. Read-only,
// and scoped by learner.service.js's getPublicProfile to a hand-picked, deliberately narrow
// field set — see that function's comment for exactly what it excludes.
app.use("/api/public/learners", publicLearnerProfileRoutes);

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
app.use("/api/learning-areas", protect, authorize("admin"), learningAreaRoutes);
app.use("/api/system-levels", protect, authorize("admin"), systemLevelRoutes);
app.use("/api/inventory", protect, authorize("admin"), inventoryRoutes);
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;