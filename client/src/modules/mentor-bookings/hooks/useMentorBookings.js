import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { mentorBookingsApi as A } from "../services/mentorBookingsApi";

// One cache for the feature — a booking, a payment or a settlement moves several lists at once,
// so each change refreshes all of it (and the invoices / claims it touches).
export const KEY = ["mentor-bookings"];
export const errorText = (err) => err?.errors?.[0]?.message || err?.response?.data?.message || err?.message || "Something went wrong";

export const useBookingSettings = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "settings"], queryFn: A.settings, enabled });
export const useBookingOptions = (learnerId, teacherId) => useQuery({ queryKey: [...KEY, "options", learnerId, teacherId], queryFn: () => A.options({ learnerId, teacherId }), enabled: !!learnerId && !!teacherId, retry: false });
export const useFreeTimes = (params, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "free-times", params], queryFn: () => A.freeTimes(params), enabled: enabled && !!params.learnerId && !!params.teacherId && !!params.minutes, staleTime: 0, retry: false });
export const useBookings = (params = {}, { enabled = true } = {}) => useQuery({ queryKey: [...KEY, "list", params], queryFn: () => A.list(params), placeholderData: keepPreviousData, enabled });
export const useBooking = (id) => useQuery({ queryKey: [...KEY, "one", id], queryFn: () => A.get(id), enabled: !!id });
export const useHelpRequests = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "help"], queryFn: A.help, enabled });
export const usePartnerHubs = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "hubs"], queryFn: A.hubs, enabled });
export const useHubStatement = (hubId) => useQuery({ queryKey: [...KEY, "statement", hubId], queryFn: () => A.statement(hubId), enabled: !!hubId });
export const useBookingEarnings = ({ enabled = true } = {}) => useQuery({ queryKey: [...KEY, "earnings"], queryFn: A.earnings, enabled });

export function useBookingMutation(mutationFn, success) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.invalidateQueries({ queryKey: ["claims"] });
      const message = typeof success === "function" ? success(result, variables) : success;
      if (message) toast.success(message);
    },
    onError: (err) => toast.error(errorText(err)),
  });
}

export const useSaveBookingSettings = () => useBookingMutation(A.saveSettings, "Mentor booking rules saved");
export const useBook = () => useBookingMutation(A.book, null);
export const useCancelBooking = () => useBookingMutation(({ id, ...body }) => A.cancel(id, body), "Booking cancelled");
export const useMarkBooking = () => useBookingMutation(({ id, ...body }) => A.mark(id, body), (r) => (r.status === "no_show" ? "Marked: didn't join" : "Marked as held — the family can read your note"));
export const useSetBookingLink = () => useBookingMutation(({ id, meetingLink }) => A.setLink(id, meetingLink), "Join link saved");
export const useMarkRefunded = () => useBookingMutation(({ id, ...body }) => A.refunded(id, body), "Marked refunded");
export const useAskForHelp = () => useBookingMutation(A.askForHelp, null);
export const useCloseHelp = () => useBookingMutation(A.closeHelp, "Request closed");
export const useSettleHub = () => useBookingMutation(({ hubId, ...body }) => A.settle(hubId, body), "Settlement recorded");
export const useClaimEarnings = () => useBookingMutation(A.claimEarnings, "Claim sent");
