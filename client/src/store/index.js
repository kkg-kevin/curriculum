import { configureStore } from "@reduxjs/toolkit";
import curriculumReducer from "./curriculumSlice";
import schoolsReducer from "./schoolsSlice";
import teachersReducer from "./teachersSlice";

export const store = configureStore({
  reducer: {
    curriculum: curriculumReducer,
    schools:    schoolsReducer,
    teachers:   teachersReducer,
  },
});
