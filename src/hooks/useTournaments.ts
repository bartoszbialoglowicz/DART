import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '../api/tournaments';
import { statisticsApi } from '../api/statistics';
import type { BracketData } from '../types/bracket';

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
    mutationFn: (bracket: BracketData) => tournamentsApi.create(bracket),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.list() }),
  });
}

export function useUpdateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bracket }: { id: number; bracket: BracketData }) =>
      tournamentsApi.update(id, bracket),
    onSuccess: (saved) => {
      qc.setQueryData(tournamentKeys.detail(saved.id), saved);
      qc.invalidateQueries({ queryKey: tournamentKeys.list() });
    },
  });
}
