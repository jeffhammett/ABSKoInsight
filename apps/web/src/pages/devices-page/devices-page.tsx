import { Badge, Flex, Loader, Table, Text, Title } from '@mantine/core';
import { JSX, useMemo } from 'react';
import { DeviceStat, useEbookDevices } from '../../api/devices';
import { useAbsSessions } from '../../api/audiobookshelf';
import { formatRelativeDate, formatSecondsToHumanReadable } from '../../utils/dates';

export function DevicesPage(): JSX.Element {
  const { data: ebookDevices, isLoading: ebookLoading } = useEbookDevices();
  const { data: absSessions, isLoading: absLoading } = useAbsSessions();

  const absDevices = useMemo((): DeviceStat[] => {
    const map: Record<string, { totalTime: number; lastActive: number }> = {};
    for (const s of absSessions) {
      const name = s.deviceDescription || 'Unknown ABS client';
      if (!map[name]) map[name] = { totalTime: 0, lastActive: 0 };
      map[name].totalTime += s.timeListening;
      map[name].lastActive = Math.max(map[name].lastActive, s.startedAt);
    }
    return Object.entries(map).map(([name, data]) => ({
      name,
      type: 'audiobook' as const,
      totalTime: data.totalTime,
      lastActive: data.lastActive,
    }));
  }, [absSessions]);

  const allDevices = useMemo(
    () => [...(ebookDevices ?? []), ...absDevices].sort((a, b) => b.totalTime - a.totalTime),
    [ebookDevices, absDevices]
  );

  if (ebookLoading || absLoading) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Loader />
      </Flex>
    );
  }

  if (allDevices.length === 0) {
    return (
      <>
        <Title mb="xl">Devices</Title>
        <Text c="dimmed">No device data found. Sync your KOReader statistics to see devices.</Text>
      </>
    );
  }

  return (
    <>
      <Title mb="xl">Devices</Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Device</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Total time</Table.Th>
            <Table.Th visibleFrom="md">Last active</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {allDevices.map((device, i) => (
            <Table.Tr key={`${device.name}-${i}`}>
              <Table.Td fw={600}>{device.name}</Table.Td>
              <Table.Td>
                {device.type === 'ebook' ? (
                  <Badge color="teal" variant="light" size="sm">
                    E-book reader
                  </Badge>
                ) : (
                  <Badge color="violet" variant="light" size="sm">
                    Audiobook client
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>{device.totalTime ? formatSecondsToHumanReadable(device.totalTime) : 'N/A'}</Table.Td>
              <Table.Td visibleFrom="md">
                {device.lastActive ? formatRelativeDate(device.lastActive) : 'N/A'}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
