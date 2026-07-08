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
const schoolRoutes = require("./modules/schools/school.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const classRoutes = require("./modules/classes/class.routes");
const learnerRoutes = require("./modules/learners/learner.routes");
const courseRoutes = require("./modules/courses/course.routes");
const assessmentRoutes = require("./modules/assessments/assessment.routes");
const uploadRoutes = require("./modules/uploads/upload.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");
const { protect } = require("./shared/middleware/auth.middleware");

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

// Everything below requires a logged-in session. Only the "admin" role exists today (it can
// see all of this); teacher/learner accounts will get their own scoped middleware per-route
// once those roles are actually issued.
app.use("/api/curricula", protect, curriculumRoutes);
app.use("/api/competencies", protect, competencyRoutes);
app.use("/api/learning-areas", protect, learningAreaRoutes);
app.use("/api/inventory", protect, inventoryRoutes);
app.use("/api/schools", protect, schoolRoutes);
app.use("/api/teachers", protect, teacherRoutes);
app.use("/api/classes", protect, classRoutes);
app.use("/api/learners", protect, learnerRoutes);
app.use("/api/courses", protect, courseRoutes);
app.use("/api/assessments", protect, assessmentRoutes);
app.use("/api/uploads", protect, uploadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;