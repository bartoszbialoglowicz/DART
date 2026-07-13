import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { highscoreApi } from '../api/highscore';
import type { HighscoreSessionPayload } from '../types/player';

export const highscoreKeys = {
  all:  () => ['highscores']         as const,
  list: () => ['highscores', 'list'] as const,
};

export function useHighscoreSessions() {
  return useQuery({
    queryKey: highscoreKeys.list(),
    queryFn:  () => highscoreApi.list(),
  });
}

export function useAddHighscoreSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: HighscoreSessionPayload) => highscoreApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: highscoreKeys.all() }),
  });
}
