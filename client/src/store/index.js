import { configureStore } from "@reduxjs/toolkit";
import curriculumReducer from "./curriculumSlice";
import schoolsReducer from "./schoolsSlice";
import teachersReducer from "./teachersSlice";
import classesReducer from "./classesSlice";
import learnersReducer from "./learnersSlice";

export const store = configureStore({
  reducer: {
    curriculum: curriculumReducer,
    schools:    schoolsReducer,
    teachers:   teachersReducer,
    classes:    classesReducer,
    learners:   learnersReducer,
  },
});
