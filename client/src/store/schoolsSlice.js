import { createSlice } from "@reduxjs/toolkit";

const schoolsSlice = createSlice({
  name: "schools",
  initialState: {
    filters: {
      status: "",
      county: "",
    },
  },
  reducers: {
    setSchoolFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearSchoolFilters(state) {
      state.filters = { status: "", county: "" };
    },
  },
});

export const { setSchoolFilter, clearSchoolFilters } = schoolsSlice.actions;
export default schoolsSlice.reducer;
