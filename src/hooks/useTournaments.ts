import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi, type CreateTournamentInput, type MatchResultInput, type Tournament } from '../api/tournaments';
import { statisticsApi } from '../api/statistics';
import type { CurrentLeg, LegRecord } from '../types/bracket';

export const tournamentKeys = {
  all:        ()           => ['tournaments']                       as const,
  list:       ()           => ['tournaments', 'list']               as const,
  detail:     (id: number) => ['tournaments', 'detail', id]        as const,
  statistics: (id: number) => ['tournaments', 'statistics', id]    as const,
};

export function useTournaments() {
  return useQuery({
    queryKey: tournamentKeys.list(),
    queryFn:  () => tournamentsApi.list(),
  });
}

export function useTournament(id: number, refetchInterval?: number) {
  return useQuery({
    queryKey: tournamentKeys.detail(id),
    queryFn:  () => tournamentsApi.detail(id),
    enabled:  !!id,
    refetchInterval,
  });
}

export function useTournamentStatistics(id: number, refetchInterval?: number) {
  return useQuery({
    queryKey: tournamentKeys.statistics(id),
    queryFn:  () => statisticsApi.list(id),
    enabled:  !!id,
    refetchInterval,
  });
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTournamentInput) => tournamentsApi.create(input),
    onSuccess: (saved) => {
      qc.setQueryData(tournamentKeys.detail(saved.id), saved);
      qc.invalidateQueries({ queryKey: tournamentKeys.list() });
    },
  });
}

/** Every bracket command returns the updated tournament — cache it directly. */
function useTournamentCommand<V>(run: (vars: V) => Promise<Tournament>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (saved) => {
      qc.setQueryData(tournamentKeys.detail(saved.id), saved);
      qc.invalidateQueries({ queryKey: tournamentKeys.list() });
    },
  });
}

export function useConfirmTournamentDraft() {
  return useTournamentCommand((id: number) => tournamentsApi.confirmDraft(id));
}

export function useRedrawTournament() {
  return useTournamentCommand((id: number) => tournamentsApi.redraw(id));
}

export function useAdvanceGroups() {
  return useTournamentCommand((id: number) => tournamentsApi.advanceGroups(id));
}

export function useRecordMatchResult() {
  return useTournamentCommand(
    ({ id, matchId, ...input }: { id: number; matchId: string } & MatchResultInput) =>
      tournamentsApi.recordResult(id, matchId, input),
  );
}

export function useUpdateMatchLeg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, matchId, legs, currentLeg }: {
      id:         number;
      matchId:    string;
      legs:       LegRecord[];
      currentLeg: CurrentLeg | null;
    }) => tournamentsApi.updateMatchLeg(id, matchId, legs, currentLeg),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
    },
  });
}
