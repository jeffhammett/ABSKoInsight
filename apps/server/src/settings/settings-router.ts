import { Router } from 'express';
import { Settings, SettingsRepository } from './settings-repository';

const router = Router();

function maskSettings(settings: Settings) {
  const { webdav_password, abs_api_key, ...rest } = settings;
  return {
    ...rest,
    webdav_password: '',
    abs_api_key: '',
    webdav_password_set: !!webdav_password,
    abs_api_key_set: !!abs_api_key,
  };
}

router.get('/', async (_req, res) => {
  const settings = await SettingsRepository.get();
  res.json(maskSettings(settings));
});

router.put('/', async (req, res) => {
  const { webdav_url, webdav_username, webdav_password, webdav_db_path, abs_url, abs_api_key } =
    req.body;

  const errors: string[] = [];
  if (webdav_url) {
    try { new URL(webdav_url); } catch { errors.push('WebDAV URL is not a valid URL'); }
  }
  if (abs_url) {
    try { new URL(abs_url); } catch { errors.push('AudioBookShelf URL is not a valid URL'); }
  }
  if (errors.length) {
    res.status(400).json({ error: errors.join('; ') });
    return;
  }

  const updates: Partial<Omit<Settings, 'id'>> = {
    webdav_url: webdav_url ?? null,
    webdav_username: webdav_username ?? null,
    webdav_db_path: webdav_db_path ?? null,
    abs_url: abs_url ?? null,
  };
  if (webdav_password) updates.webdav_password = webdav_password;
  if (abs_api_key) updates.abs_api_key = abs_api_key;

  const settings = await SettingsRepository.update(updates);
  res.json(maskSettings(settings));
});

export { router as settingsRouter };
