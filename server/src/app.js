const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const schoolRoutes = require("./modules/schools/school.routes");
const teacherRoutes = require("./modules/teachers/teacher.routes");
const classRoutes = require("./modules/classes/class.routes");
const learnerRoutes = require("./modules/learners/learner.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/curricula", curriculumRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/learners", learnerRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;