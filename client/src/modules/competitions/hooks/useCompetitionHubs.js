import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { competitionApi } from "../services/competitionApi";
import { COMPETITION_KEYS } from "./useCompetitions";

const COMPETITION_HUB_KEYS = {
  byCompetition: (competitionId) => ["competitions", "hubs", competitionId],
};

export function useCompetitionHubsQuery(competitionId) {
  return useQuery({
    queryKey: COMPETITION_HUB_KEYS.byCompetition(competitionId),
    queryFn: () => competitionApi.listHubs(competitionId),
    enabled: !!competitionId,
  });
}

export function useCreateCompetitionHub(competitionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => competitionApi.addHub(competitionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETITION_HUB_KEYS.byCompetition(competitionId) });
      qc.invalidateQueries({ queryKey: COMPETITION_KEYS.detail(competitionId) });
      toast.success("Competition is now running at that hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to run competition at hub"),
  });
}

export function useDeleteCompetitionHub(competitionId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offeringId) => competitionApi.removeHub(competitionId, offeringId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPETITION_HUB_KEYS.byCompetition(competitionId) });
      qc.invalidateQueries({ queryKey: COMPETITION_KEYS.detail(competitionId) });
      toast.success("Removed from that hub");
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || "Failed to remove offering"),
  });
}
