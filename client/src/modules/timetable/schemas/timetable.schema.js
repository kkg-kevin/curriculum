// Mirrors server/src/modules/timetable/timetable.validation.js's DAYS_OF_WEEK.
export const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday"];
export const DAY_LABELS = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
  saturday: "Saturday", sunday: "Sunday",
};
// An educator's availability also takes weekends (families book mentor sessions then); class
// timetables stay Monday–Friday. Mirrors the server's AVAILABILITY_DAYS.
export const AVAILABILITY_DAYS = [...DAYS_OF_WEEK, "saturday", "sunday"];
