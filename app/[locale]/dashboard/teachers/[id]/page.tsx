'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  Container,
  Title,
  Text,
  Card,
  Grid,
  Stack,
  Group,
  Badge,
  Button,
  ActionIcon,
  Avatar,
  Divider,
  Tabs,
  Paper,
  SimpleGrid,
  Progress,
  Alert,
  LoadingOverlay,
  List,
  ThemeIcon,
} from '@mantine/core';
import {
  IconUser,
  IconMail,
  IconPhone,
  IconCalendarEvent,
  IconUsers,
  IconChartBar,
  IconEdit,
  IconArrowLeft,
  IconClock,
  IconMapPin,
  IconBook,
  IconTrendingUp,
  IconAward,
  IconAlertCircle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { AdvancedDataTable } from '@/components/tables/AdvancedDataTable';
import { AdvancedLessonCalendar } from '@/components/calendar/AdvancedLessonCalendar';
import { TeacherForm } from '@/components/forms/TeacherForm';

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const teacherId = params.id as string;
  const [opened, { open, close }] = useDisclosure(false);
  
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [teacher, setTeacher] = useState<any>(null); // Iniziamo con null invece di mock
  const [lessons, setLessons] = useState<any[]>([]); // State per le lezioni reali
  const [submitting, setSubmitting] = useState(false);

  // Fetch teacher data
  useEffect(() => {
    const fetchTeacher = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/teachers/${teacherId}`);
        if (!response.ok) throw new Error('Failed to fetch teacher');
        
        const teacherData = await response.json();
        setTeacher(teacherData);
      } catch (error) {
        console.error('Error fetching teacher:', error);
        notifications.show({
          title: 'Errore',
          message: 'Impossibile caricare i dati del docente',
          color: 'red',
          icon: <IconX size={18} />,
        });
      } finally {
        setIsLoading(false);
      }
    };

    const fetchLessons = async () => {
      try {
        // TODO: Implementare API per le lezioni del docente
        // const response = await fetch(`/api/teachers/${teacherId}/lessons`);
        // const lessonsData = await response.json();
        // setLessons(lessonsData);
      } catch (error) {
        console.error('Error fetching lessons:', error);
      }
    };

    fetchTeacher();
    fetchLessons();
  }, [teacherId]);

  // Mock loading state
  // const lessons = mockLessons;

  const handleEdit = () => {
    open();
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      
      // Mostra notifica di caricamento
      const loadingNotification = notifications.show({
        id: 'updating-teacher',
        title: '⏳ Salvataggio in corso...',
        message: 'Aggiornamento dei dati del docente',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      // Nasconde la notifica di caricamento
      notifications.hide('updating-teacher');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update teacher');
      }

      const responseData = await response.json();
      // L'API restituisce { message, teacher }
      const updatedTeacher = responseData.teacher || responseData;
      setTeacher(updatedTeacher);

      notifications.show({
        title: '✅ Successo',
        message: responseData.message || 'Docente aggiornato con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

      close();
    } catch (error: any) {
      // Nasconde la notifica di caricamento in caso di errore
      notifications.hide('updating-teacher');
      
      console.error('Error updating teacher:', error);
      notifications.show({
        title: '❌ Errore',
        message: error.message || 'Impossibile aggiornare il docente',
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'INACTIVE': return 'gray';
      case 'SUSPENDED': return 'red';
      default: return 'blue';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Attivo';
      case 'INACTIVE': return 'Inattivo';
      case 'SUSPENDED': return 'Sospeso';
      default: return status;
    }
  };

  const lessonColumns = [
    {
      accessorKey: 'date',
      header: 'Data',
      cell: ({ row }: any) => format(new Date(row.original.date), 'dd/MM/yyyy', { locale: it }),
    },
    {
      accessorKey: 'title',
      header: 'Lezione',
    },
    {
      accessorKey: 'class',
      header: 'Classe',
    },
    {
      accessorKey: 'time',
      header: 'Orario',
      cell: ({ row }: any) => `${row.original.startTime} - ${row.original.endTime}`,
    },
    {
      accessorKey: 'room',
      header: 'Aula',
    },
    {
      accessorKey: 'status',
      header: 'Stato',
      cell: ({ row }: any) => {
        const status = row.original.status;
        const colors = {
          completed: 'green',
          scheduled: 'blue',
          cancelled: 'red',
          in_progress: 'yellow'
        };
        const labels = {
          completed: 'Completata',
          scheduled: 'Programmata',
          cancelled: 'Annullata',
          in_progress: 'In corso'
        };
        return (
          <Badge color={colors[status as keyof typeof colors] || 'gray'}>
            {labels[status as keyof typeof labels] || status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'attendance',
      header: 'Presenze',
      cell: ({ row }: any) => {
        const attendance = row.original.attendance;
        if (!attendance) return '-';
        const percentage = Math.round((attendance.present / attendance.total) * 100);
        return `${attendance.present}/${attendance.total} (${percentage}%)`;
      },
    },
  ];

  // Early return se teacher non è caricato
  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible={true} />
        <div style={{ height: '400px' }} />
      </Container>
    );
  }

  if (!teacher) {
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertCircle />} color="red">
          Docente non trovato
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading} />
      
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => router.back()}
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>Dettagli Docente</Title>
            <Text c="dimmed">Informazioni complete e gestione</Text>
          </div>
        </Group>
        
        <Group>
          <Button
            leftSection={<IconEdit size={16} />}
            onClick={handleEdit}
          >
            Modifica
          </Button>
        </Group>
      </Group>

      {/* Teacher Profile Card */}
      <Card withBorder radius="lg" mb="xl" p="xl">
        <Group align="flex-start">
          <Avatar
            src={teacher.avatar}
            size={120}
            radius="md"
          >
            <IconUser size={60} />
          </Avatar>
          
          <Stack gap="sm" style={{ flex: 1 }}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={3} mb={4}>
                  {teacher.firstName} {teacher.lastName}
                </Title>
                <Badge
                  color={getStatusColor(teacher.status)}
                  size="lg"
                  mb="sm"
                >
                  {getStatusLabel(teacher.status)}
                </Badge>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <Group gap="xs">
                <IconMail size={16} color="#868e96" />
                <Text size="sm">{teacher.email}</Text>
              </Group>
              <Group gap="xs">
                <IconPhone size={16} color="#868e96" />
                <Text size="sm">{teacher.phone || 'Non specificato'}</Text>
              </Group>
              <Group gap="xs">
                <IconCalendarEvent size={16} color="#868e96" />
                <Text size="sm">
                  Assunto: {teacher.hireDate ? 
                    (() => {
                      try {
                        const date = new Date(teacher.hireDate);
                        return isNaN(date.getTime()) ? 'Data non valida' : format(date, 'dd/MM/yyyy', { locale: it });
                      } catch {
                        return 'Data non valida';
                      }
                    })()
                    : 'Non specificata'
                  }
                </Text>
              </Group>
              <Group gap="xs">
                <IconBook size={16} color="#868e96" />
                <Text size="sm">
                  Materie: {teacher.specializations || 'Non specificate'}
                </Text>
              </Group>
            </SimpleGrid>

            {teacher.biography && (
              <>
                <Divider my="sm" />
                <Text size="sm" c="dimmed">{teacher.biography}</Text>
              </>
            )}
          </Stack>
        </Group>
      </Card>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
        <ModernStatsCard
          title="Classi Totali"
          value={(teacher.classes?.length || teacher.stats?.totalClasses || 0).toString()}
          change={{ value: 0, type: "neutral", period: "rispetto al mese scorso" }}
          icon={<IconUsers size={20} />}
          gradient="blue"
        />
        <ModernStatsCard
          title="Studenti"
          value={(teacher.stats?.totalStudents || 0).toString()}
          change={{ value: 5, type: "increase", period: "rispetto al mese scorso" }}
          icon={<IconUser size={20} />}
          gradient="green"
        />
        <ModernStatsCard
          title="Lezioni"
          value={(teacher.stats?.totalLessons || 0).toString()}
          change={{ value: 12, type: "increase", period: "rispetto al mese scorso" }}
          icon={<IconBook size={20} />}
          gradient="violet"
        />
        <ModernStatsCard
          title="Presenze Media"
          value={`${teacher.stats?.averageAttendance || 0}%`}
          change={{ value: 3, type: "increase", period: "rispetto al mese scorso" }}
          icon={<IconTrendingUp size={20} />}
          gradient="orange"
        />
      </SimpleGrid>

      {/* Tabs Content */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
            Panoramica
          </Tabs.Tab>
          <Tabs.Tab value="classes" leftSection={<IconUsers size={16} />}>
            Classi
          </Tabs.Tab>
          <Tabs.Tab value="lessons" leftSection={<IconCalendarEvent size={16} />}>
            Lezioni
          </Tabs.Tab>
          <Tabs.Tab value="calendar" leftSection={<IconClock size={16} />}>
            Calendario
          </Tabs.Tab>
          <Tabs.Tab value="qualifications" leftSection={<IconAward size={16} />}>
            Qualifiche
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            {/* Performance Overview */}
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Performance Mensile</Title>
              <Stack gap="md">
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Ore Insegnamento</Text>
                    <Text size="sm" c="dimmed">{teacher.stats?.monthlyHours || 0} ore</Text>
                  </Group>
                  <Progress value={75} color="blue" />
                </div>
                
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Lezioni Completate</Text>
                    <Text size="sm" c="dimmed">
                      {teacher.stats?.completedLessons || 0}/{teacher.stats?.totalLessons || 0}
                    </Text>
                  </Group>
                  <Progress 
                    value={teacher.stats?.completedLessons && teacher.stats?.totalLessons ? 
                      (teacher.stats.completedLessons / teacher.stats.totalLessons) * 100 : 0} 
                    color="green" 
                  />
                </div>
                
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Presenze Media</Text>
                    <Text size="sm" c="dimmed">{teacher.stats?.averageAttendance || 0}%</Text>
                  </Group>
                  <Progress value={teacher.stats?.averageAttendance || 0} color="orange" />
                </div>
              </Stack>
            </Card>

            {/* Recent Activity */}
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Attività Recente</Title>
              <Stack gap="sm">
                <Alert
                  icon={<IconCheck size={16} />}
                  color="green"
                  variant="light"
                >
                  <Text size="sm">Lezione "Algebra Lineare" completata con successo</Text>
                  <Text size="xs" c="dimmed">2 ore fa</Text>
                </Alert>
                
                <Alert
                  icon={<IconCalendarEvent size={16} />}
                  color="blue"
                  variant="light"
                >
                  <Text size="sm">Programmata lezione "Equazioni Differenziali"</Text>
                  <Text size="xs" c="dimmed">Domani alle 14:00</Text>
                </Alert>
                
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="yellow"
                  variant="light"
                >
                  <Text size="sm">Bassa partecipazione in Fisica B (18/20)</Text>
                  <Text size="xs" c="dimmed">1 giorno fa</Text>
                </Alert>
              </Stack>
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="classes">
          <Card withBorder radius="md" p="lg">
            <Title order={4} mb="md">Classi Assegnate</Title>
            <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
              {teacher.classes?.map((classItem: any) => (
                <Paper key={classItem.id} withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={500}>{classItem.name}</Text>
                      <Badge variant="light">
                        {typeof classItem.course === 'string' 
                          ? classItem.course 
                          : (classItem.course as any)?.name || 'N/A'}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      <IconUsers size={16} color="#868e96" />
                      <Text size="sm" c="dimmed">
                        {classItem.students || 0} studenti
                      </Text>
                    </Group>
                    <Button variant="light" size="xs" fullWidth>
                      Visualizza Classe
                    </Button>
                  </Stack>
                </Paper>
              )) || (
                <Text c="dimmed">Nessuna classe assegnata</Text>
              )}
            </SimpleGrid>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="lessons">
          <Card withBorder radius="md" p="lg">
            <Title order={4} mb="md">Lezioni Recenti</Title>
            <AdvancedDataTable
              data={lessons}
              columns={lessonColumns}
            />
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="calendar">
          <AdvancedLessonCalendar
            teacherId={teacherId}
            height={600}
            readonly={false}
            showCreateButton={true}
          />
        </Tabs.Panel>

        <Tabs.Panel value="qualifications">
          <Card withBorder radius="md" p="lg">
            <Title order={4} mb="md">Qualifiche e Certificazioni</Title>
            <Stack gap="md">
              {teacher.qualifications ? (
                teacher.qualifications.split(', ').map((qualification: string, index: number) => (
                  <Paper key={index} withBorder p="md" radius="md">
                    <Group gap="sm">
                      <IconAward size={20} color="#228be6" />
                      <Text>{qualification}</Text>
                    </Group>
                  </Paper>
                ))
              ) : (
                <Text c="dimmed">Nessuna qualifica specificata</Text>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Teacher Form Modal */}
      <TeacherForm
        opened={opened}
        onClose={close}
        teacher={{
          id: teacher.id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
          phone: teacher.phone || '',
          hireDate: (() => {
            try {
              const date = new Date(teacher.hireDate);
              return isNaN(date.getTime()) ? new Date() : date;
            } catch {
              return new Date();
            }
          })(),
          specializations: teacher.specializations || '',
          status: teacher.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
        }}
        onSave={handleFormSubmit}
        loading={submitting}
      />
    </Container>
  );
}
