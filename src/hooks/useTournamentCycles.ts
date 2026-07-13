import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tournamentCyclesApi } from '../api/tournamentCycles';
import type { TournamentCyclePayload } from '../types/tournamentCycle';

export const tournamentCycleKeys = {
  all:       ()           => ['tournament-cycles']                as const,
  list:      ()           => ['tournament-cycles', 'list']        as const,
  detail:    (id: number) => ['tournament-cycles', 'detail', id]  as const,
  standings: (id: number) => ['tournament-cycles', 'standings', id] as const,
};

export function useTournamentCycles() {
  return useQuery({ queryKey: tournamentCycleKeys.list(), queryFn: tournamentCyclesApi.list });
}

export function useTournamentCycle(id: number) {
  return useQuery({
    queryKey: tournamentCycleKeys.detail(id),
    queryFn:  () => tournamentCyclesApi.detail(id),
    enabled:  !!id,
  });
}

export function useCycleStandings(id: number) {
  return useQuery({
    queryKey: tournamentCycleKeys.standings(id),
    queryFn:  () => tournamentCyclesApi.standings(id),
    enabled:  !!id,
  });
}

export function useCreateTournamentCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TournamentCyclePayload) => tournamentCyclesApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: tournamentCycleKeys.list() }),
  });
}

export function useDeleteTournamentCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tournamentCyclesApi.destroy(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: tournamentCycleKeys.list() }),
  });
}

export function useAddCycleEvent(cycleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; planned_date: string | null }) =>
      tournamentCyclesApi.addEvent(cycleId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentCycleKeys.detail(cycleId) }),
  });
}

export function useUpdateCycleEvent(cycleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: {
      eventId: number;
      data: { name?: string; planned_date?: string | null; tournament_id?: number | null };
    }) => tournamentCyclesApi.updateEvent(cycleId, eventId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentCycleKeys.detail(cycleId) });
      qc.invalidateQueries({ queryKey: tournamentCycleKeys.standings(cycleId) });
    },
  });
}
