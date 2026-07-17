const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./modules/auth/auth.routes");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const competencyRoutes = require("./modules/settings/competencies/competency.routes");
const learningAreaRoutes = require("./modules/settings/learning-areas/learning-area.routes");
const inventoryRoutes = require("./modules/settings/inventory/inventory.routes");
const locationRoutes = require("./modules/locations/location.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const classRoutes = require("./modules/classes/class.routes");
const learnerRoutes = require("./modules/learners/learner.routes");
const courseRoutes = require("./modules/courses/course.routes");
const attendanceRoutes = require("./modules/attendance/attendance.routes");
const assessmentRoutes = require("./modules/assessments/assessment.routes");
const uploadRoutes = require("./modules/uploads/upload.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");
const { protect, authorize } = require("./shared/middleware/auth.middleware");
const { attachOwnRecords } = require("./shared/middleware/scope.middleware");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
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

// Everything below requires a logged-in session. Curriculum authoring, settings, assessments
// (builder) and uploads are admin-only in full; curriculum.routes.js carves out the two
// non-admin reads a school inherits (its curriculum, and that curriculum's current courses)
// before the router-wide admin gate — attachOwnRecords is mounted here too so those routes can
// verify the requested curriculum is actually the caller's own. Locations/teachers/classes/
// learners are read (and, for "school"-type locations, written) by more than one role, so their
// own routes files apply per-method role checks plus attachOwnRecords-based ownership scoping —
// a school/teacher/learner account can only ever touch its own school's data, never another's.
app.use("/api/curricula", protect, attachOwnRecords, curriculumRoutes);
app.use("/api/competencies", protect, authorize("admin"), competencyRoutes);
app.use("/api/learning-areas", protect, authorize("admin"), learningAreaRoutes);
app.use("/api/inventory", protect, authorize("admin"), inventoryRoutes);
app.use("/api/locations", protect, attachOwnRecords, locationRoutes);
app.use("/api/teachers", protect, attachOwnRecords, teacherRoutes);
app.use("/api/classes", protect, attachOwnRecords, classRoutes);
app.use("/api/learners", protect, attachOwnRecords, learnerRoutes);
app.use("/api/courses", protect, courseRoutes);
app.use("/api/attendance", protect, attachOwnRecords, attendanceRoutes);
app.use("/api/assessments", protect, authorize("admin"), assessmentRoutes);
app.use("/api/uploads", protect, authorize("admin"), uploadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;