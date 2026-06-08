import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trainingApi } from '../api/training';
import type { TrainingSessionPayload } from '../types/player';

const KEY = ['training'] as const;

export function useTrainingSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn:  () => trainingApi.list(),
  });
}

export function useAddTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TrainingSessionPayload) => trainingApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTrainingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => trainingApi.destroy(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
