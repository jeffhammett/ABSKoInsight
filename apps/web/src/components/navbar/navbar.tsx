import {
  ActionIcon,
  Box,
  Flex,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBooks,
  IconCalendar,
  IconChartBar,
  IconDevices,
  IconHome,
  IconMoon,
  IconRefresh,
  IconSettings,
  IconSun,
} from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { mutate } from 'swr';
import { refreshAbsCache } from '../../api/audiobookshelf';
import { triggerWebdavSync } from '../../api/sync';
import { RoutePath } from '../../routes';
import { Logo } from '../logo/logo';
import { UploadForm } from './upload-form';

import style from './navbar.module.css';

export function Navbar({ onNavigate }: { onNavigate?: () => void }): JSX.Element {
  const { pathname } = useLocation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme();
  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const [result] = await Promise.allSettled([
        triggerWebdavSync(),
        refreshAbsCache(),
      ]);
      await mutate(() => true, undefined, { revalidate: true });
      const msg =
        result.status === 'fulfilled'
          ? result.value.message
          : 'WebDAV sync skipped (not configured)';
      notifications.show({
        title: 'Sync complete',
        message: msg,
        color: 'green',
        position: 'top-center',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Sync failed',
        message: err?.message ?? 'An error occurred during sync.',
        color: 'red',
        position: 'top-center',
      });
    } finally {
      setSyncing(false);
    }
  };

  const tabs = [
    { link: RoutePath.HOME, label: 'Home', icon: IconHome },
    { link: RoutePath.BOOKS, label: 'Books', icon: IconBooks },
    { link: RoutePath.CALENDAR, label: 'Calendar', icon: IconCalendar },
    { link: RoutePath.STATS, label: 'Reading stats', icon: IconChartBar },
    { link: RoutePath.DEVICES, label: 'Devices', icon: IconDevices },
    { link: RoutePath.SETTINGS, label: 'Settings', icon: IconSettings },
  ];

  const [active, setActive] = useState(
    () => tabs.find((item) => item.link === pathname)?.link ?? RoutePath.HOME
  );

  const onClick = (link: RoutePath) => {
    setActive(link);
    onNavigate?.();
  };

  const links = tabs.map((item) => (
    <NavLink
      className={style.Link}
      data-active={item.link === active || undefined}
      to={item.link}
      key={item.label}
      onClick={() => onClick(item.link)}
    >
      <item.icon className={style.LinkIcon} stroke={1.5} />
      <span>{item.label}</span>
    </NavLink>
  ));

  return (
    <Box className={style.Navbar} component="nav">
      <Logo
        onClick={() => {
          setActive(RoutePath.HOME);
          onNavigate?.();
        }}
        className={style.Logo}
      />
      <div>{links}</div>
      <div className={style.Footer}>
        <Flex gap="xs">
          <UploadForm />
          <Tooltip label="Sync WebDAV & AudioBookShelf" position="top" withArrow openDelay={500}>
            <ActionIcon
              onClick={handleSync}
              variant="default"
              size="lg"
              aria-label="Sync data"
              loading={syncing}
            >
              <IconRefresh stroke={1.5} />
            </ActionIcon>
          </Tooltip>
          <ActionIcon
            onClick={toggleColorScheme}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
          >
            {computedColorScheme === 'dark' ? (
              <IconSun stroke={1.5} color="yellow" />
            ) : (
              <IconMoon stroke={1.5} color="violet" />
            )}
          </ActionIcon>
        </Flex>
      </div>
    </Box>
  );
}
