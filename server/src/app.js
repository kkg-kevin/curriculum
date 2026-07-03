const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const competencyRoutes = require("./modules/competencies/competency.routes");
const schoolRoutes = require("./modules/schools/school.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const classRoutes = require("./modules/classes/class.routes");
const learnerRoutes = require("./modules/learners/learner.routes");
const courseRoutes = require("./modules/courses/course.routes");
const assessmentRoutes = require("./modules/assessments/assessment.routes");
const uploadRoutes = require("./modules/uploads/upload.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/curricula", curriculumRoutes);
app.use("/api/competencies", competencyRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/learners", learnerRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/uploads", uploadRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;