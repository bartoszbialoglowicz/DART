import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaguesApi } from '../api/leagues';
import type { LeagueMatchStats, LeaguePayload } from '../types/league';
import type { CurrentLeg, LegRecord } from '../types/bracket';

export const leagueKeys = {
  all:       ()           => ['leagues']                     as const,
  list:      ()           => ['leagues', 'list']             as const,
  detail:    (id: number) => ['leagues', 'detail', id]       as const,
  schedule:  (id: number) => ['leagues', 'schedule', id]     as const,
  standings: (id: number) => ['leagues', 'standings', id]    as const,
};

export function useLeagues() {
  return useQuery({ queryKey: leagueKeys.list(), queryFn: leaguesApi.list });
}

export function useLeague(id: number) {
  return useQuery({
    queryKey: leagueKeys.detail(id),
    queryFn:  () => leaguesApi.detail(id),
    enabled:  !!id,
  });
}

export function useLeagueSchedule(id: number) {
  return useQuery({
    queryKey: leagueKeys.schedule(id),
    queryFn:  () => leaguesApi.schedule(id),
    enabled:  !!id,
  });
}

export function useLeagueStandings(id: number) {
  return useQuery({
    queryKey: leagueKeys.standings(id),
    queryFn:  () => leaguesApi.standings(id),
    enabled:  !!id,
  });
}

export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeaguePayload) => leaguesApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: leagueKeys.list() }),
  });
}

export function useFinalizeLeague(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaguesApi.finalize(leagueId),
    onSuccess: (updated) => {
      qc.setQueryData(leagueKeys.detail(leagueId), updated);
      qc.invalidateQueries({ queryKey: leagueKeys.list() });
    },
  });
}

export function useDeleteLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaguesApi.destroy(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: leagueKeys.list() }),
  });
}

export function useAddLeagueMember(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { player_id?: number; display_name?: string }) =>
      leaguesApi.addMember(leagueId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
  });
}

export function useRemoveLeagueMember(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: number) => leaguesApi.removeMember(leagueId, memberId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
  });
}

export function useLinkPlayer(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, playerId }: { memberId: number; playerId: number }) =>
      leaguesApi.linkPlayer(leagueId, memberId, playerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) }),
  });
}

export function useGenerateSchedule(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaguesApi.generateSchedule(leagueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) });
      qc.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) });
    },
  });
}

export function useClearSchedule(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => leaguesApi.clearSchedule(leagueId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) });
      qc.invalidateQueries({ queryKey: leagueKeys.detail(leagueId) });
    },
  });
}

export function useUpdateMatch(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, data }: {
      matchId: number;
      data: Partial<LeagueMatchStats> & { home_score?: number; away_score?: number; scheduled_at?: string };
    }) => leaguesApi.updateMatch(leagueId, matchId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) });
      qc.invalidateQueries({ queryKey: leagueKeys.standings(leagueId) });
    },
  });
}

export function useApproveMatch(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchId: number) => leaguesApi.approveMatch(leagueId, matchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) });
      qc.invalidateQueries({ queryKey: leagueKeys.standings(leagueId) });
    },
  });
}

export function useUpdateLeagueMatchLeg(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, legs, currentLeg }: {
      matchId: number; legs: LegRecord[]; currentLeg: CurrentLeg | null;
    }) => leaguesApi.updateMatchLeg(leagueId, matchId, legs, currentLeg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) });
    },
  });
}

export function useSetMatchdayDate(leagueId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matchday, date }: { matchday: number; date: string | null }) =>
      leaguesApi.setMatchdayDate(leagueId, matchday, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: leagueKeys.schedule(leagueId) }),
  });
}
