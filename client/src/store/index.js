import { configureStore } from "@reduxjs/toolkit";
import curriculumReducer from "./curriculumSlice";
import learningHubsReducer from "./learningHubsSlice";
import teachersReducer from "./teachersSlice";
import classesReducer from "./classesSlice";
import learnersReducer from "./learnersSlice";

export const store = configureStore({
  reducer: {
    curriculum:   curriculumReducer,
    learningHubs: learningHubsReducer,
    teachers:     teachersReducer,
    classes:      classesReducer,
    learners:     learnersReducer,
  },
});
