import { configureStore } from "@reduxjs/toolkit";
import curriculumReducer from "./curriculumSlice";

export const store = configureStore({
  reducer: {
    curriculum: curriculumReducer,
  },
});
