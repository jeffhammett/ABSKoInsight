import { db } from '../knex';

export interface Settings {
  id: number;
  webdav_url: string | null;
  webdav_username: string | null;
  webdav_password: string | null;
  webdav_db_path: string | null;
  abs_url: string | null;
  abs_api_key: string | null;
}

export class SettingsRepository {
  static async get(): Promise<Settings> {
    let settings = await db<Settings>('settings').where({ id: 1 }).first();
    if (!settings) {
      await db('settings').insert({ id: 1 });
      settings = await db<Settings>('settings').where({ id: 1 }).first();
    }
    return settings!;
  }

  static async update(data: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
    await db('settings').where({ id: 1 }).update(data);
    return SettingsRepository.get();
  }
}
