import useSWR from 'swr';
import { fetchFromAPI } from './api';

export interface Settings {
  id: number;
  webdav_url: string | null;
  webdav_username: string | null;
  webdav_password: string | null;
  webdav_db_path: string | null;
  abs_url: string | null;
  abs_api_key: string | null;
}

export function useSettings() {
  return useSWR('settings', () => fetchFromAPI<Settings>('settings'));
}

export async function saveSettings(data: Partial<Omit<Settings, 'id'>>) {
  return fetchFromAPI<Settings>('settings', 'PUT', data as Record<string, unknown>);
}
