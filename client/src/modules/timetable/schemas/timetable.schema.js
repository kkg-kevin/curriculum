// Mirrors server/src/modules/timetable/timetable.validation.js's DAYS_OF_WEEK.
export const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const DAY_LABELS = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
  saturday: "Saturday", sunday: "Sunday",
};
// Classes and educators' availability both run any day of the week (23 Nov 2026).
export const AVAILABILITY_DAYS = DAYS_OF_WEEK;
