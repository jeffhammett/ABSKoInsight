import {
  Button,
  Divider,
  Flex,
  Loader,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { JSX, useEffect, useState } from 'react';
import { mutate } from 'swr';
import { saveSettings, useSettings } from '../../api/settings';

export function SettingsPage(): JSX.Element {
  const { data: settings, isLoading } = useSettings();

  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavDbPath, setWebdavDbPath] = useState('');
  const [absUrl, setAbsUrl] = useState('');
  const [absApiKey, setAbsApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setWebdavUrl(settings.webdav_url ?? '');
      setWebdavUsername(settings.webdav_username ?? '');
      setWebdavPassword(settings.webdav_password ?? '');
      setWebdavDbPath(settings.webdav_db_path ?? '');
      setAbsUrl(settings.abs_url ?? '');
      setAbsApiKey(settings.abs_api_key ?? '');
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        webdav_url: webdavUrl || null,
        webdav_username: webdavUsername || null,
        webdav_password: webdavPassword || null,
        webdav_db_path: webdavDbPath || null,
        abs_url: absUrl || null,
        abs_api_key: absApiKey || null,
      });
      await mutate('settings');
      notifications.show({
        title: 'Settings saved',
        message: 'Your settings have been saved successfully.',
        color: 'green',
        position: 'top-center',
      });
    } catch {
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings.',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  return (
    <>
      <Title mb="xl">Settings</Title>

      <Title order={3} mb="xs">
        WebDAV Sync
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Sync your KOReader statistics database directly from a WebDAV server instead of using the
        KOReader plugin. Use the sync button in the sidebar to trigger a sync.
      </Text>
      <Stack gap="md" maw={480}>
        <TextInput
          label="WebDAV URL"
          placeholder="https://your-webdav-server.com/dav"
          value={webdavUrl}
          onChange={(e) => setWebdavUrl(e.target.value)}
        />
        <TextInput
          label="Username"
          placeholder="username"
          value={webdavUsername}
          onChange={(e) => setWebdavUsername(e.target.value)}
        />
        <PasswordInput
          label="Password"
          placeholder="password"
          value={webdavPassword}
          onChange={(e) => setWebdavPassword(e.target.value)}
        />
        <TextInput
          label="Database file path"
          placeholder="/KOReader/statistics.sqlite3"
          description="Path to the statistics.sqlite3 file on the WebDAV server"
          value={webdavDbPath}
          onChange={(e) => setWebdavDbPath(e.target.value)}
        />
      </Stack>

      <Divider my="xl" />

      <Title order={3} mb="xs">
        AudioBookShelf
      </Title>
      <Text c="dimmed" size="sm" mb="lg">
        Connect to your AudioBookShelf server to include audiobook listening stats alongside your
        e-book reading stats.
      </Text>
      <Stack gap="md" maw={480}>
        <TextInput
          label="Server URL"
          placeholder="https://your-audiobookshelf.com"
          value={absUrl}
          onChange={(e) => setAbsUrl(e.target.value)}
        />
        <PasswordInput
          label="API Key"
          placeholder="your-api-key"
          description="Found in AudioBookShelf under Settings → Users → your user → API Token"
          value={absApiKey}
          onChange={(e) => setAbsApiKey(e.target.value)}
        />
      </Stack>

      <Button mt="xl" onClick={handleSave} loading={saving}>
        Save settings
      </Button>
    </>
  );
}
