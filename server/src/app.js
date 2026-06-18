const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const curriculumRoutes = require("./modules/curriculum/curriculum.routes");
const { errorHandler, notFound } = require("./shared/middleware/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/curricula", curriculumRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;