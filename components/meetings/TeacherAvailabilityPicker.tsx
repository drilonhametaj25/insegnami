'use client';

import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Paper,
  SimpleGrid,
  Button,
  Loader,
  Center,
  Badge,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { IconClock } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useTeacherAvailability, TimeSlot } from '@/lib/hooks/useParentMeetings';

interface TeacherAvailabilityPickerProps {
  teacherId: string;
  onSlotSelect: (slot: TimeSlot) => void;
  selectedSlot?: TimeSlot | null;
}

export function TeacherAvailabilityPicker({
  teacherId,
  onSlotSelect,
  selectedSlot,
}: TeacherAvailabilityPickerProps) {
  const t = useTranslations('meetings');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const dateStr = selectedDate?.toISOString().split('T')[0];
  const { data, isLoading } = useTeacherAvailability(teacherId, dateStr);

  const slots = selectedDate && dateStr && data?.slots?.[dateStr] ? data.slots[dateStr] : [];

  // Filter to only available slots
  const availableSlots = slots.filter((slot) => slot.isAvailable);

  // Minimum date is today
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);

  // Maximum date is 30 days from now
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Stack gap="md">
      <Text fw={500}>{t('availability.title')}</Text>

      <Group align="flex-start" gap="xl" wrap="wrap">
        {/* Calendar */}
        <Paper p="md" withBorder radius="md">
          <Text size="sm" c="dimmed" mb="xs">
            {t('availability.selectDay')}
          </Text>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            minDate={minDate}
            maxDate={maxDate}
            excludeDate={(date) => {
              // Exclude weekends
              const day = date.getDay();
              return day === 0 || day === 6;
            }}
          />
        </Paper>

        {/* Time slots */}
        <Paper p="md" withBorder radius="md" style={{ flex: 1, minWidth: 250 }}>
          <Text size="sm" c="dimmed" mb="xs">
            {t('availability.selectSlot')}
          </Text>

          {!selectedDate && (
            <Center py="xl">
              <Text c="dimmed">{t('availability.selectDay')}</Text>
            </Center>
          )}

          {selectedDate && isLoading && (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          )}

          {selectedDate && !isLoading && availableSlots.length === 0 && (
            <Center py="xl">
              <Text c="dimmed">{t('availability.noSlots')}</Text>
            </Center>
          )}

          {selectedDate && !isLoading && availableSlots.length > 0 && (
            <SimpleGrid cols={3} spacing="xs">
              {slots.map((slot, index) => {
                const isSelected =
                  selectedSlot?.startTime === slot.startTime;

                return (
                  <Button
                    key={index}
                    variant={isSelected ? 'filled' : slot.isAvailable ? 'light' : 'default'}
                    color={isSelected ? 'blue' : slot.isAvailable ? 'blue' : 'gray'}
                    disabled={!slot.isAvailable}
                    size="sm"
                    onClick={() => slot.isAvailable && onSlotSelect(slot)}
                    leftSection={<IconClock size="0.875rem" />}
                    styles={{
                      root: {
                        opacity: slot.isAvailable ? 1 : 0.5,
                      },
                    }}
                  >
                    {formatTime(slot.startTime)}
                  </Button>
                );
              })}
            </SimpleGrid>
          )}

          {selectedSlot && (
            <Badge color="blue" size="lg" mt="md" fullWidth>
              {t('availability.selectSlot')}: {formatTime(selectedSlot.startTime)}
            </Badge>
          )}
        </Paper>
      </Group>
    </Stack>
  );
}
