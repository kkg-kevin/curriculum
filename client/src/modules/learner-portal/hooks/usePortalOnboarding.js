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
      if (data?.id) qc.invalidateQueries({ queryKey: LEARNER_KEYS.detail(data.id) });
      // useLearnerPortalScope reads learners via ["learners", "byGuardianEmail", email] — refresh
      // that too so the layout's gate check flips to "cleared" without a manual reload.
      qc.invalidateQueries({ queryKey: ["learners", "byGuardianEmail"] });
    },
  });
}
