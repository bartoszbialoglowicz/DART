import { client } from './client';
import type { Contact, GuestPlayer, LinkCode, LinkedGuest, Organizer } from '../types/linking';

// Linking account-less players ("słupy") to a registered player's profile.
// The player hands the organizer a code; the organizer never browses accounts.
export const linkingApi = {
  myCode() {
    return client.get<LinkCode>('/players/link-code/');
  },

  issueCode() {
    return client.post<LinkCode>('/players/link-code/', {});
  },

  revokeCode() {
    return client.delete('/players/link-code/');
  },

  /** Organizers' guests linked to my profile. */
  linked() {
    return client.get<LinkedGuest[]>('/players/linked/');
  },

  /** My own account-less players, as an organizer. */
  myGuests() {
    return client.get<GuestPlayer[]>('/players/my-guests/');
  },

  /**
   * Link my guest to a registered player — by their `code`, or to one of my
   * contacts (`contactId`, they already gave a code). `dryRun` only checks
   * and returns whose profile it is.
   */
  link(guestId: number, target: { code: string } | { contactId: number }, dryRun = false) {
    const body = 'code' in target ? { code: target.code } : { contact_id: target.contactId };
    return client.post<{ linked_to: string; linked: boolean }>(
      `/players/${guestId}/link/`, { ...body, dry_run: dryRun },
    );
  },

  /** Registered players I may add to my tournaments and leagues. */
  contacts() {
    return client.get<Contact[]>('/players/contacts/');
  },

  addContact(code: string, dryRun = false) {
    return client.post<Contact & { added: boolean }>('/players/contacts/', { code, dry_run: dryRun });
  },

  removeContact(playerId: number) {
    return client.delete(`/players/contacts/${playerId}/`);
  },

  /** Organizers who may add me to their events. */
  organizers() {
    return client.get<Organizer[]>('/players/organizers/');
  },

  removeOrganizer(userId: number) {
    return client.delete(`/players/organizers/${userId}/`);
  },

  unlink(guestId: number) {
    return client.post(`/players/${guestId}/unlink/`, {});
  },
};
