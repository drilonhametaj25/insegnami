'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stepper,
  Button,
  Group,
  TextInput,
  PasswordInput,
  Select,
  Title,
  Text,
  Paper,
  Stack,
  ThemeIcon,
  Card,
  Badge,
  SimpleGrid,
  Alert,
  Center,
  Box,
  Loader,
  Divider,
  List,
  Collapse,
  rem
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconSchool,
  IconUsers,
  IconUser,
  IconBook,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconRocket,
  IconAlertCircle,
  IconConfetti,
  IconUserPlus,
  IconPlus
} from '@tabler/icons-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BRAND } from '@/lib/theme';

interface OnboardingData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    setupStage: string;
  };
  stats: {
    teachers: number;
    classes: number;
    students: number;
    users: number;
  };
  isComplete: boolean;
}

interface CreatedTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CreatedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface CreatedClass {
  id: string;
  name: string;
}

interface CourseOption {
  id: string;
  name: string;
}

interface TeacherOption {
  id: string;
  firstName: string;
  lastName: string;
}

const STAGES = ['INITIAL', 'SCHOOL', 'TEAM', 'TEACHERS', 'CLASSES', 'COMPLETE'];

// I ruoli accettati dall'endpoint reale POST /api/users per un ADMIN di tenant.
const TEAM_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Amministratore' },
  { value: 'TEACHER', label: 'Insegnante' },
  { value: 'STUDENT', label: 'Studente' },
  { value: 'PARENT', label: 'Genitore' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [active, setActive] = useState(0);

  // --- Stato creazioni inline ---
  const [createdTeachers, setCreatedTeachers] = useState<CreatedTeacher[]>([]);
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const [createdUsers, setCreatedUsers] = useState<CreatedUser[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

  const [createdClasses, setCreatedClasses] = useState<CreatedClass[]>([]);
  const [creatingClass, setCreatingClass] = useState(false);

  // Liste per le Select dello step Classi
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadingSelects, setLoadingSelects] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);

  const schoolForm = useForm({
    initialValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome scuola richiesto' : null),
    },
  });

  const teacherForm = useForm({
    initialValues: { firstName: '', lastName: '', email: '' },
    validate: {
      firstName: (v) => (v.trim().length < 2 ? 'Nome richiesto' : null),
      lastName: (v) => (v.trim().length < 2 ? 'Cognome richiesto' : null),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Email non valida'),
    },
  });

  const userForm = useForm({
    initialValues: { firstName: '', lastName: '', email: '', password: '', role: 'ADMIN' },
    validate: {
      firstName: (v) => (v.trim().length < 2 ? 'Nome richiesto' : null),
      lastName: (v) => (v.trim().length < 2 ? 'Cognome richiesto' : null),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Email non valida'),
      password: (v) => (v.length < 8 ? 'Min 8 caratteri' : null),
      role: (v) => (v ? null : 'Ruolo richiesto'),
    },
  });

  const courseForm = useForm({
    initialValues: { name: '', category: '', level: '' },
    validate: {
      name: (v) => (v.trim().length < 2 ? 'Nome corso richiesto' : null),
    },
  });

  const classForm = useForm({
    initialValues: {
      name: '',
      courseId: '',
      teacherId: '',
      startDate: new Date() as Date | null,
    },
    validate: {
      name: (v) => (v.trim().length < 2 ? 'Nome classe richiesto' : null),
      courseId: (v) => (v ? null : 'Seleziona un corso'),
      teacherId: (v) => (v ? null : 'Seleziona un insegnante'),
      startDate: (v) => (v ? null : 'Data di inizio richiesta'),
    },
  });

  useEffect(() => {
    fetchOnboardingStatus();
  }, []);

  useEffect(() => {
    if (data?.tenant?.setupStage) {
      const stageIndex = STAGES.indexOf(data.tenant.setupStage);
      if (stageIndex > 0) {
        setActive(stageIndex);
      }
    }
  }, [data]);

  // Quando si entra nello step Classi, carica corsi e insegnanti per le Select.
  useEffect(() => {
    if (active === 4) {
      loadClassSelects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const fetchOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding');
      if (!response.ok) throw new Error('Errore nel caricamento');
      const result = await response.json();
      setData(result);

      // Pre-fill school form
      if (result.tenant) {
        schoolForm.setValues({
          name: result.tenant.name || '',
          address: '',
          phone: '',
          email: '',
        });
      }

      // If already complete, redirect to dashboard
      if (result.isComplete) {
        router.push(`/${locale}/dashboard`);
      }
    } catch (err) {
      console.error('Onboarding fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Ricarica solo gli stats (dopo una creazione inline) senza toccare lo stage.
  const refreshStats = async () => {
    try {
      const response = await fetch('/api/onboarding');
      if (!response.ok) return;
      const result = await response.json();
      setData((prev) => (prev ? { ...prev, stats: result.stats } : result));
    } catch {
      // silenzioso: gli stats sono informativi
    }
  };

  const loadClassSelects = async () => {
    setLoadingSelects(true);
    try {
      const [coursesRes, teachersRes] = await Promise.all([
        fetch('/api/courses?limit=100'),
        fetch('/api/teachers?limit=100'),
      ]);

      if (coursesRes.ok) {
        const json = await coursesRes.json();
        setCourses((json.courses || []).map((c: any) => ({ id: c.id, name: c.name })));
      }
      if (teachersRes.ok) {
        const json = await teachersRes.json();
        setTeachers(
          (json.teachers || []).map((t: any) => ({
            id: t.id,
            firstName: t.firstName,
            lastName: t.lastName,
          }))
        );
      }
    } catch (err) {
      console.error('Load class selects error:', err);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare corsi e insegnanti',
        color: 'red',
      });
    } finally {
      setLoadingSelects(false);
    }
  };

  const updateStage = async (stage: string) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });

      if (!response.ok) throw new Error('Errore nell\'aggiornamento');

      const result = await response.json();
      setData((prev) => prev ? { ...prev, tenant: { ...prev.tenant, ...result.tenant } } : null);

      return true;
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile aggiornare lo stato',
        color: 'red',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchoolSubmit = async (values: typeof schoolForm.values) => {
    setSubmitting(true);
    try {
      // Update school info
      await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      // Advance to next stage
      await updateStage('TEAM');
      setActive(2);
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile salvare i dati della scuola',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // --- Creazione INLINE: Insegnante ---
  const handleCreateTeacher = async (values: typeof teacherForm.values) => {
    setCreatingTeacher(true);
    try {
      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      const t = result.teacher;
      setCreatedTeachers((prev) => [
        ...prev,
        { id: t.id, firstName: t.firstName, lastName: t.lastName, email: t.email },
      ]);
      notifications.show({
        title: 'Insegnante creato',
        message: `${t.firstName} ${t.lastName} aggiunto correttamente`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      teacherForm.reset();
      await refreshStats();
    } catch (err: any) {
      notifications.show({
        title: 'Errore',
        message: err.message || 'Impossibile creare l\'insegnante',
        color: 'red',
      });
    } finally {
      setCreatingTeacher(false);
    }
  };

  // --- Creazione INLINE: Utente / Team ---
  const handleCreateUser = async (values: typeof userForm.values) => {
    setCreatingUser(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
          role: values.role,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      const u = result.user;
      setCreatedUsers((prev) => [
        ...prev,
        { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role },
      ]);
      notifications.show({
        title: 'Utente creato',
        message: `${u.firstName} ${u.lastName} aggiunto al team`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      userForm.reset();
      await refreshStats();
    } catch (err: any) {
      notifications.show({
        title: 'Errore',
        message: err.message || 'Impossibile creare l\'utente',
        color: 'red',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // --- Creazione INLINE: Corso (per abilitare la creazione classe) ---
  const handleCreateCourse = async (values: typeof courseForm.values) => {
    setCreatingCourse(true);
    try {
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          category: values.category || undefined,
          level: values.level || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      const c = result.course;
      setCourses((prev) => [...prev, { id: c.id, name: c.name }]);
      // Preseleziona il corso appena creato nel form classe.
      classForm.setFieldValue('courseId', c.id);
      notifications.show({
        title: 'Corso creato',
        message: `${c.name} aggiunto correttamente`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      courseForm.reset();
      setShowCourseForm(false);
    } catch (err: any) {
      notifications.show({
        title: 'Errore',
        message: err.message || 'Impossibile creare il corso',
        color: 'red',
      });
    } finally {
      setCreatingCourse(false);
    }
  };

  // --- Creazione INLINE: Classe ---
  const handleCreateClass = async (values: typeof classForm.values) => {
    setCreatingClass(true);
    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          courseId: values.courseId,
          teacherId: values.teacherId,
          startDate: values.startDate ? values.startDate.toISOString() : undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione');
      }

      const cls = result.class;
      setCreatedClasses((prev) => [...prev, { id: cls.id, name: cls.name }]);
      notifications.show({
        title: 'Classe creata',
        message: `${cls.name} aggiunta correttamente`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      classForm.reset();
      classForm.setFieldValue('startDate', new Date());
      await refreshStats();
    } catch (err: any) {
      notifications.show({
        title: 'Errore',
        message: err.message || 'Impossibile creare la classe',
        color: 'red',
      });
    } finally {
      setCreatingClass(false);
    }
  };

  const handleSkipStep = async () => {
    const nextStages: Record<number, string> = {
      2: 'TEACHERS',
      3: 'CLASSES',
      4: 'COMPLETE',
    };

    const nextStage = nextStages[active];
    if (nextStage) {
      const success = await updateStage(nextStage);
      if (success) {
        if (nextStage === 'COMPLETE') {
          router.push(`/${locale}/dashboard`);
        } else {
          setActive(STAGES.indexOf(nextStage));
        }
      }
    }
  };

  // Avanza allo step successivo dopo aver creato inline (azione "Continua").
  const handleContinueStep = async () => {
    const nextStages: Record<number, string> = {
      2: 'TEACHERS',
      3: 'CLASSES',
      4: 'COMPLETE',
    };
    const nextStage = nextStages[active];
    if (nextStage) {
      const success = await updateStage(nextStage);
      if (success) {
        if (nextStage === 'COMPLETE') {
          handleComplete();
        } else {
          setActive(STAGES.indexOf(nextStage));
        }
      }
    }
  };

  const handleComplete = async () => {
    const success = await updateStage('COMPLETE');
    if (success) {
      notifications.show({
        title: 'Setup Completato!',
        message: 'Benvenuto su InsegnaMi.pro',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      router.push(`/${locale}/dashboard`);
    }
  };

  const handleSkipOnboarding = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Errore');

      router.push(`/${locale}/dashboard`);
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile saltare il setup',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.gradient }}>
        <Loader size="xl" color="white" />
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: '100vh', background: BRAND.gradient, padding: rem(40) }}>
      <Container size="lg">
        {/* Header */}
        <Center mb={40}>
          <Stack gap="xs" align="center">
            <Badge size="lg" variant="light" color="white" style={{ background: 'rgba(255,255,255,0.2)' }}>
              Configurazione Iniziale
            </Badge>
            <Title order={1} c="white" ta="center">
              Benvenuto su InsegnaMi.pro
            </Title>
            <Text c="white" size="lg" ta="center" style={{ opacity: 0.9 }}>
              Configura la tua scuola in pochi semplici passaggi
            </Text>
          </Stack>
        </Center>

        {/* Main Card */}
        <Paper shadow="xl" radius="xl" p="xl" withBorder>
          <Stepper
            active={active}
            onStepClick={setActive}
            color="navy"
            allowNextStepsSelect={false}
            mb="xl"
          >
            <Stepper.Step
              label="Benvenuto"
              description="Inizia il setup"
              icon={<IconRocket size={18} />}
            />
            <Stepper.Step
              label="Scuola"
              description="Dettagli scuola"
              icon={<IconSchool size={18} />}
            />
            <Stepper.Step
              label="Team"
              description="Invita colleghi"
              icon={<IconUsers size={18} />}
            />
            <Stepper.Step
              label="Insegnanti"
              description="Aggiungi docenti"
              icon={<IconUser size={18} />}
            />
            <Stepper.Step
              label="Classi"
              description="Crea classi"
              icon={<IconBook size={18} />}
            />
            <Stepper.Completed>
              <Center py={40}>
                <Stack align="center" gap="lg">
                  <ThemeIcon size={80} radius="xl" color="green">
                    <IconConfetti size={40} />
                  </ThemeIcon>
                  <Title order={2} ta="center">Setup Completato!</Title>
                  <Text c="dimmed" ta="center">
                    La tua scuola è pronta. Inizia a usare InsegnaMi.pro!
                  </Text>
                  <Button
                    size="lg"
                    radius="xl"
                    color="navy"
                    leftSection={<IconArrowRight size={20} />}
                    onClick={() => router.push(`/${locale}/dashboard`)}
                  >
                    Vai alla Dashboard
                  </Button>
                </Stack>
              </Center>
            </Stepper.Completed>
          </Stepper>

          {/* Step 0: Benvenuto */}
          {active === 0 && (
            <Stack gap="lg" py="xl">
              <Center>
                <ThemeIcon size={80} radius="xl" color="navy" variant="light">
                  <IconRocket size={40} />
                </ThemeIcon>
              </Center>
              <Title order={2} ta="center">Iniziamo!</Title>
              <Text c="dimmed" ta="center" maw={500} mx="auto">
                Questa guida ti aiuterà a configurare la tua scuola in pochi minuti.
                Puoi sempre tornare indietro o saltare i passaggi opzionali.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
                <Card withBorder p="lg" radius="md">
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="lg" radius="md" color="navy" variant="light">
                      <IconSchool size={20} />
                    </ThemeIcon>
                    <Text fw={600}>Configura la Scuola</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Inserisci nome, indirizzo e informazioni di contatto della tua scuola.
                  </Text>
                </Card>
                <Card withBorder p="lg" radius="md">
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="lg" radius="md" color="green" variant="light">
                      <IconUsers size={20} />
                    </ThemeIcon>
                    <Text fw={600}>Invita il Team</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Aggiungi colleghi e personale amministrativo (opzionale).
                  </Text>
                </Card>
                <Card withBorder p="lg" radius="md">
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="lg" radius="md" color="amber" variant="light">
                      <IconUser size={20} />
                    </ThemeIcon>
                    <Text fw={600}>Aggiungi Insegnanti</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Crea i profili degli insegnanti della tua scuola.
                  </Text>
                </Card>
                <Card withBorder p="lg" radius="md">
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="lg" radius="md" color="navy" variant="light">
                      <IconBook size={20} />
                    </ThemeIcon>
                    <Text fw={600}>Crea le Classi</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Configura le classi e assegna gli studenti.
                  </Text>
                </Card>
              </SimpleGrid>

              <Group justify="center" mt="xl">
                <Button
                  size="lg"
                  radius="xl"
                  color="navy"
                  rightSection={<IconArrowRight size={20} />}
                  onClick={async () => {
                    await updateStage('SCHOOL');
                    setActive(1);
                  }}
                  loading={submitting}
                >
                  Inizia Configurazione
                </Button>
              </Group>

              <Center mt="md">
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={handleSkipOnboarding}
                  loading={submitting}
                >
                  Salta e vai alla dashboard
                </Button>
              </Center>
            </Stack>
          )}

          {/* Step 1: Scuola */}
          {active === 1 && (
            <form onSubmit={schoolForm.onSubmit(handleSchoolSubmit)}>
              <Stack gap="lg" py="xl" maw={500} mx="auto">
                <Title order={2} ta="center">Dettagli della Scuola</Title>
                <Text c="dimmed" ta="center">
                  Inserisci le informazioni della tua scuola.
                </Text>

                <TextInput
                  label="Nome Scuola"
                  placeholder="es. Scuola di Musica Milano"
                  size="md"
                  {...schoolForm.getInputProps('name')}
                />
                <TextInput
                  label="Indirizzo (opzionale)"
                  placeholder="Via Roma 1, 20100 Milano"
                  size="md"
                  {...schoolForm.getInputProps('address')}
                />
                <TextInput
                  label="Telefono (opzionale)"
                  placeholder="+39 02 1234567"
                  size="md"
                  {...schoolForm.getInputProps('phone')}
                />
                <TextInput
                  label="Email (opzionale)"
                  placeholder="info@scuola.it"
                  size="md"
                  {...schoolForm.getInputProps('email')}
                />

                <Group justify="space-between" mt="xl">
                  <Button
                    variant="light"
                    color="navy"
                    leftSection={<IconArrowLeft size={18} />}
                    onClick={() => setActive(0)}
                  >
                    Indietro
                  </Button>
                  <Button
                    type="submit"
                    color="navy"
                    rightSection={<IconArrowRight size={18} />}
                    loading={submitting}
                  >
                    Continua
                  </Button>
                </Group>
              </Stack>
            </form>
          )}

          {/* Step 2: Team / Utenti */}
          {active === 2 && (
            <Stack gap="lg" py="xl" maw={560} mx="auto">
              <Title order={2} ta="center">Invita il Team</Title>
              <Text c="dimmed" ta="center">
                Crea gli account dei colleghi che collaboreranno nella gestione della scuola.
              </Text>

              <Card withBorder p="lg" radius="md">
                <form onSubmit={userForm.onSubmit(handleCreateUser)}>
                  <Stack gap="sm">
                    <Group gap="xs">
                      <ThemeIcon size="md" radius="md" color="navy" variant="light">
                        <IconUserPlus size={16} />
                      </ThemeIcon>
                      <Text fw={600}>Nuovo membro del team</Text>
                    </Group>
                    <Group grow>
                      <TextInput
                        label="Nome"
                        placeholder="Mario"
                        {...userForm.getInputProps('firstName')}
                      />
                      <TextInput
                        label="Cognome"
                        placeholder="Rossi"
                        {...userForm.getInputProps('lastName')}
                      />
                    </Group>
                    <TextInput
                      label="Email"
                      placeholder="mario.rossi@scuola.it"
                      {...userForm.getInputProps('email')}
                    />
                    <Group grow>
                      <PasswordInput
                        label="Password iniziale"
                        placeholder="Min 8 caratteri"
                        {...userForm.getInputProps('password')}
                      />
                      <Select
                        label="Ruolo"
                        data={TEAM_ROLE_OPTIONS}
                        allowDeselect={false}
                        {...userForm.getInputProps('role')}
                      />
                    </Group>
                    <Group justify="flex-end">
                      <Button
                        type="submit"
                        color="navy"
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        loading={creatingUser}
                      >
                        Aggiungi al team
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Card>

              {createdUsers.length > 0 && (
                <Card withBorder p="md" radius="md">
                  <Text fw={600} mb="xs">Membri creati ({createdUsers.length})</Text>
                  <List spacing="xs" size="sm" icon={
                    <ThemeIcon color="green" size={20} radius="xl">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }>
                    {createdUsers.map((u) => (
                      <List.Item key={u.id}>
                        {u.firstName} {u.lastName} — {u.email}{' '}
                        <Badge size="sm" color="navy" variant="light">{u.role}</Badge>
                      </List.Item>
                    ))}
                  </List>
                </Card>
              )}

              <Group justify="space-between" mt="md">
                <Button
                  variant="light"
                  color="navy"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(1)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    color="gray"
                    onClick={handleSkipStep}
                    loading={submitting}
                  >
                    Salta
                  </Button>
                  <Button
                    color="navy"
                    onClick={handleContinueStep}
                    rightSection={<IconArrowRight size={18} />}
                    loading={submitting}
                  >
                    Continua
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {/* Step 3: Insegnanti */}
          {active === 3 && (
            <Stack gap="lg" py="xl" maw={560} mx="auto">
              <Title order={2} ta="center">Aggiungi Insegnanti</Title>
              <Text c="dimmed" ta="center">
                Crea i profili dei docenti della tua scuola.
              </Text>

              {data?.stats && data.stats.teachers > 0 && (
                <Alert icon={<IconCheck />} color="green">
                  Hai {data.stats.teachers} insegnante/i nel sistema.
                </Alert>
              )}

              <Card withBorder p="lg" radius="md">
                <form onSubmit={teacherForm.onSubmit(handleCreateTeacher)}>
                  <Stack gap="sm">
                    <Group gap="xs">
                      <ThemeIcon size="md" radius="md" color="amber" variant="light">
                        <IconUserPlus size={16} />
                      </ThemeIcon>
                      <Text fw={600}>Nuovo insegnante</Text>
                    </Group>
                    <Group grow>
                      <TextInput
                        label="Nome"
                        placeholder="Laura"
                        {...teacherForm.getInputProps('firstName')}
                      />
                      <TextInput
                        label="Cognome"
                        placeholder="Bianchi"
                        {...teacherForm.getInputProps('lastName')}
                      />
                    </Group>
                    <TextInput
                      label="Email"
                      placeholder="laura.bianchi@scuola.it"
                      {...teacherForm.getInputProps('email')}
                    />
                    <Group justify="flex-end">
                      <Button
                        type="submit"
                        color="navy"
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        loading={creatingTeacher}
                      >
                        Aggiungi insegnante
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Card>

              {createdTeachers.length > 0 && (
                <Card withBorder p="md" radius="md">
                  <Text fw={600} mb="xs">Insegnanti creati ({createdTeachers.length})</Text>
                  <List spacing="xs" size="sm" icon={
                    <ThemeIcon color="green" size={20} radius="xl">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }>
                    {createdTeachers.map((t) => (
                      <List.Item key={t.id}>
                        {t.firstName} {t.lastName} — {t.email}
                      </List.Item>
                    ))}
                  </List>
                </Card>
              )}

              {createdTeachers.length === 0 && (!data?.stats || data.stats.teachers === 0) && (
                <Alert icon={<IconAlertCircle />} color="amber">
                  Non hai ancora aggiunto insegnanti. Aggiungine almeno uno per poter creare le classi.
                </Alert>
              )}

              <Group justify="space-between" mt="md">
                <Button
                  variant="light"
                  color="navy"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(2)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    color="gray"
                    onClick={handleSkipStep}
                    loading={submitting}
                  >
                    Salta
                  </Button>
                  <Button
                    color="navy"
                    onClick={handleContinueStep}
                    rightSection={<IconArrowRight size={18} />}
                    loading={submitting}
                  >
                    Continua
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {/* Step 4: Classi */}
          {active === 4 && (
            <Stack gap="lg" py="xl" maw={560} mx="auto">
              <Title order={2} ta="center">Crea le Classi</Title>
              <Text c="dimmed" ta="center">
                Una classe richiede un corso, un insegnante e una data di inizio.
              </Text>

              {data?.stats && data.stats.classes > 0 && (
                <Alert icon={<IconCheck />} color="green">
                  Hai {data.stats.classes} classe/i nel sistema.
                </Alert>
              )}

              {loadingSelects ? (
                <Center py="lg">
                  <Loader color="navy" />
                </Center>
              ) : (
                <>
                  {teachers.length === 0 && (
                    <Alert icon={<IconAlertCircle />} color="amber">
                      Non ci sono insegnanti disponibili. Torna allo step precedente per crearne uno.
                      <Group mt="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="navy"
                          leftSection={<IconArrowLeft size={14} />}
                          onClick={() => setActive(3)}
                        >
                          Vai agli Insegnanti
                        </Button>
                      </Group>
                    </Alert>
                  )}

                  {courses.length === 0 && (
                    <Alert icon={<IconAlertCircle />} color="amber">
                      Non ci sono corsi disponibili. Crea un corso per poter creare una classe.
                      <Group mt="xs">
                        <Button
                          size="xs"
                          variant="light"
                          color="navy"
                          leftSection={<IconPlus size={14} />}
                          onClick={() => setShowCourseForm((v) => !v)}
                        >
                          {showCourseForm ? 'Chiudi' : 'Crea corso inline'}
                        </Button>
                      </Group>
                    </Alert>
                  )}

                  {/* Form corso inline (opzionale / sempre disponibile) */}
                  {courses.length > 0 && (
                    <Group justify="flex-end">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="navy"
                        leftSection={<IconPlus size={14} />}
                        onClick={() => setShowCourseForm((v) => !v)}
                      >
                        {showCourseForm ? 'Chiudi creazione corso' : 'Crea nuovo corso'}
                      </Button>
                    </Group>
                  )}

                  <Collapse in={showCourseForm}>
                    <Card withBorder p="lg" radius="md">
                      <form onSubmit={courseForm.onSubmit(handleCreateCourse)}>
                        <Stack gap="sm">
                          <Group gap="xs">
                            <ThemeIcon size="md" radius="md" color="navy" variant="light">
                              <IconBook size={16} />
                            </ThemeIcon>
                            <Text fw={600}>Nuovo corso</Text>
                          </Group>
                          <TextInput
                            label="Nome corso"
                            placeholder="es. Chitarra Livello Base"
                            {...courseForm.getInputProps('name')}
                          />
                          <Group grow>
                            <TextInput
                              label="Categoria (opzionale)"
                              placeholder="Musica"
                              {...courseForm.getInputProps('category')}
                            />
                            <TextInput
                              label="Livello (opzionale)"
                              placeholder="Base"
                              {...courseForm.getInputProps('level')}
                            />
                          </Group>
                          <Group justify="flex-end">
                            <Button
                              type="submit"
                              color="navy"
                              variant="light"
                              leftSection={<IconPlus size={16} />}
                              loading={creatingCourse}
                            >
                              Crea corso
                            </Button>
                          </Group>
                        </Stack>
                      </form>
                    </Card>
                  </Collapse>

                  {/* Form classe */}
                  <Card withBorder p="lg" radius="md">
                    <form onSubmit={classForm.onSubmit(handleCreateClass)}>
                      <Stack gap="sm">
                        <Group gap="xs">
                          <ThemeIcon size="md" radius="md" color="amber" variant="light">
                            <IconPlus size={16} />
                          </ThemeIcon>
                          <Text fw={600}>Nuova classe</Text>
                        </Group>
                        <TextInput
                          label="Nome classe"
                          placeholder="es. Chitarra Lun-Mer 17:00"
                          {...classForm.getInputProps('name')}
                        />
                        <Select
                          label="Corso"
                          placeholder={courses.length ? 'Seleziona un corso' : 'Nessun corso disponibile'}
                          data={courses.map((c) => ({ value: c.id, label: c.name }))}
                          disabled={courses.length === 0}
                          searchable
                          {...classForm.getInputProps('courseId')}
                        />
                        <Select
                          label="Insegnante"
                          placeholder={teachers.length ? 'Seleziona un insegnante' : 'Nessun insegnante disponibile'}
                          data={teachers.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
                          disabled={teachers.length === 0}
                          searchable
                          {...classForm.getInputProps('teacherId')}
                        />
                        <DateInput
                          label="Data di inizio"
                          valueFormat="DD/MM/YYYY"
                          {...classForm.getInputProps('startDate')}
                        />
                        <Group justify="flex-end">
                          <Button
                            type="submit"
                            color="navy"
                            variant="light"
                            leftSection={<IconPlus size={16} />}
                            loading={creatingClass}
                            disabled={courses.length === 0 || teachers.length === 0}
                          >
                            Crea classe
                          </Button>
                        </Group>
                      </Stack>
                    </form>
                  </Card>

                  {createdClasses.length > 0 && (
                    <Card withBorder p="md" radius="md">
                      <Text fw={600} mb="xs">Classi create ({createdClasses.length})</Text>
                      <List spacing="xs" size="sm" icon={
                        <ThemeIcon color="green" size={20} radius="xl">
                          <IconCheck size={12} />
                        </ThemeIcon>
                      }>
                        {createdClasses.map((c) => (
                          <List.Item key={c.id}>{c.name}</List.Item>
                        ))}
                      </List>
                    </Card>
                  )}
                </>
              )}

              <Divider />

              <Group justify="space-between" mt="md">
                <Button
                  variant="light"
                  color="navy"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(3)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    color="gray"
                    onClick={handleSkipStep}
                    loading={submitting}
                  >
                    Salta
                  </Button>
                  <Button
                    color="green"
                    onClick={handleComplete}
                    loading={submitting}
                    rightSection={<IconCheck size={18} />}
                  >
                    Completa Setup
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}
        </Paper>

        {/* Progress Info */}
        <Center mt="lg">
          <Text c="white" size="sm" style={{ opacity: 0.8 }}>
            Passaggio {active + 1} di 5
          </Text>
        </Center>
      </Container>
    </Box>
  );
}
