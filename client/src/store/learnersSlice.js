import { createSlice } from "@reduxjs/toolkit";

const learnersSlice = createSlice({
  name: "learners",
  initialState: {
    filters: { schoolId: "", classId: "", status: "" },
    search: "",
  },
  reducers: {
    setFilter(state, { payload: { key, value } }) {
      state.filters[key] = value;
    },
    setSearch(state, { payload }) {
      state.search = payload;
    },
    resetFilters(state) {
      state.filters = { schoolId: "", classId: "", status: "" };
      state.search = "";
    },
  },
});

export const { setFilter, setSearch, resetFilters } = learnersSlice.actions;
export default learnersSlice.reducer;
