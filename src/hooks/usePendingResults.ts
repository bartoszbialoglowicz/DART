import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pendingResultsApi } from '../api/pendingResults';
import type { PendingMatchResultPayload } from '../types/player';

const KEY = ['pending-results'] as const;

export function usePendingResults(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn:  () => pendingResultsApi.list(),
    enabled,
  });
}

export function useCreatePendingResult() {
  return useMutation({
    mutationFn: (payload: PendingMatchResultPayload) => pendingResultsApi.create(payload),
  });
}

export function useApprovePendingResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pendingResultsApi.approve(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDismissPendingResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pendingResultsApi.dismiss(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
