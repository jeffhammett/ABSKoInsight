import useSWR from 'swr';
import { fetchFromAPI } from './api';
import { Device } from '@koinsight/common/types/device';

export function useDevices() {
  return useSWR('devices', () => fetchFromAPI<Device[]>('devices'), { fallbackData: [] });
}

export interface DeviceStat {
  name: string;
  type: 'ebook' | 'audiobook';
  totalTime: number;
  lastActive: number;
}

export function useEbookDevices() {
  return useSWR('stats/devices', () => fetchFromAPI<DeviceStat[]>('stats/devices'), {
    fallbackData: [],
    shouldRetryOnError: false,
  });
}
