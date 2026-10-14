import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { linkingApi } from '../api/linking';

export const linkingKeys = {
  all:        ()  => ['linking']               as const,
  code:       ()  => ['linking', 'code']       as const,
  linked:     ()  => ['linking', 'linked']     as const,
  guests:     ()  => ['linking', 'guests']     as const,
  contacts:   ()  => ['linking', 'contacts']   as const,
  organizers: ()  => ['linking', 'organizers'] as const,
};

export function useMyLinkCode() {
  return useQuery({ queryKey: linkingKeys.code(), queryFn: () => linkingApi.myCode() });
}

export function useIssueLinkCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => linkingApi.issueCode(),
    onSuccess:  (code) => qc.setQueryData(linkingKeys.code(), code),
  });
}

export function useRevokeLinkCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => linkingApi.revokeCode(),
    onSuccess:  () => qc.setQueryData(linkingKeys.code(), { code: null, expires_at: null }),
  });
}

export function useLinkedGuests() {
  return useQuery({ queryKey: linkingKeys.linked(), queryFn: () => linkingApi.linked() });
}

export function useMyGuests() {
  return useQuery({ queryKey: linkingKeys.guests(), queryFn: () => linkingApi.myGuests() });
}

/** Linking changes stats, visible tournaments and player lists — refresh them all. */
function useInvalidateAfterLink() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: linkingKeys.all() });
    qc.invalidateQueries({ queryKey: ['players'] });
    qc.invalidateQueries({ queryKey: ['tournaments'] });
  };
}

type LinkTarget = { code: string } | { contactId: number };

export function useCheckLinkCode() {
  return useMutation({
    mutationFn: ({ guestId, target }: { guestId: number; target: LinkTarget }) => linkingApi.link(guestId, target, true),
  });
}

export function useLinkGuest() {
  const invalidate = useInvalidateAfterLink();
  return useMutation({
    mutationFn: ({ guestId, target }: { guestId: number; target: LinkTarget }) => linkingApi.link(guestId, target),
    onSuccess:  invalidate,
  });
}

export function useContacts() {
  return useQuery({ queryKey: linkingKeys.contacts(), queryFn: () => linkingApi.contacts() });
}

export function useCheckContactCode() {
  return useMutation({ mutationFn: (code: string) => linkingApi.addContact(code, true) });
}

export function useAddContact() {
  const invalidate = useInvalidateAfterLink();
  return useMutation({ mutationFn: (code: string) => linkingApi.addContact(code), onSuccess: invalidate });
}

export function useRemoveContact() {
  const invalidate = useInvalidateAfterLink();
  return useMutation({ mutationFn: (playerId: number) => linkingApi.removeContact(playerId), onSuccess: invalidate });
}

export function useOrganizers() {
  return useQuery({ queryKey: linkingKeys.organizers(), queryFn: () => linkingApi.organizers() });
}

export function useRemoveOrganizer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => linkingApi.removeOrganizer(userId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: linkingKeys.organizers() }),
  });
}

export function useUnlinkGuest() {
  const invalidate = useInvalidateAfterLink();
  return useMutation({
    mutationFn: (guestId: number) => linkingApi.unlink(guestId),
    onSuccess:  invalidate,
  });
}
