'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Button,
  Group,
  Text,
  Alert,
  LoadingOverlay,
  Badge,
  Grid,
  Card,
  ActionIcon,
  Tooltip,
  Paper,
  Table,
  Accordion,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { AcademicYearForm } from '@/components/forms/AcademicYearForm';
import { AcademicPeriodForm } from '@/components/forms/AcademicPeriodForm';
import {
  useAcademicYears,
  useCreateAcademicYear,
  useUpdateAcademicYear,
  useDeleteAcademicYear,
  useSetCurrentAcademicYear,
  useCreatePeriod,
  useUpdatePeriod,
  useDeletePeriod,
  AcademicYear,
  AcademicPeriod,
  CreateAcademicYearData,
  CreatePeriodData,
} from '@/lib/hooks/useAcademicYears';

export default function AcademicYearsPage() {
  const { data: session } = useSession();
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');

  const [yearOpened, { open: openYear, close: closeYear }] = useDisclosure(false);
  const [periodOpened, { open: openPeriod, close: closePeriod }] = useDisclosure(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  // React Query hooks
  const { data: yearsData, isLoading, refetch } = useAcademicYears(1, 50, { all: true });
  const createYear = useCreateAcademicYear();
  const updateYear = useUpdateAcademicYear();
  const deleteYear = useDeleteAcademicYear();
  const setCurrent = useSetCurrentAcademicYear();
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();

  // Check permissions
  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  const academicYears = yearsData?.academicYears || [];

  // Calculate stats
  const totalYears = academicYears.length;
  const currentYear = academicYears.find((y) => y.isCurrent);
  const totalPeriods = academicYears.reduce((acc, y) => acc + (y.periods?.length || 0), 0);
  const totalGrades = academicYears.reduce((acc, y) => acc + (y._count?.grades || 0), 0);

  // Year handlers
  const handleCreateYear = () => {
    setEditingYear(null);
    openYear();
  };

  const handleEditYear = (year: AcademicYear) => {
    setEditingYear(year);
    openYear();
  };

  const handleDeleteYear = (year: AcademicYear) => {
    modals.openConfirmModal({
      title: t('confirmDeleteYear'),
      children: (
        <Text size="sm">
          {t('confirmDeleteYearMessage', { name: year.name })}
        </Text>
      ),
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteYear.mutateAsync(year.id);
          notifications.show({
            title: tCommon('success'),
            message: t('deleteSuccess'),
            color: 'green',
            icon: <IconCheck />,
          });
        } catch (error) {
          notifications.show({
            title: tCommon('error'),
            message: error instanceof Error ? error.message : t('deleteError'),
            color: 'red',
            icon: <IconX />,
          });
        }
      },
    });
  };

  const handleSetCurrent = async (year: AcademicYear) => {
    try {
      await setCurrent.mutateAsync(year.id);
      notifications.show({
        title: tCommon('success'),
        message: t('setCurrentSuccess', { name: year.name }),
        color: 'green',
        icon: <IconCheck />,
      });
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: t('setCurrentError'),
        color: 'red',
        icon: <IconX />,
      });
    }
  };

  const handleSaveYear = async (data: CreateAcademicYearData) => {
    if (editingYear) {
      await updateYear.mutateAsync({ id: editingYear.id, data });
    } else {
      await createYear.mutateAsync(data);
    }
  };

  // Period handlers
  const handleCreatePeriod = (year: AcademicYear) => {
    setSelectedYear(year);
    setEditingPeriod(null);
    openPeriod();
  };

  const handleEditPeriod = (year: AcademicYear, period: AcademicPeriod) => {
    setSelectedYear(year);
    setEditingPeriod(period);
    openPeriod();
  };

  const handleDeletePeriod = (year: AcademicYear, period: AcademicPeriod) => {
    modals.openConfirmModal({
      title: t('confirmDeletePeriod'),
      children: (
        <Text size="sm">
          {t('confirmDeletePeriodMessage', { name: period.name })}
        </Text>
      ),
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deletePeriod.mutateAsync({
            academicYearId: year.id,
            periodId: period.id,
          });
          notifications.show({
            title: tCommon('success'),
            message: t('periodDeleteSuccess'),
            color: 'green',
            icon: <IconCheck />,
          });
        } catch (error) {
          notifications.show({
            title: tCommon('error'),
            message: error instanceof Error ? error.message : t('periodDeleteError'),
            color: 'red',
            icon: <IconX />,
          });
        }
      },
    });
  };

  const handleSavePeriod = async (data: CreatePeriodData) => {
    if (!selectedYear) return;

    if (editingPeriod) {
      await updatePeriod.mutateAsync({
        academicYearId: selectedYear.id,
        periodId: editingPeriod.id,
        data,
      });
    } else {
      await createPeriod.mutateAsync({
        academicYearId: selectedYear.id,
        data,
      });
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!canManage) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          {t('noPermission')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && academicYears.length === 0} />

      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{t('title')}</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => refetch()}
              loading={isLoading}
            >
              {tCommon('refresh')}
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleCreateYear}>
              {t('addYear')}
            </Button>
          </Group>
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('totalYears')}
              value={totalYears}
              icon="📅"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('currentYear')}
              value={currentYear?.name || '-'}
              icon="⭐"
              gradient="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('totalPeriods')}
              value={totalPeriods}
              icon="📆"
              gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('totalGrades')}
              value={totalGrades}
              icon="📝"
              gradient="linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)"
            />
          </Grid.Col>
        </Grid>

        {/* Academic Years List */}
        <Accordion variant="separated" radius="md">
          {academicYears.map((year) => (
            <Accordion.Item key={year.id} value={year.id}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap">
                  <Group>
                    <ThemeIcon
                      size="lg"
                      radius="md"
                      color={year.isCurrent ? 'yellow' : 'blue'}
                      variant="light"
                    >
                      <IconCalendar size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{year.name}</Text>
                      <Text size="xs" c="dimmed">
                        {formatDate(year.startDate)} - {formatDate(year.endDate)}
                      </Text>
                    </div>
                  </Group>
                  <Group gap="xs">
                    {year.isCurrent && (
                      <Badge color="yellow" leftSection={<IconStarFilled size={12} />}>
                        {t('current')}
                      </Badge>
                    )}
                    <Badge variant="light">
                      {year.periods?.length || 0} {t('periodsCount')}
                    </Badge>
                    <Badge variant="light" color="grape">
                      {year._count?.grades || 0} {t('gradesCount')}
                    </Badge>
                  </Group>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  {/* Year Actions */}
                  <Group justify="space-between">
                    <Group gap="xs">
                      {!year.isCurrent && (
                        <Button
                          size="xs"
                          variant="light"
                          color="yellow"
                          leftSection={<IconStar size={14} />}
                          onClick={() => handleSetCurrent(year)}
                          loading={setCurrent.isPending}
                        >
                          {t('setCurrent')}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditYear(year)}
                      >
                        {tCommon('edit')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleDeleteYear(year)}
                      >
                        {tCommon('delete')}
                      </Button>
                    </Group>
                    <Button
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => handleCreatePeriod(year)}
                    >
                      {t('addPeriod')}
                    </Button>
                  </Group>

                  {/* Periods Table */}
                  {year.periods && year.periods.length > 0 ? (
                    <Paper withBorder p="md" radius="md">
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t('periodName')}</Table.Th>
                            <Table.Th>{t('periodType')}</Table.Th>
                            <Table.Th>{t('startDate')}</Table.Th>
                            <Table.Th>{t('endDate')}</Table.Th>
                            <Table.Th>{tCommon('actions')}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {year.periods.map((period) => (
                            <Table.Tr key={period.id}>
                              <Table.Td>
                                <Text fw={500}>{period.name}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" size="sm">
                                  {period.type}
                                </Badge>
                              </Table.Td>
                              <Table.Td>{formatDate(period.startDate)}</Table.Td>
                              <Table.Td>{formatDate(period.endDate)}</Table.Td>
                              <Table.Td>
                                <Group gap="xs">
                                  <Tooltip label={tCommon('edit')}>
                                    <ActionIcon
                                      variant="light"
                                      color="yellow"
                                      size="sm"
                                      onClick={() => handleEditPeriod(year, period)}
                                    >
                                      <IconEdit size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label={tCommon('delete')}>
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      size="sm"
                                      onClick={() => handleDeletePeriod(year, period)}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Paper>
                  ) : (
                    <Paper withBorder p="md" radius="md" ta="center">
                      <Text c="dimmed">{t('noPeriods')}</Text>
                    </Paper>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>

        {academicYears.length === 0 && !isLoading && (
          <Paper withBorder p="xl" radius="md" ta="center">
            <IconCalendar size={48} color="gray" />
            <Text c="dimmed" mt="md">{t('noYears')}</Text>
            <Button mt="md" onClick={handleCreateYear}>
              {t('addFirstYear')}
            </Button>
          </Paper>
        )}
      </Stack>

      {/* Academic Year Form Modal */}
      <AcademicYearForm
        opened={yearOpened}
        onClose={closeYear}
        academicYear={editingYear}
        onSave={handleSaveYear}
        loading={createYear.isPending || updateYear.isPending}
      />

      {/* Period Form Modal */}
      <AcademicPeriodForm
        opened={periodOpened}
        onClose={closePeriod}
        period={editingPeriod}
        yearStartDate={selectedYear ? new Date(selectedYear.startDate) : undefined}
        yearEndDate={selectedYear ? new Date(selectedYear.endDate) : undefined}
        onSave={handleSavePeriod}
        loading={createPeriod.isPending || updatePeriod.isPending}
      />
    </Container>
  );
}
