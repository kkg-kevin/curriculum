import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { classGroupApi } from "../services/classGroupApi";

export const CLASS_GROUP_KEYS = {
  byClass: (classId) => ["class-groups", "byClass", classId],
  forLearner: (classId, learnerId) => ["class-groups", "byClass", classId, "learner", learnerId],
};

export function useClassGroups(classId) {
  return useQuery({
    queryKey: CLASS_GROUP_KEYS.byClass(classId),
    queryFn: () => classGroupApi.getAll(classId),
    enabled: !!classId,
  });
}

// A learner's own group within one class — used by the learner-portal "your group" panel and,
// for staff, anywhere a single learner's placement needs a quick lookup outside the full list.
export function useGroupForLearner(classId, learnerId) {
  return useQuery({
    queryKey: CLASS_GROUP_KEYS.forLearner(classId, learnerId),
    queryFn: () => classGroupApi.getForLearner(classId, learnerId),
    enabled: !!classId && !!learnerId,
  });
}

export function useCreateClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, name }) => classGroupApi.create(classId, name),
    onSuccess: (_data, { classId }) => {
      qc.invalidateQueries({ queryKey: CLASS_GROUP_KEYS.byClass(classId) });
      toast.success("Group created");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to create group"),
  });
}

export function useRenameClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, classId }) => classGroupApi.rename(id, name).then((group) => ({ group, classId })),
    onSuccess: ({ classId }) => {
      qc.invalidateQueries({ queryKey: CLASS_GROUP_KEYS.byClass(classId) });
      toast.success("Group renamed");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to rename group"),
  });
}

export function useDeleteClassGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => classGroupApi.remove(id),
    onSuccess: (_data, { classId }) => {
      qc.invalidateQueries({ queryKey: CLASS_GROUP_KEYS.byClass(classId) });
      toast.success("Group deleted");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to delete group"),
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, learnerId }) => classGroupApi.addMember(groupId, learnerId),
    onSuccess: (_data, { classId }) => {
      qc.invalidateQueries({ queryKey: CLASS_GROUP_KEYS.byClass(classId) });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to add learner to group"),
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, learnerId }) => classGroupApi.removeMember(groupId, learnerId),
    onSuccess: (_data, { classId }) => {
      qc.invalidateQueries({ queryKey: CLASS_GROUP_KEYS.byClass(classId) });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove learner from group"),
  });
}
