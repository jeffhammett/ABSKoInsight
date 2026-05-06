import {
  Alert,
  Button,
  Divider,
  Flex,
  Loader,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { JSX, useEffect, useState } from 'react';
import { mutate } from 'swr';
import { verifyAbsConnection } from '../../api/audiobookshelf';
import { saveSettings, useSettings } from '../../api/settings';
import { verifyWebdavConnection } from '../../api/sync';
import { formatRelativeDate } from '../../utils/dates';

const WEBDAV_INTERVAL_OPTIONS = [
  { label: 'Disabled', value: '0' },
  { label: 'Every 1 hour', value: '1' },
  { label: 'Every 6 hours', value: '6' },
  { label: 'Every 12 hours', value: '12' },
  { label: 'Every 24 hours', value: '24' },
];

const ABS_INTERVAL_OPTIONS = [
  { label: 'Disabled', value: '0' },
  { label: 'Every 15 minutes', value: '15' },
  { label: 'Every 1 hour', value: '60' },
  { label: 'Every 6 hours', value: '360' },
  { label: 'Every 24 hours', value: '1440' },
];

export function SettingsPage(): JSX.Element {
  const { data: settings, isLoading } = useSettings();

  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavDbPath, setWebdavDbPath] = useState('');
  const [webdavIntervalHours, setWebdavIntervalHours] = useState('0');
  const [absUrl, setAbsUrl] = useState('');
  const [absApiKey, setAbsApiKey] = useState('');
  const [absIntervalMinutes, setAbsIntervalMinutes] = useState('0');
  const [saving, setSaving] = useState(false);
  const [webdavVerifying, setWebdavVerifying] = useState(false);
  const [absVerifying, setAbsVerifying] = useState(false);
  const [webdavVerifyResult, setWebdavVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [absVerifyResult, setAbsVerifyResult] = useState<{ ok: boolean; message: string; username?: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setWebdavUrl(settings.webdav_url ?? '');
      setWebdavUsername(settings.webdav_username ?? '');
      setWebdavDbPath(settings.webdav_db_path ?? '');
      setWebdavIntervalHours(String(settings.webdav_sync_interval_hours ?? 0));
      setAbsUrl(settings.abs_url ?? '');
      setAbsIntervalMinutes(String(settings.abs_sync_interval_minutes ?? 0));
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
        webdav_sync_interval_hours: Number(webdavIntervalHours),
        abs_url: absUrl || null,
        abs_api_key: absApiKey || null,
        abs_sync_interval_minutes: Number(absIntervalMinutes),
      });
      await mutate('settings');
      setWebdavPassword('');
      setAbsApiKey('');
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

  const handleVerifyWebdav = async () => {
    setWebdavVerifying(true);
    setWebdavVerifyResult(null);
    try {
      const result = await verifyWebdavConnection({
        webdav_url: webdavUrl,
        webdav_username: webdavUsername,
        webdav_password: webdavPassword || undefined,
        webdav_db_path: webdavDbPath,
      });
      setWebdavVerifyResult(result);
    } catch {
      setWebdavVerifyResult({ ok: false, message: 'Connection test failed' });
    } finally {
      setWebdavVerifying(false);
    }
  };

  const handleVerifyAbs = async () => {
    setAbsVerifying(true);
    setAbsVerifyResult(null);
    try {
      const result = await verifyAbsConnection(absUrl, absApiKey || '');
      setAbsVerifyResult(result);
    } catch {
      setAbsVerifyResult({ ok: false, message: 'Connection test failed' });
    } finally {
      setAbsVerifying(false);
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
          placeholder={settings?.webdav_password_set ? '(saved)' : 'password'}
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
        <Select
          label="Auto sync interval"
          description="Automatically sync KOReader data from WebDAV on a schedule"
          value={webdavIntervalHours}
          onChange={(v) => setWebdavIntervalHours(v ?? '0')}
          data={WEBDAV_INTERVAL_OPTIONS}
          allowDeselect={false}
        />
        {settings?.webdav_last_synced_at && (
          <Text size="xs" c="dimmed">
            Last synced: {formatRelativeDate(new Date(settings.webdav_last_synced_at).getTime())}
          </Text>
        )}
        {webdavVerifyResult && (
          <Alert
            color={webdavVerifyResult.ok ? 'green' : 'red'}
            icon={webdavVerifyResult.ok ? <IconCheck size={16} /> : <IconX size={16} />}
          >
            {webdavVerifyResult.message}
          </Alert>
        )}
        <Flex gap="sm">
          <Button
            variant="default"
            onClick={handleVerifyWebdav}
            loading={webdavVerifying}
            disabled={!webdavUrl || !webdavDbPath}
          >
            Test connection
          </Button>
        </Flex>
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
          placeholder={settings?.abs_api_key_set ? '(saved)' : 'your-api-key'}
          description="Found in AudioBookShelf under Settings → Users → your user → API Token"
          value={absApiKey}
          onChange={(e) => setAbsApiKey(e.target.value)}
        />
        <Select
          label="Auto refresh interval"
          description="Automatically refresh AudioBookShelf data in the background"
          value={absIntervalMinutes}
          onChange={(v) => setAbsIntervalMinutes(v ?? '0')}
          data={ABS_INTERVAL_OPTIONS}
          allowDeselect={false}
        />
        {settings?.abs_last_synced_at && (
          <Text size="xs" c="dimmed">
            Last refreshed: {formatRelativeDate(new Date(settings.abs_last_synced_at).getTime())}
          </Text>
        )}
        {absVerifyResult && (
          <Alert
            color={absVerifyResult.ok ? 'green' : 'red'}
            icon={absVerifyResult.ok ? <IconCheck size={16} /> : <IconX size={16} />}
          >
            {absVerifyResult.message}
            {absVerifyResult.username && ` — logged in as ${absVerifyResult.username}`}
          </Alert>
        )}
        <Flex gap="sm">
          <Button
            variant="default"
            onClick={handleVerifyAbs}
            loading={absVerifying}
            disabled={!absUrl}
          >
            Test connection
          </Button>
        </Flex>
      </Stack>

      <Button mt="xl" onClick={handleSave} loading={saving}>
        Save settings
      </Button>
    </>
  );
}
