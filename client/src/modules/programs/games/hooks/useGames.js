import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { gamesApi } from "../services/gamesApi";

export const GAMES_KEY = ["event-games"];
const errorMessage = (err, fallback) => err.response?.data?.message || err.message || fallback;

export function useGames() {
  return useQuery({ queryKey: GAMES_KEY, queryFn: gamesApi.getAll });
}

function useGameMutation(mutationFn, success, failure) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: GAMES_KEY });
      // Deleting a game takes it out of the bootcamps that used it.
      queryClient.invalidateQueries({ queryKey: ["bootcamps"] });
      if (success) toast.success(typeof success === "function" ? success(data) : success);
    },
    onError: (err) => toast.error(errorMessage(err, failure)),
  });
}

export const useCreateGame = ({ quiet = false } = {}) => useGameMutation(gamesApi.create, quiet ? null : (game) => `${game.name} added to your games`, "Could not add the game");
export const useUpdateGame = () => useGameMutation(({ id, ...data }) => gamesApi.update(id, data), "Game updated", "Could not update the game");
export const useDeleteGame = () => useGameMutation(gamesApi.remove, "Game deleted", "Could not delete the game");
