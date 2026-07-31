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

// Marks the gate cleared for good, for this one hub — either every outstanding diagnostic got
// submitted, or there was nothing to show in the first place. Scoped to the hub (not the
// learner record) so a learner enrolled at several hubs still gets gated again on a hub they
// haven't cleared yet, even after clearing another one. Silent, for the same reason as
// ensureDiagnosticsIssued above; a visible toast would be a confusing thing to see
// mid-onboarding.
export function useMarkHubOnboardingComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ learnerId, hubId }) => learnerApi.completeHubOnboarding(learnerId, hubId),
    onSuccess: (_data, { learnerId, hubId }) => {
      // useLearnerPortalScope's gateActive check reads the hub list off this exact cache entry
      // and computes gateActive from whatever's in it *right now* — invalidateQueries alone
      // only schedules a background refetch, which leaves a window where this mutation has
      // already resolved (so the gate stops rendering its own content) but the layout's copy
      // of the hub still shows onboardingCompletedAt unset, rendering neither the gate nor the
      // real portal until that refetch happens to land. Patching the cache directly with the
      // already-known result closes that window instead of hoping the refetch is fast.
      // learnerApi.getHubs already unwraps the response to a plain array (`r.data.data`), so the
      // cached value here IS that array — not an envelope with its own `.data` — map it directly.
      qc.setQueryData(LEARNER_KEYS.hubs(learnerId), (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((h) => (h.id === hubId ? { ...h, onboardingCompletedAt: new Date().toISOString() } : h));
      });
    },
  });
}
