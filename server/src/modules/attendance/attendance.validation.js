const { z } = require("zod");

const ATTENDANCE_STATUSES = ["present", "absent", "late", "excused"];

const attendanceRecordSchema = z.object({
  learnerId: z.string().min(1, "Learner is required"),
  status: z.enum(ATTENDANCE_STATUSES, { errorMap: () => ({ message: "Select a valid status" }) }),
  notes: z.string().max(300).default(""),
});

const markAttendanceSchema = z.object({
  classId: z.string().min(1, "Class is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  records: z.array(attendanceRecordSchema).min(1, "At least one attendance record is required"),
});

module.exports = { markAttendanceSchema, ATTENDANCE_STATUSES };
