import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { venuesApi } from '../api/venues';
import type { VenuePayload } from '../types/venue';

const venueKeys = {
  all:  () => ['venues'] as const,
  list: () => ['venues', 'list'] as const,
};

export function useVenues() {
  return useQuery({
    queryKey: venueKeys.list(),
    queryFn:  venuesApi.list,
  });
}

export function useCreateVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: VenuePayload) => venuesApi.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: venueKeys.all() }),
  });
}

export function useUpdateVenue(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<VenuePayload>) => venuesApi.update(id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: venueKeys.all() }),
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => venuesApi.destroy(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: venueKeys.all() }),
  });
}
