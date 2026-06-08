import { client } from './client';

export interface AuthResponse {
  token:     string;
  username:  string;
  player_id: number | null;
}

export const authApi = {
  register(username: string, password: string) {
    return client.post<AuthResponse>('/auth/register/', { username, password });
  },

  login(username: string, password: string) {
    return client.post<AuthResponse>('/auth/login/', { username, password });
  },

  logout() {
    return client.post<void>('/auth/logout/', {});
  },

  me() {
    return client.get<{ username: string; player_id: number | null }>('/auth/me/');
  },
};
