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
  Skeleton,
  FileButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBook2,
  IconPlus,
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
  IconDownload,
  IconUpload,
  IconFile,
  IconPdf,
  IconVideo,
  IconPhoto,
  IconMapPin,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { DataTable, TableRenderers } from '@/components/tables/DataTable';
import { ModernModal } from '@/components/modals/ModernModal';
import { AdvancedCalendarComponent } from '@/components/calendar/AdvancedCalendarComponent';
import { EnrollStudentsModal } from '@/components/forms/EnrollStudentsModal';
import { AttendanceGrid } from '@/components/attendance/AttendanceGrid';
import { MaterialsManager } from '@/components/materials/MaterialsManager';
import { TextInput, Textarea, Switch, Select, NumberInput } from '@mantine/core';
import { can } from '@/lib/permissions/matrix';

// Assegnazione materia-classe (GET /api/classes/[id]/subjects)
interface ClassSubjectItem {
  id: string;
  subjectId: string;
  teacherId: string;
  weeklyHours: number;
  subject: { id: string; name: string; code: string; color?: string | null };
  teacher: { id: string; firstName: string; lastName: string; email: string };
}

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

interface AttendanceRecord {
  id: string;
  studentId: string;
  lessonId: string;
  status: 'PRESENT' | 'ABSENT' | 'JUSTIFIED' | 'LATE';
  student: {
    firstName: string;
    lastName: string;
  };
  lesson: {
    title: string;
    startTime: string;
  };
}

interface Material {
  id: string;
  name: string;
  type: string;
  size: number;
  category: 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'IMAGE';
  uploadedAt: string;
  url: string;
}

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations();

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [enrollModalOpened, { open: openEnrollModal, close: closeEnrollModal }] = useDisclosure(false);
  const [communicateModalOpened, { open: openCommunicateModal, close: closeCommunicateModal }] = useDisclosure(false);
  
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [uploading, setUploading] = useState(false);

  // Form comunicazione classe
  const [commSubject, setCommSubject] = useState('');
  const [commBody, setCommBody] = useState('');
  const [commIncludeParents, setCommIncludeParents] = useState(false);
  const [commSending, setCommSending] = useState(false);

  // Tab Materie: assegnazioni materia-docente della classe
  const [classSubjects, setClassSubjects] = useState<ClassSubjectItem[]>([]);
  const [allSubjects, setAllSubjects] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [allTeachers, setAllTeachers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [subjectModalOpened, { open: openSubjectModal, close: closeSubjectModal }] = useDisclosure(false);
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubjectItem | null>(null);
  const [csSubjectId, setCsSubjectId] = useState<string | null>(null);
  const [csTeacherId, setCsTeacherId] = useState<string | null>(null);
  const [csWeeklyHours, setCsWeeklyHours] = useState<number>(1);
  const [csSaving, setCsSaving] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Check permissions: canManageClasses resta per le azioni amministrative;
  // le azioni didattiche (presenze, materiali, comunicazioni) passano da can()
  const role = session?.user?.role;
  const canManageClasses = can(role, 'update', 'class');
  const canDeleteClass = can(role, 'delete', 'class');
  const canViewClasses = can(role, 'read', 'class');
  const canEditAttendance = can(role, 'update', 'attendance');
  const canManageMaterials = can(role, 'create', 'material');
  const canCommunicate = can(role, 'create', 'message');

  // Fetch class data
  const fetchClassData = async () => {
    if (!resolvedParams?.id || !canViewClasses) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}?include=course,teacher,students,lessons`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Classe non trovata');
        }
        throw new Error('Errore nel caricamento dei dati');
      }
      
      const data: any = await response.json();
      // L'API risponde { class: {...} } con students già APPIATTITI (Student[]).
      // La pagina ragiona in termini di enrollment { student } (shape storica
      // StudentClass): normalizziamo qui, in un punto solo.
      const raw = data.class ?? data;
      const normalized = {
        ...raw,
        students: (raw.students ?? []).map((s: any) =>
          s && s.student ? s : { student: s }
        ),
      };
      setClassData(normalized as ClassDetail);
    } catch (error: any) {
      console.error('Error fetching class data:', error);
      setError(error.message);
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile caricare i dati della classe',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch attendance data
  const fetchAttendance = async () => {
    if (!resolvedParams?.id || !canViewClasses) return;
    
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}/attendance`);
      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  // Fetch materials
  const fetchMaterials = async () => {
    if (!resolvedParams?.id || !canViewClasses) return;
    
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}/materials`);
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  // Fetch assegnazioni materie della classe
  const fetchClassSubjects = async () => {
    if (!resolvedParams?.id || !canViewClasses) return;

    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}/subjects`);
      if (response.ok) {
        const payload = await response.json();
        setClassSubjects(payload.data || []);
      }
    } catch (error) {
      console.error('Error fetching class subjects:', error);
    }
  };

  // Opzioni per il modal (materie del tenant + docenti)
  const fetchSubjectAndTeacherOptions = async () => {
    if (!canManageClasses) return;

    try {
      const [subjectsRes, teachersRes] = await Promise.all([
        fetch('/api/subjects?all=true'),
        fetch('/api/teachers?limit=100'),
      ]);
      if (subjectsRes.ok) {
        const data = await subjectsRes.json();
        setAllSubjects(data.subjects || []);
      }
      if (teachersRes.ok) {
        const data = await teachersRes.json();
        setAllTeachers(data.teachers || []);
      }
    } catch (error) {
      console.error('Error fetching subject/teacher options:', error);
    }
  };

  useEffect(() => {
    if (resolvedParams?.id) {
      fetchClassData();
      fetchAttendance();
      fetchMaterials();
      fetchClassSubjects();
      fetchSubjectAndTeacherOptions();
    }
  }, [resolvedParams?.id, canViewClasses]);

  const openAddSubject = () => {
    setEditingClassSubject(null);
    setCsSubjectId(null);
    setCsTeacherId(classData?.teacher?.id || null);
    setCsWeeklyHours(1);
    openSubjectModal();
  };

  const openEditSubject = (item: ClassSubjectItem) => {
    setEditingClassSubject(item);
    setCsSubjectId(item.subjectId);
    setCsTeacherId(item.teacherId);
    setCsWeeklyHours(item.weeklyHours);
    openSubjectModal();
  };

  const handleSaveClassSubject = async () => {
    if (!resolvedParams?.id || !csSubjectId) return;

    setCsSaving(true);
    try {
      const url = editingClassSubject
        ? `/api/classes/${resolvedParams.id}/subjects/${editingClassSubject.subjectId}`
        : `/api/classes/${resolvedParams.id}/subjects`;
      const method = editingClassSubject ? 'PUT' : 'POST';
      const body = editingClassSubject
        ? { teacherId: csTeacherId || undefined, weeklyHours: csWeeklyHours }
        : { subjectId: csSubjectId, teacherId: csTeacherId || undefined, weeklyHours: csWeeklyHours };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore salvataggio materia');
      }

      notifications.show({
        title: 'Successo',
        message: editingClassSubject ? 'Materia aggiornata' : 'Materia aggiunta alla classe',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      closeSubjectModal();
      fetchClassSubjects();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile salvare la materia',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setCsSaving(false);
    }
  };

  const handleDeleteClassSubject = async (item: ClassSubjectItem) => {
    if (!resolvedParams?.id) return;
    if (!confirm(`Rimuovere ${item.subject.name} dalla classe?`)) return;

    try {
      const response = await fetch(
        `/api/classes/${resolvedParams.id}/subjects/${item.subjectId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore rimozione materia');
      }
      notifications.show({
        title: 'Successo',
        message: 'Materia rimossa dalla classe',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      fetchClassSubjects();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile rimuovere la materia',
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  const handleEdit = () => {
    // La modifica avviene nel modal della lista classi (nessuna pagina /edit)
    router.push(`/${locale}/dashboard/classes?action=edit&id=${resolvedParams?.id}`);
  };

  const handleDelete = async () => {
    if (!resolvedParams?.id) return;
    
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'eliminazione');
      }

      notifications.show({
        title: 'Successo',
        message: 'Classe eliminata con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      router.push(`/${locale}/dashboard/classes`);
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile eliminare la classe',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      closeDeleteModal();
    }
  };

  const handleExportRegister = () => {
    if (!classData || !attendance || attendance.length === 0) {
      notifications.show({
        title: 'Nessun dato',
        message: 'Non ci sono dati di presenza da esportare',
        color: 'orange',
      });
      return;
    }

    // Create CSV content
    const headers = ['Data', 'Lezione', 'Studente', 'Stato'];
    const rows = attendance.map((record) => [
      new Date(record.lesson.startTime).toLocaleDateString('it-IT'),
      record.lesson.title || 'N/A',
      `${record.student.firstName} ${record.student.lastName}`,
      record.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `registro_${classData.name}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    notifications.show({
      title: 'Export completato',
      message: 'Il registro è stato scaricato',
      color: 'green',
    });
  };

  const handleCommunicate = async (data: { subject: string; body: string; includeParents: boolean }) => {
    if (!resolvedParams?.id) return;

    setCommSending(true);
    try {
      const response = await fetch(`/api/classes/${resolvedParams.id}/communicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Errore invio comunicazione');
      }

      notifications.show({
        title: 'Successo',
        message: 'Comunicazione inviata con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      setCommSubject('');
      setCommBody('');
      setCommIncludeParents(false);
      closeCommunicateModal();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile inviare la comunicazione',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setCommSending(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    if (!resolvedParams?.id || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });

      const response = await fetch(`/api/classes/${resolvedParams.id}/materials`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'upload');
      }

      notifications.show({
        title: 'Successo',
        message: `${files.length} file caricati con successo`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      fetchMaterials(); // Refresh materials list
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile caricare i file',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!canViewClasses) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (error || !classData) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} color="red">
          {error || 'Classe non trovata'}
        </Alert>
      </Container>
    );
  }

  const totalStudents = classData._count?.students || 0;
  const maxStudents = classData.maxStudents;
  const totalLessons = classData._count?.lessons || 0;
  const completedLessons = classData.lessons?.filter(lesson => lesson.status === 'COMPLETED').length || 0;
  const occupancyRate = maxStudents > 0 ? Math.round((totalStudents / maxStudents) * 100) : 0;

  // Student columns for DataTable
  const studentColumns = [
    {
      key: 'student' as keyof typeof classData.students[0],
      title: 'Studente',
      render: (_: any, enrollment: any) => (
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
      ),
    },
    {
      key: 'enrolledAt' as keyof typeof classData.students[0],
      title: 'Contatto',
      render: (_: any, enrollment: any) => (
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
      ),
    },
    {
      key: 'enrolledAt' as keyof typeof classData.students[0],
      title: 'Iscrizione',
      render: (date: string) => new Date(date).toLocaleDateString('it-IT'),
    },
  ] as any[];

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
            <Group>
              {canManageClasses && (
                <Button
                  leftSection={<IconEdit size={18} />}
                  variant="light"
                  onClick={handleEdit}
                >
                  Modifica
                </Button>
              )}
              {canCommunicate && (
                <Button
                  leftSection={<IconMail size={18} />}
                  variant="gradient"
                  gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
                  onClick={openCommunicateModal}
                  data-testid="classe-invia-comunicazione"
                >
                  Invia Comunicazione
                </Button>
              )}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg">
                    <IconDotsVertical size="1.2rem" />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconDownload size="1rem" />}
                    onClick={handleExportRegister}
                  >
                    Export Registro
                  </Menu.Item>
                  {canDeleteClass && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size="1rem" />}
                        color="red"
                        onClick={openDeleteModal}
                      >
                        Elimina
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </div>
      </Group>

      {/* Class Info Header Card */}
      <Paper p="xl" mb="xl" radius="lg" style={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
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
                      {classData.teacher?.firstName?.[0]}{classData.teacher?.lastName?.[0]}
                    </Avatar>
                    <div>
                      <Text 
                        fw={500}
                        style={{ cursor: canManageClasses ? 'pointer' : 'default' }}
                        onClick={() => canManageClasses && classData.teacher && router.push(`/${locale}/dashboard/teachers/${classData.teacher.id}`)}
                      >
                        {classData.teacher ? `${classData.teacher.firstName} ${classData.teacher.lastName}` : 'Nessun docente'}
                      </Text>
                      <Text size="xs" style={{ opacity: 0.8 }}>
                        {classData.teacher?.email || ''}
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
            gradient="linear-gradient(135deg, #1e3a8a 0%, #172554 100%)"
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
            gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
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
      <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
        <Tabs.List mb="xl">
          <Tabs.Tab value="overview" leftSection={<IconBook2 size={18} />}>
            Panoramica
          </Tabs.Tab>
          <Tabs.Tab value="students" leftSection={<IconUsers size={18} />}>
            Studenti ({totalStudents})
          </Tabs.Tab>
          <Tabs.Tab value="subjects" leftSection={<IconBooks size={18} />} data-testid="classi-materie-tab">
            Materie ({classSubjects.length})
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
                    <Text fw={500}>
                      {classData.course ? (
                        <Text
                          style={{ cursor: 'pointer' }}
                          c="blue"
                          onClick={() => router.push(`/${locale}/dashboard/courses/${classData.course.id}`)}
                        >
                          {classData.course.name}
                        </Text>
                      ) : (
                        'Nessun corso associato'
                      )}
                    </Text>
                    <Text size="sm" c="dimmed">{classData.course?.level}</Text>
                  </div>
                  <div>
                    <Text size="sm" c="dimmed" mb={4}>Descrizione</Text>
                    <Text size="sm">{classData.course?.description || 'Nessuna descrizione disponibile'}</Text>
                  </div>
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
                    Performance
                  </Group>
                </Title>
                <Stack gap="lg">
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Completamento Lezioni</Text>
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
                    <Text size="lg" fw={500}>{String(maxStudents - totalStudents)}</Text>
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

        {/* Students Tab - Using DataTable */}
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
                  onClick={openEnrollModal}
                >
                  Iscrivi Studenti
                </Button>
              )}
            </Group>

            {totalStudents > 0 ? (
              <DataTable
                data={classData.students || []}
                columns={studentColumns}
                loading={false}
                searchable
                searchPlaceholder="Cerca studenti..."
              />
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
                  <Button onClick={openEnrollModal}>
                    Iscrivi Primo Studente
                  </Button>
                )}
              </Paper>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Subjects Tab - ClassSubject CRUD */}
        <Tabs.Panel value="subjects">
          <Paper p="lg" radius="lg" withBorder>
            <Group justify="space-between" mb="md">
              <div>
                <Title order={4}>Materie della Classe</Title>
                <Text size="sm" c="dimmed">
                  Assegna materie e docenti: sblocca orari e pagelle
                </Text>
              </div>
              {canManageClasses && (
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={openAddSubject}
                  data-testid="classi-materie-aggiungi"
                >
                  Aggiungi Materia
                </Button>
              )}
            </Group>

            {classSubjects.length > 0 ? (
              <Table striped highlightOnHover data-testid="classi-materie-tabella">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Materia</Table.Th>
                    <Table.Th>Docente</Table.Th>
                    <Table.Th>Ore Settimanali</Table.Th>
                    {canManageClasses && <Table.Th>Azioni</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {classSubjects.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Badge
                            variant="light"
                            style={item.subject.color ? { color: item.subject.color } : undefined}
                          >
                            {item.subject.code}
                          </Badge>
                          <Text fw={500} size="sm">{item.subject.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {item.teacher.firstName} {item.teacher.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.weeklyHours}</Text>
                      </Table.Td>
                      {canManageClasses && (
                        <Table.Td>
                          <Group gap={4}>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="yellow"
                              onClick={() => openEditSubject(item)}
                              data-testid={`classi-materie-modifica-${item.subjectId}`}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="red"
                              onClick={() => handleDeleteClassSubject(item)}
                              data-testid={`classi-materie-elimina-${item.subjectId}`}
                            >
                              <IconTrash size={14} />
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
                <IconBooks size={48} color="var(--mantine-color-gray-4)" />
                <Text size="lg" fw={500} mt="md" c="dimmed">
                  Nessuna materia assegnata
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Aggiungi le materie per abilitare orari e pagelle
                </Text>
                {canManageClasses && (
                  <Button onClick={openAddSubject}>Aggiungi Prima Materia</Button>
                )}
              </Paper>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Lessons Tab - With Table and Stats */}
        <Tabs.Panel value="lessons">
          <Stack gap="md">
            {/* Lesson Stats */}
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Paper p="md" radius="lg" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconCalendarEvent size={18} color="var(--mantine-color-blue-6)" />
                    <Text size="sm" c="dimmed">Totali</Text>
                  </Group>
                  <Text size="xl" fw={700}>{totalLessons}</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Paper p="md" radius="lg" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconCheck size={18} color="var(--mantine-color-green-6)" />
                    <Text size="sm" c="dimmed">Completate</Text>
                  </Group>
                  <Text size="xl" fw={700} c="green">{completedLessons}</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Paper p="md" radius="lg" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconClock size={18} color="var(--mantine-color-orange-6)" />
                    <Text size="sm" c="dimmed">Programmate</Text>
                  </Group>
                  <Text size="xl" fw={700} c="orange">{totalLessons - completedLessons}</Text>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Paper p="md" radius="lg" withBorder>
                  <Group gap="xs" mb="xs">
                    <IconChartBar size={18} color="var(--mantine-color-purple-6)" />
                    <Text size="sm" c="dimmed">Completamento</Text>
                  </Group>
                  <Text size="xl" fw={700} c="purple">
                    {totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0}%
                  </Text>
                </Paper>
              </Grid.Col>
            </Grid>

            {/* Lessons Table */}
            <Paper p="lg" radius="lg" withBorder>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Lezioni della Classe</Title>
                  <Text size="sm" c="dimmed">
                    Elenco completo delle lezioni programmate e completate
                  </Text>
                </div>
                {canManageClasses && (
                  <Group gap="sm">
                    <Button
                      variant="light"
                      leftSection={<IconCalendarEvent size={16} />}
                      onClick={() => {
                        // Apre la pagina lezioni con modal di creazione e classe preimpostata
                        router.push(`/${locale}/dashboard/lessons?action=create&classId=${resolvedParams?.id}`);
                      }}
                    >
                      Nuova Lezione
                    </Button>
                    <Button
                      leftSection={<IconCalendar size={16} />}
                      onClick={() => router.push(`/${locale}/dashboard/lessons?classId=${resolvedParams?.id}`)}
                    >
                      Calendario Completo
                    </Button>
                  </Group>
                )}
              </Group>
              
              {classData?.lessons && classData.lessons.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Lezione</Table.Th>
                      <Table.Th>Data e Ora</Table.Th>
                      <Table.Th>Durata</Table.Th>
                      <Table.Th>Presenze</Table.Th>
                      <Table.Th>Stato</Table.Th>
                      <Table.Th>Azioni</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {classData.lessons.map((lesson: any) => {
                      const startDate = new Date(lesson.startTime);
                      const endDate = new Date(lesson.endTime);
                      const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                      const attendanceCount = lesson._count?.attendance || 0;
                      
                      return (
                        <Table.Tr key={lesson.id}>
                          <Table.Td>
                            <div>
                              <Text fw={500} size="sm">{lesson.title}</Text>
                              {lesson.room && (
                                <Text size="xs" c="dimmed">
                                  <IconMapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                                  {lesson.room}
                                </Text>
                              )}
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500}>
                                {startDate.toLocaleDateString('it-IT', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {startDate.toLocaleTimeString('it-IT', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{duration} min</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge 
                              variant="light" 
                              color={attendanceCount > 0 ? 'green' : 'gray'}
                              size="sm"
                            >
                              {attendanceCount} presenze
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={
                                lesson.status === 'COMPLETED' ? 'green' :
                                lesson.status === 'CANCELLED' ? 'red' : 'blue'
                              }
                              size="sm"
                            >
                              {lesson.status === 'COMPLETED' ? 'Completata' :
                               lesson.status === 'CANCELLED' ? 'Annullata' : 'Programmata'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="blue"
                                onClick={() => router.push(`/${locale}/dashboard/lessons/${lesson.id}`)}
                              >
                                <IconEye size={14} />
                              </ActionIcon>
                              {canManageClasses && (
                                <ActionIcon
                                  size="sm"
                                  variant="light"
                                  color="yellow"
                                  onClick={() => router.push(`/${locale}/dashboard/lessons/${lesson.id}`)}
                                >
                                  <IconEdit size={14} />
                                </ActionIcon>
                              )}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              ) : (
                <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
                  <IconCalendarEvent size={48} color="var(--mantine-color-gray-4)" />
                  <Text size="lg" fw={500} mt="md" c="dimmed">
                    Nessuna Lezione Programmata
                  </Text>
                  <Text size="sm" c="dimmed" mb="md">
                    Inizia creando la prima lezione per questa classe
                  </Text>
                  {canManageClasses && (
                    <Button
                      onClick={() => router.push(`/${locale}/dashboard/lessons?action=create&classId=${resolvedParams?.id}`)}
                    >
                      Crea Prima Lezione
                    </Button>
                  )}
                </Paper>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* Attendance Tab - Interactive Grid */}
        <Tabs.Panel value="attendance">
          {classData ? (
            <AttendanceGrid
              classId={resolvedParams?.id || ''}
              students={classData.students?.map(sc => sc.student) || []}
              lessons={classData.lessons || []}
              canEdit={canEditAttendance}
            />
          ) : (
            <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
              <LoadingOverlay visible />
              <Text c="dimmed">Caricamento dati presenze...</Text>
            </Paper>
          )}
        </Tabs.Panel>

        {/* Materials Tab - File Upload */}
        <Tabs.Panel value="materials">
          {classData ? (
            <MaterialsManager
              classId={resolvedParams?.id || ''}
              materials={materials?.map(m => {
                const apiMaterial = m as any; // Cast per gestire la differenza tra API e interfaccia Material
                return {
                  id: m.id,
                  name: m.name,
                  description: apiMaterial.description || '',
                  fileName: m.name,
                  fileSize: apiMaterial.fileSize || m.size || 0,
                  fileType: apiMaterial.mimeType || m.type || 'application/octet-stream',
                  fileUrl: apiMaterial.filePath || m.url || '',
                  uploadedAt: m.uploadedAt,
                  uploadedBy: apiMaterial.uploadedBy || {
                    id: '',
                    firstName: '',
                    lastName: ''
                  },
                  downloads: apiMaterial.downloadCount || 0,
                  tags: []
                };
              }) || []}
              canEdit={canManageMaterials}
              onMaterialsUpdate={() => fetchMaterials()}
            />
          ) : (
            <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
              <LoadingOverlay visible />
              <Text c="dimmed">Caricamento materiali...</Text>
            </Paper>
          )}
        </Tabs.Panel>

        {/* Assignments Tab */}
        <Tabs.Panel value="assignments">
          <Paper p="xl" radius="lg" withBorder>
            <Group mb="md">
              <IconSchool size={24} />
              <Title order={4}>Compiti e Valutazioni</Title>
            </Group>
            <Alert icon={<IconInfoCircle />} color="blue" mb="md">
              Sistema di compiti e valutazioni in fase di sviluppo avanzato
            </Alert>
            <Text c="dimmed">
              Qui potrai:
              • Assegnare compiti agli studenti con scadenze
              • Gestire consegne e correzioni
              • Valutare con voti e feedback dettagliati
              • Generare report di performance
              • Inviare notifiche automatiche per le scadenze
            </Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Conferma Eliminazione"
        centered
      >
        <Text mb="md">
          Sei sicuro di voler eliminare la classe "{classData.name}"? 
          Questa azione non può essere annullata e rimuoverà tutti i dati associati.
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

      {/* Add/Edit Subject Modal */}
      <Modal
        opened={subjectModalOpened}
        onClose={closeSubjectModal}
        title={editingClassSubject ? 'Modifica Materia' : 'Aggiungi Materia'}
        centered
      >
        <Stack gap="md">
          <Select
            label="Materia"
            placeholder="Seleziona materia"
            required
            searchable
            disabled={!!editingClassSubject}
            data={allSubjects
              // In creazione escludi le materie già assegnate
              .filter((s) =>
                editingClassSubject
                  ? true
                  : !classSubjects.some((cs) => cs.subjectId === s.id)
              )
              .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
            value={csSubjectId}
            onChange={setCsSubjectId}
            data-testid="classi-materie-select-materia"
          />
          <Select
            label="Docente"
            placeholder="Docente titolare della classe se non indicato"
            searchable
            clearable
            data={allTeachers.map((t) => ({
              value: t.id,
              label: `${t.firstName} ${t.lastName}`,
            }))}
            value={csTeacherId}
            onChange={setCsTeacherId}
            data-testid="classi-materie-select-docente"
          />
          <NumberInput
            label="Ore Settimanali"
            min={1}
            max={40}
            value={csWeeklyHours}
            onChange={(v) => setCsWeeklyHours(Number(v) || 1)}
            data-testid="classi-materie-ore"
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={closeSubjectModal}>
              Annulla
            </Button>
            <Button
              loading={csSaving}
              disabled={!csSubjectId}
              onClick={handleSaveClassSubject}
              data-testid="classi-materie-salva"
            >
              {editingClassSubject ? 'Aggiorna' : 'Aggiungi'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Communicate Modal */}
      <ModernModal
        opened={communicateModalOpened}
        onClose={closeCommunicateModal}
        title="Invia Comunicazione"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Oggetto"
            placeholder="Oggetto della comunicazione"
            required
            value={commSubject}
            onChange={(e) => setCommSubject(e.currentTarget.value)}
            data-testid="classe-comunicazione-oggetto"
          />
          <Textarea
            label="Messaggio"
            placeholder="Testo della comunicazione agli studenti della classe..."
            required
            minRows={4}
            value={commBody}
            onChange={(e) => setCommBody(e.currentTarget.value)}
            data-testid="classe-comunicazione-testo"
          />
          <Switch
            label="Invia anche ai genitori"
            checked={commIncludeParents}
            onChange={(e) => setCommIncludeParents(e.currentTarget.checked)}
            data-testid="classe-comunicazione-genitori"
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={closeCommunicateModal}>
              Annulla
            </Button>
            <Button
              loading={commSending}
              disabled={!commSubject.trim() || !commBody.trim()}
              onClick={() =>
                handleCommunicate({
                  subject: commSubject.trim(),
                  body: commBody.trim(),
                  includeParents: commIncludeParents,
                })
              }
              data-testid="classe-comunicazione-invia"
            >
              Invia
            </Button>
          </Group>
        </Stack>
      </ModernModal>

      {/* Enroll Students Modal */}
      <EnrollStudentsModal
        opened={enrollModalOpened}
        onClose={closeEnrollModal}
        classId={resolvedParams?.id || ''}
        className={classData.name}
        currentCapacity={totalStudents}
        maxCapacity={maxStudents}
        currentStudentIds={classData.students?.map(s => s.student.id) || []}
        onEnrollComplete={() => {
          closeEnrollModal();
          fetchClassData(); // Refresh the data
        }}
      />
    </Container>
  );
}
