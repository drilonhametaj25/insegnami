'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
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
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { AdvancedDataTable } from '@/components/tables/AdvancedDataTable';
import { AdvancedLessonCalendar } from '@/components/calendar/AdvancedLessonCalendar';

// Mock data - sostituire con chiamate API reali
const mockTeacher = {
  id: '1',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario.rossi@school.com',
  phone: '+39 123 456 7890',
  dateOfBirth: '1980-05-15',
  hireDate: '2020-01-10',
  status: 'ACTIVE',
  specializations: ['Matematica', 'Fisica'],
  avatar: null,
  bio: 'Docente esperto in matematica e fisica con oltre 15 anni di esperienza nell\'insegnamento.',
  qualifications: [
    'Laurea in Matematica - Università di Roma',
    'Master in Didattica - Università Cattolica',
    'Certificazione ECDL Advanced'
  ],
  classes: [
    { id: '1', name: 'Matematica A', course: 'Matematica', students: 25 },
    { id: '2', name: 'Fisica B', course: 'Fisica', students: 20 },
    { id: '3', name: 'Matematica C', course: 'Matematica', students: 22 }
  ],
  stats: {
    totalClasses: 3,
    totalStudents: 67,
    totalLessons: 156,
    averageAttendance: 92.5,
    completedLessons: 148,
    cancelledLessons: 8,
    monthlyHours: 48
  }
};

const mockLessons = [
  {
    id: '1',
    title: 'Algebra Lineare',
    class: 'Matematica A',
    date: '2024-01-15',
    startTime: '09:00',
    endTime: '10:30',
    status: 'completed',
    attendance: { present: 23, total: 25 },
    room: 'Aula 101'
  },
  {
    id: '2',
    title: 'Cinematica',
    class: 'Fisica B',
    date: '2024-01-15',
    startTime: '11:00',
    endTime: '12:30',
    status: 'completed',
    attendance: { present: 18, total: 20 },
    room: 'Lab Fisica'
  },
  {
    id: '3',
    title: 'Equazioni Differenziali',
    class: 'Matematica C',
    date: '2024-01-16',
    startTime: '14:00',
    endTime: '15:30',
    status: 'scheduled',
    room: 'Aula 203'
  }
];

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const teacherId = params.id as string;
  
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [isLoading, setIsLoading] = useState(false);

  // Mock loading state
  const teacher = mockTeacher;
  const lessons = mockLessons;

  const handleEdit = () => {
    router.push(`/${locale}/dashboard/teachers/${teacherId}/edit`);
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
                  Assunto: {format(new Date(teacher.hireDate), 'dd/MM/yyyy', { locale: it })}
                </Text>
              </Group>
              <Group gap="xs">
                <IconBook size={16} color="#868e96" />
                <Text size="sm">
                  Materie: {teacher.specializations.join(', ')}
                </Text>
              </Group>
            </SimpleGrid>

            {teacher.bio && (
              <>
                <Divider my="sm" />
                <Text size="sm" c="dimmed">{teacher.bio}</Text>
              </>
            )}
          </Stack>
        </Group>
      </Card>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="xl">
        <ModernStatsCard
          title="Classi Totali"
          value={teacher.stats.totalClasses.toString()}
          change={{ value: 0, type: "neutral", period: "rispetto al mese scorso" }}
          icon={<IconUsers size={20} />}
          gradient="blue"
        />
        <ModernStatsCard
          title="Studenti"
          value={teacher.stats.totalStudents.toString()}
          change={{ value: 5, type: "increase", period: "rispetto al mese scorso" }}
          icon={<IconUser size={20} />}
          gradient="green"
        />
        <ModernStatsCard
          title="Lezioni"
          value={teacher.stats.totalLessons.toString()}
          change={{ value: 12, type: "increase", period: "rispetto al mese scorso" }}
          icon={<IconBook size={20} />}
          gradient="violet"
        />
        <ModernStatsCard
          title="Presenze Media"
          value={`${teacher.stats.averageAttendance}%`}
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
                    <Text size="sm" c="dimmed">{teacher.stats.monthlyHours} ore</Text>
                  </Group>
                  <Progress value={75} color="blue" />
                </div>
                
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Lezioni Completate</Text>
                    <Text size="sm" c="dimmed">
                      {teacher.stats.completedLessons}/{teacher.stats.totalLessons}
                    </Text>
                  </Group>
                  <Progress 
                    value={(teacher.stats.completedLessons / teacher.stats.totalLessons) * 100} 
                    color="green" 
                  />
                </div>
                
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>Presenze Media</Text>
                    <Text size="sm" c="dimmed">{teacher.stats.averageAttendance}%</Text>
                  </Group>
                  <Progress value={teacher.stats.averageAttendance} color="orange" />
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
              {teacher.classes.map((classItem) => (
                <Paper key={classItem.id} withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={500}>{classItem.name}</Text>
                      <Badge variant="light">{classItem.course}</Badge>
                    </Group>
                    <Group gap="xs">
                      <IconUsers size={16} color="#868e96" />
                      <Text size="sm" c="dimmed">
                        {classItem.students} studenti
                      </Text>
                    </Group>
                    <Button variant="light" size="xs" fullWidth>
                      Visualizza Classe
                    </Button>
                  </Stack>
                </Paper>
              ))}
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
              {teacher.qualifications.map((qualification, index) => (
                <Paper key={index} withBorder p="md" radius="md">
                  <Group gap="sm">
                    <IconAward size={20} color="#228be6" />
                    <Text>{qualification}</Text>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
