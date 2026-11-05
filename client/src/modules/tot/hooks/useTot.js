import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { totApi } from "../services/totApi";

const KEY = ["tot"];

export const useMyTraining = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "me"], queryFn: totApi.me, staleTime: 60 * 1000, enabled });
export const useEducatorTraining = (teacherId, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "educator", teacherId], queryFn: () => totApi.educator(teacherId), enabled: enabled && !!teacherId });
export const useTotLearners = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "learners"], queryFn: totApi.learners, enabled });
export const useTotClasses =({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "classes"], queryFn: totApi.classes, enabled });
export const useTotMarking = (params = {}, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "marking", params], queryFn: () => totApi.marking(params), enabled, refetchInterval: 60 * 1000 });

export function useEnrolInTot(teacherId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => totApi.enrol(teacherId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Enrolled in TOT"); },
    onError: (err) => toast.error(err?.errors?.[0]?.message || err.message || "Couldn't enrol"),
  });
}

export function usePublishTotCourseReport(teacherId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => totApi.publishCourseReport(teacherId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Report published — certificate issued"); },
    onError: (err) => toast.error(err?.errors?.[0]?.message || err.message || "Couldn't publish the report"),
  });
}

export function useWithdrawFromTot(teacherId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => totApi.withdraw(teacherId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Withdrawn from training"); },
    onError: (err) => toast.error(err?.errors?.[0]?.message || err.message || "Couldn't withdraw"),
  });
}
