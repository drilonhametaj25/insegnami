'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Grid,
  Stack,
  Center,
  LoadingOverlay,
  Alert,
  ActionIcon,
  Badge,
  Table,
  ScrollArea,
  Tooltip,
  Progress,
  Card,
  ThemeIcon,
  Menu,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconRefresh,
  IconX,
  IconInfoCircle,
  IconCalendarEvent,
  IconCalendarStats,
  IconEye,
  IconEdit,
  IconTrash,
  IconCheck,
  IconClock,
  IconRocket,
  IconDownload,
  IconArchive,
  IconDotsVertical,
  IconPlayerPlay,
  IconWand,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { ModernModal } from '@/components/modals/ModernModal';
import { ScheduleForm } from '@/components/schedules/ScheduleForm';

interface Schedule {
  id: string;
  name: string;
  status: 'DRAFT' | 'GENERATED' | 'APPLIED' | 'ARCHIVED';
  startDate: string;
  endDate: string;
  score: number | null;
  generatedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  academicYear: {
    id: string;
    name: string;
  };
  _count: {
    slots: number;
  };
  stats?: {
    totalSlots: number;
    slotsGenerated: number;
    generationTimeMs: number;
  };
}

interface SchedulesResponse {
  schedules: Schedule[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

const StatusBadge = ({ status }: { status: Schedule['status'] }) => {
  const config = {
    DRAFT: { color: 'gray', label: 'Bozza', icon: IconEdit },
    GENERATED: { color: 'blue', label: 'Generato', icon: IconCheck },
    APPLIED: { color: 'green', label: 'Applicato', icon: IconPlayerPlay },
    ARCHIVED: { color: 'orange', label: 'Archiviato', icon: IconArchive },
  };
  const { color, label, icon: Icon } = config[status];

  return (
    <Badge color={color} variant="light" size="sm" leftSection={<Icon size={12} />}>
      {label}
    </Badge>
  );
};

export default function SchedulesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const [opened, { open, close }] = useDisclosure(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // Check permissions
  const canManageSchedules =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'DIRECTOR' ||
    session?.user?.role === 'SUPERADMIN';

  // Fetch schedules
  const fetchSchedules = async () => {
    if (!canManageSchedules) return;

    setLoading(true);
    try {
      const response = await fetch('/api/schedules');
      if (!response.ok) throw new Error('Failed to fetch schedules');

      const data: SchedulesResponse = await response.json();
      setSchedules(data.schedules);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare gli orari',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch academic years
  const fetchAcademicYears = async () => {
    try {
      const response = await fetch('/api/academic-years');
      if (!response.ok) throw new Error('Failed to fetch academic years');

      const data = await response.json();
      setAcademicYears(data.academicYears || []);
    } catch (error) {
      console.error('Error fetching academic years:', error);
    }
  };

  useEffect(() => {
    if (canManageSchedules) {
      fetchSchedules();
      fetchAcademicYears();
    }
  }, [canManageSchedules]);

  // Generate schedule
  const handleGenerate = async (scheduleId: string) => {
    setGenerating(scheduleId);
    try {
      notifications.show({
        id: `generating-${scheduleId}`,
        title: 'Generazione in corso...',
        message: 'Sto generando l\'orario ottimale. Potrebbe richiedere alcuni secondi.',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      const response = await fetch(`/api/schedules/${scheduleId}/generate`, {
        method: 'POST',
      });

      notifications.hide(`generating-${scheduleId}`);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generazione fallita');
      }

      if (data.success) {
        notifications.show({
          title: 'Orario Generato!',
          message: `Score: ${data.score}/100 - ${data.slotsGenerated} slot creati in ${(data.stats?.generationTimeMs || 0) / 1000}s`,
          color: 'green',
          icon: <IconCheck size={18} />,
          autoClose: 5000,
        });
      } else {
        notifications.show({
          title: 'Generazione parziale',
          message: data.warnings?.join(', ') || 'Alcuni slot non sono stati piazzati',
          color: 'yellow',
          icon: <IconInfoCircle size={18} />,
          autoClose: 8000,
        });
      }

      fetchSchedules();
    } catch (error: any) {
      notifications.hide(`generating-${scheduleId}`);
      notifications.show({
        title: 'Errore generazione',
        message: error.message,
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setGenerating(null);
    }
  };

  // Apply schedule
  const handleApply = async (scheduleId: string) => {
    modals.openConfirmModal({
      title: 'Applica Orario',
      children: (
        <Text size="sm">
          Vuoi applicare questo orario? Verranno create tutte le lezioni nel calendario
          per le prossime settimane. Questa azione non può essere annullata.
        </Text>
      ),
      labels: { confirm: 'Applica', cancel: 'Annulla' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        setApplying(scheduleId);
        try {
          notifications.show({
            id: `applying-${scheduleId}`,
            title: 'Applicazione in corso...',
            message: 'Sto creando le lezioni nel calendario',
            loading: true,
            autoClose: false,
            withCloseButton: false,
          });

          const response = await fetch(`/api/schedules/${scheduleId}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekCount: 4 }), // Crea 4 settimane di lezioni
          });

          notifications.hide(`applying-${scheduleId}`);

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Applicazione fallita');
          }

          notifications.show({
            title: 'Orario Applicato!',
            message: data.message,
            color: 'green',
            icon: <IconCheck size={18} />,
            autoClose: 5000,
          });

          fetchSchedules();
        } catch (error: any) {
          notifications.hide(`applying-${scheduleId}`);
          notifications.show({
            title: 'Errore applicazione',
            message: error.message,
            color: 'red',
            icon: <IconX size={18} />,
          });
        } finally {
          setApplying(null);
        }
      },
    });
  };

  // Delete schedule
  const handleDelete = async (scheduleId: string) => {
    modals.openConfirmModal({
      title: 'Elimina Orario',
      children: (
        <Text size="sm">
          Sei sicuro di voler eliminare questo orario? Questa azione non può essere annullata.
        </Text>
      ),
      labels: { confirm: 'Elimina', cancel: 'Annulla' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/schedules/${scheduleId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Eliminazione fallita');
          }

          notifications.show({
            title: 'Orario eliminato',
            message: 'L\'orario è stato eliminato con successo',
            color: 'green',
            icon: <IconCheck size={18} />,
          });

          fetchSchedules();
        } catch (error: any) {
          notifications.show({
            title: 'Errore eliminazione',
            message: error.message,
            color: 'red',
            icon: <IconX size={18} />,
          });
        }
      },
    });
  };

  // Create new schedule
  const handleCreate = () => {
    setEditingSchedule(null);
    open();
  };

  // View schedule details
  const handleView = (schedule: Schedule) => {
    router.push(`/${locale}/dashboard/schedules/${schedule.id}`);
  };

  // Form submit
  const handleFormSubmit = async (formData: any) => {
    try {
      const url = editingSchedule
        ? `/api/schedules/${editingSchedule.id}`
        : '/api/schedules';
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore durante il salvataggio');
      }

      notifications.show({
        title: 'Successo',
        message: editingSchedule ? 'Orario aggiornato' : 'Orario creato',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      close();
      fetchSchedules();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  // Stats calculation
  const stats = {
    total: schedules.length,
    draft: schedules.filter((s) => s.status === 'DRAFT').length,
    generated: schedules.filter((s) => s.status === 'GENERATED').length,
    applied: schedules.filter((s) => s.status === 'APPLIED').length,
    avgScore: schedules.filter((s) => s.score).reduce((sum, s) => sum + (s.score || 0), 0) /
      (schedules.filter((s) => s.score).length || 1),
  };

  if (!canManageSchedules) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading && schedules.length === 0} />

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2} mb="xs">
            Generatore Orario
          </Title>
          <Text c="dimmed">
            Genera automaticamente l'orario scolastico ottimale
          </Text>
        </div>
        <Group>
          <Button
            onClick={() => fetchSchedules()}
            variant="light"
            leftSection={<IconRefresh size={18} />}
          >
            Aggiorna
          </Button>
          <Button
            onClick={handleCreate}
            leftSection={<IconPlus size={18} />}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
            radius="lg"
          >
            Nuovo Orario
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Orari Totali"
            value={stats.total.toString()}
            icon={<IconCalendarEvent size={24} />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Bozze"
            value={stats.draft.toString()}
            icon={<IconEdit size={24} />}
            gradient="linear-gradient(135deg, #868e96 0%, #495057 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Applicati"
            value={stats.applied.toString()}
            icon={<IconCheck size={24} />}
            gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Score Medio"
            value={`${Math.round(stats.avgScore)}/100`}
            icon={<IconCalendarStats size={24} />}
            gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
          />
        </Grid.Col>
      </Grid>

      {/* Info Card - How it works */}
      {schedules.length === 0 && !loading && (
        <Card withBorder radius="lg" p="xl" mb="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="gradient" gradient={{ from: 'indigo', to: 'purple' }}>
              <IconWand size={30} />
            </ThemeIcon>
            <Title order={3}>Come funziona il generatore di orari?</Title>
            <Text c="dimmed" ta="center" maw={600}>
              Il nostro algoritmo intelligente genera automaticamente l'orario scolastico
              rispettando tutti i vincoli (nessuna sovrapposizione, ore settimanali, etc.)
              e ottimizzando per qualità (materie difficili al mattino, distribuzione equilibrata).
            </Text>
            <Group>
              <Button leftSection={<IconPlus size={18} />} onClick={handleCreate}>
                Crea il tuo primo orario
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {/* Schedules List */}
      {schedules.length > 0 && (
        <Paper shadow="sm" radius="lg" p="md">
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Anno Accademico</Table.Th>
                  <Table.Th>Periodo</Table.Th>
                  <Table.Th>Slot</Table.Th>
                  <Table.Th>Score</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th>Azioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {schedules.map((schedule) => (
                  <Table.Tr key={schedule.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">
                        {schedule.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Creato il{' '}
                        {new Date(schedule.createdAt).toLocaleDateString('it-IT')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue">
                        {schedule.academicYear.name}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(schedule.startDate).toLocaleDateString('it-IT')} -{' '}
                        {new Date(schedule.endDate).toLocaleDateString('it-IT')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Text size="sm" fw={500}>
                          {schedule._count.slots}
                        </Text>
                        <Text size="xs" c="dimmed">
                          lezioni
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {schedule.score !== null ? (
                        <Group gap="xs">
                          <Progress
                            value={schedule.score}
                            size="sm"
                            w={60}
                            color={
                              schedule.score >= 80
                                ? 'green'
                                : schedule.score >= 60
                                ? 'yellow'
                                : 'red'
                            }
                          />
                          <Text size="sm" fw={500}>
                            {schedule.score}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={schedule.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Visualizza">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => handleView(schedule)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>

                        {schedule.status === 'DRAFT' && (
                          <Tooltip label="Genera orario">
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="indigo"
                              onClick={() => handleGenerate(schedule.id)}
                              loading={generating === schedule.id}
                            >
                              <IconRocket size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}

                        {schedule.status === 'GENERATED' && (
                          <>
                            <Tooltip label="Rigenera orario">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="indigo"
                                onClick={() => handleGenerate(schedule.id)}
                                loading={generating === schedule.id}
                              >
                                <IconRocket size={14} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Applica (crea lezioni)">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="green"
                                onClick={() => handleApply(schedule.id)}
                                loading={applying === schedule.id}
                              >
                                <IconPlayerPlay size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}

                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <ActionIcon size="sm" variant="subtle">
                              <IconDotsVertical size={14} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEye size={14} />}
                              onClick={() => handleView(schedule)}
                            >
                              Visualizza dettagli
                            </Menu.Item>
                            {schedule.status !== 'APPLIED' && (
                              <>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => handleDelete(schedule.id)}
                                >
                                  Elimina
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Create/Edit Modal */}
      <ModernModal
        opened={opened}
        onClose={close}
        title={editingSchedule ? 'Modifica Orario' : 'Nuovo Orario'}
        size="lg"
      >
        <ScheduleForm
          academicYears={academicYears}
          initialData={editingSchedule}
          onSubmit={handleFormSubmit}
          onCancel={close}
        />
      </ModernModal>
    </Container>
  );
}
