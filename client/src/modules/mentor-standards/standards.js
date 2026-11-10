import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiCalendar, FiCheckSquare, FiEdit3, FiMessageCircle, FiShield, FiStar, FiTarget, FiTrendingUp, FiUserCheck, FiUsers } from "react-icons/fi";
import api from "../../services/api";

// Each standard's own icon, wherever it's listed.
export const STANDARD_ICON = {
  retention: FiUserCheck,
  rating: FiStar,
  qa: FiShield,
  reliability: FiCalendar,
  markedOnTime: FiEdit3,
  attendanceOnDay: FiCheckSquare,
  learnerAttendance: FiUsers,
  onTrack: FiTrendingUp,
  mentorCheckins: FiMessageCircle,
  openConcerns: FiAlertTriangle,
};
export const iconOf = (key) => STANDARD_ICON[key] || FiTarget;

// Mentor standards (server: modules/mentor-standards/) — the bar every mentor is measured against,
// set in Settings → Mentor standards; each mentor's standing comes with their profile and with
// Reports & Analytics → Educators. Status keys match mentor-standards.rules.js's evaluate().

export const STATUS = {
  meets: { label: "Meets", tone: "good" },
  close: { label: "Close", tone: "waiting" },
  below: { label: "Below", tone: "danger" },
  grace: { label: "New, settling in", tone: "info" },
  not_enough: { label: "Not enough data yet", tone: "neutral" },
};

export const OVERALL = {
  meets: { label: "Meets every standard", tone: "good" },
  close: { label: "Close on some standards", tone: "waiting" },
  below: { label: "Below a standard", tone: "danger" },
  not_enough: { label: "Not enough data yet", tone: "neutral" },
};

// A value with its unit: "82%", "4.3★", "2".
export function formatValue(value, unit) {
  if (value == null) return "—";
  const n = Number(value);
  const shown = unit === "★" ? n.toFixed(1) : Number.isInteger(n) ? String(n) : n.toFixed(1);
  return unit === "★" ? `${shown}★` : `${shown}${unit || ""}`;
}

// "80% or more" / "4.0★ or more" / "0 or fewer".
export const targetText = (item) => `${formatValue(item.target, item.unit)} ${item.higherIsBetter === false ? "or fewer" : "or more"}`;

const data = (r) => r.data.data;
export const mentorStandardsApi = {
  settings: () => api.get("/api/mentor-standards/settings").then(data),
  save: (body) => api.put("/api/mentor-standards/settings", body).then(data),
};

const KEY = ["mentor-standards", "settings"];
export const useMentorStandardSettings = () => useQuery({ queryKey: KEY, queryFn: mentorStandardsApi.settings });
export function useSaveMentorStandards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: mentorStandardsApi.save,
    onSuccess: (result) => {
      qc.setQueryData(KEY, result);
      // Every profile and the Educators tab read the standards — they recount with the new bar.
      qc.invalidateQueries({ queryKey: ["educator-profile"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      toast.success("Mentor standards saved");
    },
    onError: (err) => toast.error(err?.errors?.[0]?.message || err?.message || "The standards couldn't be saved"),
  });
}
