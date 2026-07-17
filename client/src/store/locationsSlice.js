import { createSlice } from "@reduxjs/toolkit";

const locationsSlice = createSlice({
  name: "locations",
  initialState: {
    filters: {
      status: "",
      county: "",
    },
  },
  reducers: {
    setLocationFilter(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearLocationFilters(state) {
      state.filters = { status: "", county: "" };
    },
  },
});

export const { setLocationFilter, clearLocationFilters } = locationsSlice.actions;
export default locationsSlice.reducer;
