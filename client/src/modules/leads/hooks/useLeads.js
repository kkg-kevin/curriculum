import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { leadApi } from "../services/leadApi";

export const LEAD_KEYS = {
  all: ["leads"],
  list: (filters) => ["leads", "list", filters],
  timeline: (id) => ["leads", "timeline", id],
};

export function useLeadsQuery(filters = {}) {
  return useQuery({
    queryKey: LEAD_KEYS.list(filters),
    queryFn: () => leadApi.getAll(filters),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => leadApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEAD_KEYS.all });
      toast.success("Updated");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to update"),
  });
}

// Enabled only while a card's thread is actually expanded — see EnquiriesListPage's LeadRow.
export function useLeadTimeline(id, enabled) {
  return useQuery({
    queryKey: LEAD_KEYS.timeline(id),
    queryFn: () => leadApi.getTimeline(id),
    enabled: !!id && enabled,
  });
}

export function useReplyToLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subject, body }) => leadApi.reply(id, { subject, body }),
    onSuccess: (result, { id }) => {
      qc.invalidateQueries({ queryKey: LEAD_KEYS.timeline(id) });
      qc.invalidateQueries({ queryKey: LEAD_KEYS.all });
      toast.success(result.emailSent ? "Reply sent" : "Reply saved (email not sent — no mail server configured)");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to send reply"),
  });
}

export function useAddLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => leadApi.addNote(id, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: LEAD_KEYS.timeline(id) });
      toast.success("Note added");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to add note"),
  });
}
