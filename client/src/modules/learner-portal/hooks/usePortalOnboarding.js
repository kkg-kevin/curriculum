import { useMutation, useQueryClient } from "@tanstack/react-query";
import { learnerApi } from "../../learners/services/learnerApi";
import { LEARNER_KEYS } from "../../learners/hooks/useLearners";

// Fired once by FirstLoginDiagnosticGate before it reads a learner's outstanding Learning-Area
// diagnostics — catches any enrollment whose auto-issuance was missed or incomplete. Silent
// (no toast): this runs automatically in the background, not from a user action.
export function useEnsureDiagnosticsIssued() {
  return useMutation({
    mutationFn: ({ learnerId, hubId }) => learnerApi.ensureDiagnosticsIssued(learnerId, hubId),
  });
}

// Marks the gate cleared for good — either every outstanding diagnostic got submitted, or there
// was nothing to show in the first place. Also silent, for the same reason as above; a visible
// "Learner updated successfully!" toast (useUpdateLearner's default) would be a confusing thing
// to see mid-onboarding.
export function useMarkPortalOnboardingComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (learnerId) => learnerApi.update(learnerId, { portalOnboardingCompletedAt: new Date().toISOString() }),
    onSuccess: (data) => {
      if (!data?.id) return;
      qc.setQueryData(LEARNER_KEYS.detail(data.id), data);
      // useLearnerPortalScope's gateActive check reads learners via
      // ["learners", "byGuardianEmail", email] and computes gateActive off whatever's in that
      // cache *right now* — invalidateQueries alone only schedules a background refetch, which
      // leaves a window where this mutation has already resolved (so the gate stops rendering
      // its own content) but the layout's copy of the learner still shows
      // portalOnboardingCompletedAt unset, rendering neither the gate nor the real portal until
      // that refetch happens to land. Patching the cache directly with the already-known result
      // closes that window instead of hoping the refetch is fast.
      qc.setQueriesData({ queryKey: ["learners", "byGuardianEmail"] }, (old) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((l) => (l.id === data.id ? { ...l, portalOnboardingCompletedAt: data.portalOnboardingCompletedAt } : l)) };
      });
    },
  });
}
