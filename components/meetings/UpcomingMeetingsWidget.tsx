'use client';

import {
  Paper,
  Title,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Loader,
  Center,
} from '@mantine/core';
import { IconCalendarEvent, IconArrowRight } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  useParentMeetings,
  getStatusColor,
  formatMeetingDate,
  formatMeetingTime,
} from '@/lib/hooks/useParentMeetings';

interface UpcomingMeetingsWidgetProps {
  limit?: number;
  showViewAll?: boolean;
}

export function UpcomingMeetingsWidget({
  limit = 5,
  showViewAll = true,
}: UpcomingMeetingsWidgetProps) {
  const t = useTranslations('meetings');
  const locale = useLocale();

  const { data, isLoading } = useParentMeetings({
    upcoming: true,
    limit,
  });

  const meetings = data?.meetings || [];

  return (
    <Paper p="md" withBorder radius="md">
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconCalendarEvent size="1.25rem" />
          <Title order={4}>{t('title')}</Title>
        </Group>

        {showViewAll && (
          <Button
            component={Link}
            href={`/${locale}/dashboard/meetings`}
            variant="subtle"
            size="xs"
            rightSection={<IconArrowRight size="0.875rem" />}
          >
            {t('tabs.all')}
          </Button>
        )}
      </Group>

      {isLoading && (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      )}

      {!isLoading && meetings.length === 0 && (
        <Center py="md">
          <Text c="dimmed" size="sm">
            {t('empty.noUpcoming')}
          </Text>
        </Center>
      )}

      {!isLoading && meetings.length > 0 && (
        <Stack gap="xs">
          {meetings.map((meeting) => (
            <Paper
              key={meeting.id}
              p="sm"
              withBorder
              radius="sm"
              component={Link}
              href={`/${locale}/dashboard/meetings/${meeting.id}`}
              style={{
                textDecoration: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {meeting.teacher.firstName} {meeting.teacher.lastName}
                    </Text>
                    <Badge
                      color={getStatusColor(meeting.status)}
                      variant="light"
                      size="xs"
                    >
                      {t(`status.${meeting.status}`)}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {meeting.student.firstName} {meeting.student.lastName}
                  </Text>
                </Stack>

                <Stack gap={2} align="flex-end">
                  <Text size="sm" fw={500}>
                    {formatMeetingDate(meeting.date, locale)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatMeetingTime(meeting.date, locale)}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}
