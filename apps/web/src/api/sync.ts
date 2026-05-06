import { API_URL } from './api';

export async function triggerWebdavSync(): Promise<{ message: string; booksCount?: number }> {
  const response = await fetch(`${API_URL}/sync/webdav`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as any).error ?? 'Sync failed');
  }
  return response.json();
}

export async function verifyWebdavConnection(params: {
  webdav_url?: string;
  webdav_username?: string;
  webdav_password?: string;
  webdav_db_path?: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${API_URL}/sync/verify-webdav`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return response.json();
}
