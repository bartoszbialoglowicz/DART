import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sectorPracticeApi } from '../api/sectorPractice';
import type { SectorPracticeSessionPayload } from '../types/player';

export const sectorPracticeKeys = {
  all:  () => ['sector-practice']         as const,
  list: () => ['sector-practice', 'list'] as const,
};

export function useSectorPracticeSessions() {
  return useQuery({
    queryKey: sectorPracticeKeys.list(),
    queryFn:  () => sectorPracticeApi.list(),
  });
}

export function useAddSectorPracticeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SectorPracticeSessionPayload) => sectorPracticeApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sectorPracticeKeys.all() }),
  });
}
