import { createSlice } from "@reduxjs/toolkit";

const curriculumSlice = createSlice({
  name: "curriculum",
  initialState: {
    filters: {
      framework: "",
      academicYear: "",
    },
    sortBy: "createdAt",
  },
  reducers: {
    setFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters(state) {
      state.filters = { framework: "", academicYear: "" };
    },
    setSortBy(state, action) {
      state.sortBy = action.payload;
    },
  },
});

export const { setFilter, clearFilters, setSortBy } = curriculumSlice.actions;
export default curriculumSlice.reducer;
