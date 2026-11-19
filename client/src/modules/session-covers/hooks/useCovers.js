import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { coverApi } from "../services/coverApi";

const errorText = (err, fallback) => err.response?.data?.message || err.message || fallback;

// A cover changes calendars (both educators', the class's, the hub's) — refresh them all.
function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["covers"] });
    qc.invalidateQueries({ queryKey: ["timetable"] });
  };
}

export function useCoverCandidates(ref, enabled = true) {
  return useQuery({
    queryKey: ["covers", "candidates", ref?.classId, ref?.courseId, ref?.sessionId, ref?.date],
    queryFn: () => coverApi.candidates(ref),
    enabled: enabled && !!ref?.classId && !!ref?.sessionId && !!ref?.date,
  });
}

export function useMyCovers() {
  return useQuery({ queryKey: ["covers", "mine"], queryFn: coverApi.mine });
}

export function useCoversOverview() {
  return useQuery({ queryKey: ["covers", "overview"], queryFn: coverApi.overview });
}

export function useCoverPage(id) {
  return useQuery({ queryKey: ["covers", "page", id], queryFn: () => coverApi.page(id), enabled: !!id });
}

export function useRequestCover() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: coverApi.request,
    onSuccess: (cover) => { refresh(); toast.success(`${cover.coverTeacherName} has been asked — you'll hear when they answer`); },
    onError: (err) => toast.error(errorText(err, "Couldn't ask for cover")),
  });
}

export function useRespondCover() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, decision, reason }) => coverApi.respond(id, { decision, reason }),
    onSuccess: (cover) => { refresh(); toast.success(cover.status === "accepted" ? "Accepted — it's on your timetable" : "Declined"); },
    onError: (err) => toast.error(errorText(err, "Couldn't answer")),
  });
}

export function useCancelCover() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, reason }) => coverApi.cancel(id, reason),
    onSuccess: (cover) => { refresh(); toast.success(cover.status === "withdrawn" ? "You've pulled out — they've been told" : "Cover cancelled"); },
    onError: (err) => toast.error(errorText(err, "Couldn't cancel the cover")),
  });
}

export function useCoverAttendance(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records) => coverApi.attendance(id, records),
    onSuccess: (page) => { qc.setQueryData(["covers", "page", id], page); toast.success("Attendance saved"); },
    onError: (err) => toast.error(errorText(err, "Couldn't save attendance")),
  });
}

export function useCoverTaught(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => coverApi.taught(id),
    onSuccess: (page) => { qc.setQueryData(["covers", "page", id], page); qc.invalidateQueries({ queryKey: ["covers", "earnings"] }); toast.success("Marked as taught"); },
    onError: (err) => toast.error(errorText(err, "Couldn't mark it taught")),
  });
}

export function useCoverEarnings() {
  return useQuery({ queryKey: ["covers", "earnings"], queryFn: coverApi.earnings });
}

export function useClaimCoverEarnings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: coverApi.claimEarnings,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["covers"] }); qc.invalidateQueries({ queryKey: ["claims"] }); toast.success("Claim sent"); },
    onError: (err) => toast.error(errorText(err, "Couldn't send the claim")),
  });
}
