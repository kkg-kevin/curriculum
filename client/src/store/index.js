import { configureStore } from "@reduxjs/toolkit";
import curriculumReducer from "./curriculumSlice";
import locationsReducer from "./locationsSlice";
import teachersReducer from "./teachersSlice";
import classesReducer from "./classesSlice";
import learnersReducer from "./learnersSlice";

export const store = configureStore({
  reducer: {
    curriculum: curriculumReducer,
    locations:  locationsReducer,
    teachers:   teachersReducer,
    classes:    classesReducer,
    learners:   learnersReducer,
  },
});
