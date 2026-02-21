'use client';

import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Tabs,
  Select,
  SimpleGrid,
  Loader,
  Center,
  Pagination,
  Paper,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconClock, IconCalendarCheck, IconList, IconHistory } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { MeetingCard } from './MeetingCard';
import {
  ParentMeeting,
  ParentMeetingFilters,
  useParentMeetings,
} from '@/lib/hooks/useParentMeetings';

interface MeetingsListProps {
  viewAs: 'teacher' | 'parent' | 'admin';
  teacherId?: string;
  studentId?: string;
  teachers?: { id: string; firstName: string; lastName: string }[];
  students?: { id: string; firstName: string; lastName: string }[];
  onMeetingClick?: (meeting: ParentMeeting) => void;
  onConfirm?: (meeting: ParentMeeting) => void;
  onCancel?: (meeting: ParentMeeting) => void;
  onComplete?: (meeting: ParentMeeting) => void;
  onEdit?: (meeting: ParentMeeting) => void;
  onDelete?: (meeting: ParentMeeting) => void;
}

type TabValue = 'pending' | 'upcoming' | 'all' | 'past';

export function MeetingsList({
  viewAs,
  teacherId,
  studentId,
  teachers = [],
  students = [],
  onMeetingClick,
  onConfirm,
  onCancel,
  onComplete,
  onEdit,
  onDelete,
}: MeetingsListProps) {
  const t = useTranslations('meetings');
  const [activeTab, setActiveTab] = useState<TabValue>('upcoming');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(teacherId || null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(studentId || null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Build filters based on tab and selections
  const buildFilters = (): ParentMeetingFilters => {
    const filters: ParentMeetingFilters = {
      limit,
      offset: (page - 1) * limit,
    };

    if (selectedTeacherId) filters.teacherId = selectedTeacherId;
    if (selectedStudentId) filters.studentId = selectedStudentId;

    const now = new Date();

    switch (activeTab) {
      case 'pending':
        filters.status = 'REQUESTED';
        break;
      case 'upcoming':
        filters.status = 'CONFIRMED';
        filters.upcoming = true;
        break;
      case 'past':
        filters.endDate = now.toISOString();
        break;
      case 'all':
      default:
        if (dateRange[0]) filters.startDate = dateRange[0].toISOString();
        if (dateRange[1]) filters.endDate = dateRange[1].toISOString();
        break;
    }

    return filters;
  };

  const { data, isLoading, error } = useParentMeetings(buildFilters());

  const meetings = data?.meetings || [];
  const total = data?.pagination.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleTabChange = (value: string | null) => {
    if (value) {
      setActiveTab(value as TabValue);
      setPage(1);
    }
  };

  if (error) {
    return (
      <Center py="xl">
        <Text c="red">{t('errors.createFailed')}</Text>
      </Center>
    );
  }

  return (
    <Stack gap="md">
      {/* Filters */}
      <Paper p="md" withBorder radius="md">
        <Group gap="md" wrap="wrap">
          {viewAs === 'admin' && teachers.length > 0 && (
            <Select
              label={t('selectTeacher')}
              placeholder={t('selectTeacher')}
              data={teachers.map((t) => ({
                value: t.id,
                label: `${t.firstName} ${t.lastName}`,
              }))}
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              clearable
              searchable
              style={{ minWidth: 200 }}
            />
          )}

          {(viewAs === 'admin' || viewAs === 'teacher') && students.length > 0 && (
            <Select
              label={t('selectStudent')}
              placeholder={t('selectStudent')}
              data={students.map((s) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName}`,
              }))}
              value={selectedStudentId}
              onChange={setSelectedStudentId}
              clearable
              searchable
              style={{ minWidth: 200 }}
            />
          )}

          {activeTab === 'all' && (
            <DatePickerInput
              type="range"
              label={t('selectDateTime')}
              placeholder={t('selectDateTime')}
              value={dateRange}
              onChange={setDateRange}
              clearable
              style={{ minWidth: 250 }}
            />
          )}
        </Group>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="pending" leftSection={<IconClock size="1rem" />}>
            {t('tabs.pending')}
          </Tabs.Tab>
          <Tabs.Tab value="upcoming" leftSection={<IconCalendarCheck size="1rem" />}>
            {t('tabs.upcoming')}
          </Tabs.Tab>
          <Tabs.Tab value="all" leftSection={<IconList size="1rem" />}>
            {t('tabs.all')}
          </Tabs.Tab>
          <Tabs.Tab value="past" leftSection={<IconHistory size="1rem" />}>
            {t('tabs.past')}
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <Center py="xl">
          <Loader />
        </Center>
      )}

      {/* Empty state */}
      {!isLoading && meetings.length === 0 && (
        <Center py="xl">
          <Text c="dimmed">
            {activeTab === 'pending'
              ? t('empty.noPending')
              : activeTab === 'upcoming'
              ? t('empty.noUpcoming')
              : t('empty.noMeetings')}
          </Text>
        </Center>
      )}

      {/* Meetings grid */}
      {!isLoading && meetings.length > 0 && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                viewAs={viewAs}
                onClick={onMeetingClick}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onComplete={onComplete}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </SimpleGrid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Center mt="md">
              <Pagination
                value={page}
                onChange={setPage}
                total={totalPages}
                withEdges
              />
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}
