import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { attendanceApi } from "../services/attendanceApi";

export const ATTENDANCE_KEYS = {
  all:     ["attendance"],
  byDate:  (classId, date) => ["attendance", "byDate", classId, date],
  history: (classId, dateFrom, dateTo) => ["attendance", "history", classId, dateFrom, dateTo],
};

export function useAttendanceByDateQuery(classId, date) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.byDate(classId, date),
    queryFn:  () => attendanceApi.getByClassDate(classId, date),
    enabled:  !!classId && !!date,
  });
}

export function useAttendanceHistoryQuery(classId, dateFrom, dateTo) {
  return useQuery({
    queryKey: ATTENDANCE_KEYS.history(classId, dateFrom, dateTo),
    queryFn:  () => attendanceApi.getHistory({ classId, dateFrom, dateTo }),
    enabled:  !!classId && !!dateFrom && !!dateTo,
  });
}

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: attendanceApi.mark,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ATTENDANCE_KEYS.all });
      toast.success(`Attendance saved for ${variables.date}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to save attendance"),
  });
}
