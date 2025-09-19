'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Paper,
  Tabs,
  Group,
  Avatar,
  Badge,
  Button,
  Grid,
  Stack,
  LoadingOverlay,
  Alert,
  ActionIcon,
  Progress,
  Card,
  Table,
  Menu,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBook2,
  IconUsers,
  IconCalendarEvent,
  IconChecklist,
  IconFileText,
  IconSchool,
  IconEdit,
  IconMail,
  IconPhone,
  IconTrendingUp,
  IconX,
  IconInfoCircle,
  IconClock,
  IconChartBar,
  IconDotsVertical,
  IconTrash,
  IconBooks,
  IconUser,
  IconCalendar,
  IconAlertCircle,
  IconEye,
  IconUserPlus,
  IconUserMinus,
  IconCheck,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

interface ClassDetail {
  id: string;
  code: string;
  name: string;
  maxStudents: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  course: {
    id: string;
    name: string;
    level: string;
    category?: string;
    description?: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  students: Array<{
    id: string;
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      studentCode?: string;
    };
    enrolledAt: string;
    isActive: boolean;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    room?: string;
    description?: string;
  }>;
  _count: {
    students: number;
    lessons: number;
  };
  createdAt: string;
}

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Check permissions
  const canManageClasses = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
  const canViewClasses = canManageClasses || session?.user?.role === 'TEACHER';

  // Fetch class data
  const fetchClassData = async () => {
    if (!resolvedParams?.id || !canViewClasses) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}?include=course,teacher,students,lessons`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Classe non trovata');
        } else if (response.status === 403) {
          setError('Non hai i permessi per accedere a questa classe');
        } else {
          setError('Errore nel caricamento dei dati');
        }
        return;
      }
      
      const data: ClassDetail = await response.json();
      setClassData(data);
    } catch (error: any) {
      console.error('Error fetching class data:', error);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (resolvedParams?.id) {
      fetchClassData();
    }
  }, [resolvedParams?.id, canViewClasses]);

  const handleEdit = () => {
    router.push(`/${locale}/dashboard/classes/edit/${resolvedParams?.id}`);
  };

  const handleDelete = async () => {
    if (!resolvedParams?.id || !classData) return;
    
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete class');
      }

      notifications.show({
        title: 'Successo',
        message: 'Classe eliminata con successo',
        color: 'green',
        icon: <IconCheck size={18} />
      });

      router.push(`/${locale}/dashboard/classes`);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile eliminare la classe',
        color: 'red',
        icon: <IconX size={18} />
      });
    } finally {
      closeDeleteModal();
    }
  };

  // Permission check
  if (!canViewClasses) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Accesso negato" color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Errore" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  // No data state
  if (!classData) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title="Non trovato" color="yellow">
          Classe non trovata
        </Alert>
      </Container>
    );
  }

  // Calculate stats
  const totalStudents = classData.students?.length || 0;
  const maxStudents = classData.maxStudents || 0;
  const totalLessons = classData.lessons?.length || 0;
  const completedLessons = classData.lessons?.filter((lesson: any) => lesson.status === 'COMPLETED').length || 0;
  const occupancyRate = maxStudents > 0 ? Math.round((totalStudents / maxStudents) * 100) : 0;

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group mb="xl">
        <ActionIcon
          onClick={() => router.push(`/${locale}/dashboard/classes`)}
          variant="subtle"
          size="lg"
        >
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div style={{ flex: 1 }}>
          <Group justify="space-between">
            <div>
              <Title order={2} mb="xs">
                {classData.name}
              </Title>
              <Text c="dimmed">
                {classData.course?.name || 'Corso non specificato'} • {classData.course?.level || 'Livello non specificato'}
              </Text>
            </div>
            {canManageClasses && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg">
                    <IconDotsVertical size="1.2rem" />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<IconEdit size="1rem" />} onClick={handleEdit}>
                    Modifica
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item 
                    leftSection={<IconTrash size="1rem" />} 
                    color="red"
                    onClick={openDeleteModal}
                  >
                    Elimina
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </div>
      </Group>

      {/* Class Info Header Card */}
      <Paper p="xl" mb="xl" radius="lg" style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white' 
      }}>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <div>
                <Text size="sm" mb={4} style={{ opacity: 0.9 }}>
                  Codice Classe
                </Text>
                <Text size="lg" fw={700}>
                  {classData.code}
                </Text>
              </div>
              <Group gap="xl">
                <div>
                  <Text size="sm" mb={4} style={{ opacity: 0.9 }}>
                    Docente
                  </Text>
                  <Group gap="sm">
                    <Avatar size="sm" color="rgba(255,255,255,0.2)">
                      {classData.teacher?.firstName?.[0] || '?'}{classData.teacher?.lastName?.[0] || '?'}
                    </Avatar>
                    <div>
                      <Text fw={500}>
                        {classData.teacher ? `${classData.teacher.firstName} ${classData.teacher.lastName}` : 'Docente non assegnato'}
                      </Text>
                      <Text size="xs" style={{ opacity: 0.8 }}>
                        {classData.teacher?.email || 'Email non disponibile'}
                      </Text>
                    </div>
                  </Group>
                </div>
                <div>
                  <Text size="sm" mb={4} style={{ opacity: 0.9 }}>
                    Periodo
                  </Text>
                  <Text fw={500}>
                    {new Date(classData.startDate).toLocaleDateString('it-IT')}
                    {classData.endDate && ` - ${new Date(classData.endDate).toLocaleDateString('it-IT')}`}
                  </Text>
                </div>
              </Group>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <div style={{ textAlign: 'right' }}>
              <Badge
                size="lg"
                variant="light"
                style={{ 
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  marginBottom: '1rem'
                }}
              >
                {classData.isActive ? 'Attiva' : 'Inattiva'}
              </Badge>
              <div>
                <Text size="sm" mb={4} style={{ opacity: 0.9 }}>
                  Studenti
                </Text>
                <Text size="2rem" fw={700} lh={1}>
                  {totalStudents}/{maxStudents}
                </Text>
                <Progress
                  value={occupancyRate}
                  size="xs"
                  color="rgba(255,255,255,0.7)"
                  style={{ marginTop: '0.5rem' }}
                />
              </div>
            </div>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Studenti Iscritti"
            value={`${totalStudents}/${maxStudents}`}
            icon={<IconUsers size={24} />}
            gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            progress={{
              value: occupancyRate,
              label: 'Capacità',
              color: 'blue' as const,
            }}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Lezioni Totali"
            value={totalLessons.toString()}
            icon={<IconBook2 size={24} />}
            gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Lezioni Completate"
            value={completedLessons.toString()}
            icon={<IconChecklist size={24} />}
            gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <ModernStatsCard
            title="Tasso Occupazione"
            value={`${occupancyRate}%`}
            icon={<IconChartBar size={24} />}
            gradient="linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)"
          />
        </Grid.Col>
      </Grid>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List mb="xl">
          <Tabs.Tab value="overview" leftSection={<IconBook2 size={18} />}>
            Panoramica
          </Tabs.Tab>
          <Tabs.Tab value="students" leftSection={<IconUsers size={18} />}>
            Studenti ({totalStudents})
          </Tabs.Tab>
          <Tabs.Tab value="lessons" leftSection={<IconCalendarEvent size={18} />}>
            Lezioni ({totalLessons})
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconChecklist size={18} />}>
            Presenze
          </Tabs.Tab>
          <Tabs.Tab value="materials" leftSection={<IconFileText size={18} />}>
            Materiali
          </Tabs.Tab>
          <Tabs.Tab value="assignments" leftSection={<IconSchool size={18} />}>
            Compiti
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper p="md" radius="lg" withBorder style={{ height: '100%' }}>
                <Title order={4} mb="md">
                  <Group gap="sm">
                    <IconInfoCircle size={20} />
                    Informazioni Classe
                  </Group>
                </Title>
                <Stack gap="md">
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>Corso</Text>
                    <Text fw={500}>{classData.course?.name || 'Non specificato'}</Text>
                    <Text size="sm" c="dimmed">{classData.course?.level || 'Livello non specificato'}</Text>
                  </div>
                  {classData.course?.description && (
                    <>
                      <div>
                        <Text size="sm" c="dimmed" mb={4}>Descrizione</Text>
                        <Text size="sm">{classData.course.description}</Text>
                      </div>
                    </>
                  )}
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>Categoria</Text>
                    <Badge variant="light">{classData.course?.category || 'Generale'}</Badge>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper p="md" radius="lg" withBorder style={{ height: '100%' }}>
                <Title order={4} mb="md">
                  <Group gap="sm">
                    <IconChartBar size={20} />
                    Statistiche
                  </Group>
                </Title>
                <Stack gap="lg">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Riempimento Classe</Text>
                      <Text size="sm" fw={500}>{occupancyRate}%</Text>
                    </Group>
                    <Progress 
                      value={occupancyRate} 
                      color={occupancyRate > 90 ? 'red' : occupancyRate > 70 ? 'yellow' : 'green'}
                      size="sm" 
                    />
                  </div>
                  
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Progresso Lezioni</Text>
                      <Text size="sm" fw={500}>
                        {totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0}%
                      </Text>
                    </Group>
                    <Progress 
                      value={totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0} 
                      color="green" 
                      size="sm" 
                    />
                  </div>

                  <div>
                    <Text size="sm" c="dimmed" mb={4}>Posti Disponibili</Text>
                    <Text size="lg" fw={500}>{maxStudents - totalStudents}</Text>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Paper p="md" radius="lg" withBorder style={{ height: '100%' }}>
                <Title order={4} mb="md">
                  <Group gap="sm">
                    <IconClock size={20} />
                    Attività Recente
                  </Group>
                </Title>
                <Stack gap="md">
                  <div>
                    <Text fw={500} size="sm">Ultima Lezione</Text>
                    <Text size="sm" c="dimmed">
                      {(classData.lessons && classData.lessons.length > 0) ? 
                        new Date(classData.lessons[0].startTime).toLocaleDateString('it-IT') : 
                        'Nessuna lezione'
                      }
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">Prossima Lezione</Text>
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const scheduledLesson = classData.lessons?.find((lesson: any) => lesson.status === 'SCHEDULED');
                        return scheduledLesson ? 
                          new Date(scheduledLesson.startTime).toLocaleDateString('it-IT') :
                          'Nessuna lezione programmata';
                      })()}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">Data Creazione</Text>
                    <Text size="sm" c="dimmed">
                      {new Date(classData.createdAt).toLocaleDateString('it-IT')}
                    </Text>
                  </div>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Students Tab */}
        <Tabs.Panel value="students">
          <Paper p="lg" radius="lg" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={4}>Studenti Iscritti</Title>
                <Text size="sm" c="dimmed">
                  {totalStudents} studenti su {maxStudents} posti disponibili
                </Text>
              </div>
              {canManageClasses && (
                <Button
                  leftSection={<IconUserPlus size={16} />}
                  onClick={() => router.push(`/${locale}/dashboard/classes/${resolvedParams?.id}/enroll`)}
                >
                  Iscrivi Studente
                </Button>
              )}
            </Group>

            {totalStudents > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Contatto</Table.Th>
                    <Table.Th>Data Iscrizione</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    {canManageClasses && <Table.Th>Azioni</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {classData.students?.map((enrollment: any) => (
                    <Table.Tr key={enrollment.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar size="sm" color="blue">
                            {enrollment.student.firstName[0]}{enrollment.student.lastName[0]}
                          </Avatar>
                          <div>
                            <Text 
                              fw={500} 
                              size="sm" 
                              c="blue" 
                              style={{ cursor: 'pointer' }}
                              onClick={() => router.push(`/${locale}/dashboard/students/${enrollment.student.id}`)}
                            >
                              {enrollment.student.firstName} {enrollment.student.lastName}
                            </Text>
                            {enrollment.student.studentCode && (
                              <Text size="xs" c="dimmed">
                                #{enrollment.student.studentCode}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap="xs">
                          <Group gap="xs">
                            <IconMail size={14} />
                            <Text size="sm">{enrollment.student.email}</Text>
                          </Group>
                          {enrollment.student.phone && (
                            <Group gap="xs">
                              <IconPhone size={14} />
                              <Text size="sm">{enrollment.student.phone}</Text>
                            </Group>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(enrollment.enrolledAt).toLocaleDateString('it-IT')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={enrollment.isActive ? 'green' : 'red'}
                          variant="light"
                        >
                          {enrollment.isActive ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </Table.Td>
                      {canManageClasses && (
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => router.push(`/${locale}/dashboard/students/${enrollment.student.id}`)}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                notifications.show({
                                  title: 'Funzionalità in sviluppo',
                                  message: 'La cancellazione dell\'iscrizione sarà disponibile presto',
                                  color: 'blue'
                                });
                              }}
                            >
                              <IconUserMinus size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                <IconUsers size={48} color="var(--mantine-color-gray-4)" />
                <Text size="lg" fw={500} mt="md" c="dimmed">
                  Nessuno studente iscritto
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Inizia iscrivendo il primo studente alla classe
                </Text>
                {canManageClasses && (
                  <Button
                    onClick={() => router.push(`/${locale}/dashboard/classes/${resolvedParams?.id}/enroll`)}
                  >
                    Iscrivi Primo Studente
                  </Button>
                )}
              </Paper>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Lessons Tab */}
        <Tabs.Panel value="lessons">
          <Paper p="lg" radius="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Lezioni della Classe</Title>
              {canManageClasses && (
                <Button
                  leftSection={<IconCalendarEvent size={16} />}
                  onClick={() => router.push(`/${locale}/dashboard/lessons/new?classId=${resolvedParams?.id}`)}
                >
                  Aggiungi Lezione
                </Button>
              )}
            </Group>
            
            {totalLessons > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Titolo</Table.Th>
                    <Table.Th>Orario</Table.Th>
                    <Table.Th>Durata</Table.Th>
                    <Table.Th>Stato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {classData.lessons?.map((lesson: any) => (
                    <Table.Tr 
                      key={lesson.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/${locale}/dashboard/lessons/${lesson.id}`)}
                    >
                      <Table.Td>{new Date(lesson.startTime).toLocaleDateString('it-IT')}</Table.Td>
                      <Table.Td>{lesson.title || '-'}</Table.Td>
                      <Table.Td>
                        {new Date(lesson.startTime).toLocaleTimeString('it-IT', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - {' '}
                        {new Date(lesson.endTime).toLocaleTimeString('it-IT', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Table.Td>
                      <Table.Td>
                        {Math.round((new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) / (1000 * 60))} min
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={
                            lesson.status === 'COMPLETED' ? 'green' : 
                            lesson.status === 'CANCELLED' ? 'red' : 
                            'blue'
                          }
                        >
                          {lesson.status === 'COMPLETED' ? 'Completata' : 
                           lesson.status === 'CANCELLED' ? 'Annullata' : 'Programmata'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                <IconCalendarEvent size={48} color="var(--mantine-color-gray-4)" />
                <Text size="lg" fw={500} mt="md" c="dimmed">
                  Nessuna lezione programmata
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Inizia aggiungendo la prima lezione per questa classe
                </Text>
                {canManageClasses && (
                  <Button
                    onClick={() => router.push(`/${locale}/dashboard/lessons/new?classId=${resolvedParams?.id}`)}
                  >
                    Aggiungi Prima Lezione
                  </Button>
                )}
              </Paper>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Attendance Tab */}
        <Tabs.Panel value="attendance">
          <Paper p="xl" radius="lg" withBorder>
            <Group mb="md">
              <IconChecklist size={24} />
              <Title order={4}>Gestione Presenze</Title>
            </Group>
            <Alert icon={<IconInfoCircle />} color="blue" mb="md">
              Funzionalità presenze in fase di sviluppo avanzato
            </Alert>
            <Text c="dimmed">
              Qui potrai gestire le presenze degli studenti per ogni lezione, 
              visualizzare statistiche dettagliate e generare report.
            </Text>
          </Paper>
        </Tabs.Panel>

        {/* Materials Tab */}
        <Tabs.Panel value="materials">
          <Paper p="xl" radius="lg" withBorder>
            <Group mb="md">
              <IconFileText size={24} />
              <Title order={4}>Materiali Didattici</Title>
            </Group>
            <Alert icon={<IconInfoCircle />} color="blue" mb="md">
              Funzionalità materiali in fase di sviluppo avanzato
            </Alert>
            <Text c="dimmed">
              Qui potrai caricare e gestire i materiali didattici per la classe,
              organizzarli per lezioni e condividerli con gli studenti.
            </Text>
          </Paper>
        </Tabs.Panel>

        {/* Assignments Tab */}
        <Tabs.Panel value="assignments">
          <Paper p="xl" radius="lg" withBorder>
            <Group mb="md">
              <IconSchool size={24} />
              <Title order={4}>Compiti e Valutazioni</Title>
            </Group>
            <Alert icon={<IconInfoCircle />} color="blue" mb="md">
              Funzionalità compiti in fase di sviluppo avanzato
            </Alert>
            <Text c="dimmed">
              Qui potrai assegnare compiti agli studenti, gestire le consegne
              e valutare i loro progressi.
            </Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Conferma eliminazione"
        centered
      >
        <Text mb="md">
          Sei sicuro di voler eliminare la classe "{classData.name}"? 
          Questa azione non può essere annullata.
        </Text>
        <Group justify="flex-end">
          <Button variant="outline" onClick={closeDeleteModal}>
            Annulla
          </Button>
          <Button color="red" onClick={handleDelete}>
            Elimina
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
