import { createSlice } from "@reduxjs/toolkit";

const classesSlice = createSlice({
  name: "classes",
  initialState: {
    filters: { schoolId: "", status: "" },
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
      state.filters = { schoolId: "", status: "" };
      state.search = "";
    },
  },
});

export const { setFilter, setSearch, resetFilters } = classesSlice.actions;
export default classesSlice.reducer;
