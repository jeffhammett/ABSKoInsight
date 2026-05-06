import { Router } from 'express';
import { SettingsRepository } from './settings-repository';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = await SettingsRepository.get();
  res.json(settings);
});

router.put('/', async (req, res) => {
  const { webdav_url, webdav_username, webdav_password, webdav_db_path, abs_url, abs_api_key } =
    req.body;
  const settings = await SettingsRepository.update({
    webdav_url: webdav_url ?? null,
    webdav_username: webdav_username ?? null,
    webdav_password: webdav_password ?? null,
    webdav_db_path: webdav_db_path ?? null,
    abs_url: abs_url ?? null,
    abs_api_key: abs_api_key ?? null,
  });
  res.json(settings);
});

export { router as settingsRouter };
