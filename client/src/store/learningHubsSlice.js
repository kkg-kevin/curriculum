import { createSlice } from "@reduxjs/toolkit";

const learningHubsSlice = createSlice({
  name: "learningHubs",
  initialState: {
    filters: {
      status: "",
      county: "",
    },
  },
  reducers: {
    setLearningHubFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearLearningHubFilters(state) {
      state.filters = { status: "", county: "" };
    },
  },
});

export const { setLearningHubFilter, clearLearningHubFilters } = learningHubsSlice.actions;
export default learningHubsSlice.reducer;
