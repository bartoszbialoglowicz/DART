import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../api/training';
import type { TrainingSessionPayload } from '../types/player';

export const trainingKeys = {
  all:    () => ['training']              as const,
  list:   () => ['training', 'list']      as const,
  detail: (id: number) => ['training', 'detail', id] as const,
};

export function useTrainingSessions() {
  return useQuery({
    queryKey: trainingKeys.list(),
    queryFn:  () => trainingApi.list(),
  });
}

export function useAddTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrainingSessionPayload) => trainingApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: trainingKeys.all() }),
  });
}

export function useDeleteTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trainingApi.destroy(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: trainingKeys.all() }),
  });
}
