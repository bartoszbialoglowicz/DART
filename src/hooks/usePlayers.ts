import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '../api/players';
import type { PlayerPayload } from '../types/player';

export const playerKeys = {
  all:    ()           => ['players']                  as const,
  list:   (params = {}) => ['players', 'list', params] as const,
  detail: (id: number) => ['players', 'detail', id]   as const,
};

export function usePlayers(params?: Parameters<typeof playersApi.list>[0]) {
  return useQuery({
    queryKey: playerKeys.list(params),
    queryFn:  () => playersApi.list(params),
  });
}


export function usePlayer(id: number) {
  return useQuery({
    queryKey: playerKeys.detail(id),
    queryFn:  () => playersApi.detail(id),
    enabled:  !!id,
  });
}

export function useCreatePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlayerPayload) => playersApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.all() }),
  });
}

export function useUpdatePlayer(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<PlayerPayload>) => playersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.all() }),
  });
}

export function useDeletePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => playersApi.destroy(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: playerKeys.all() }),
  });
}

export function useMyStats() {
  return useQuery({
    queryKey: ['players', 'my-stats'],
    queryFn:  () => playersApi.myStats(),
  });
}
