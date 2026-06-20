import { createSlice } from "@reduxjs/toolkit";

const teachersSlice = createSlice({
  name: "teachers",
  initialState: {
    filters: {
      schoolId: "",
      status:   "",
    },
  },
  reducers: {
    setTeacherFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearTeacherFilters(state) {
      state.filters = { schoolId: "", status: "" };
    },
  },
});

export const { setTeacherFilter, clearTeacherFilters } = teachersSlice.actions;
export default teachersSlice.reducer;
