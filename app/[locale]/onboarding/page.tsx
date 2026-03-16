'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Stepper,
  Button,
  Group,
  TextInput,
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
  rem
} from '@mantine/core';
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
  IconConfetti
} from '@tabler/icons-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

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

const STAGES = ['INITIAL', 'SCHOOL', 'TEAM', 'TEACHERS', 'CLASSES', 'COMPLETE'];

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [active, setActive] = useState(0);

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
      setData((prev) => prev ? { ...prev, tenant: result.tenant } : null);

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
      <Box style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <Loader size="xl" color="white" />
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: rem(40) }}>
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
        <Paper shadow="xl" radius="xl" p="xl" style={{ background: 'white' }}>
          <Stepper
            active={active}
            onStepClick={setActive}
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
                    leftSection={<IconArrowRight size={20} />}
                    onClick={() => router.push(`/${locale}/dashboard`)}
                  >
                    Vai alla Dashboard
                  </Button>
                </Stack>
              </Center>
            </Stepper.Completed>
          </Stepper>

          {/* Step Content */}
          {active === 0 && (
            <Stack gap="lg" py="xl">
              <Center>
                <ThemeIcon size={80} radius="xl" color="violet" variant="light">
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
                    <ThemeIcon size="lg" radius="md" color="blue" variant="light">
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
                    <ThemeIcon size="lg" radius="md" color="orange" variant="light">
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
                    <ThemeIcon size="lg" radius="md" color="grape" variant="light">
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
                    leftSection={<IconArrowLeft size={18} />}
                    onClick={() => setActive(0)}
                  >
                    Indietro
                  </Button>
                  <Button
                    type="submit"
                    rightSection={<IconArrowRight size={18} />}
                    loading={submitting}
                  >
                    Continua
                  </Button>
                </Group>
              </Stack>
            </form>
          )}

          {active === 2 && (
            <Stack gap="lg" py="xl" maw={500} mx="auto">
              <Title order={2} ta="center">Invita il Team</Title>
              <Text c="dimmed" ta="center">
                Aggiungi colleghi per collaborare nella gestione della scuola.
              </Text>

              <Alert icon={<IconAlertCircle />} color="blue">
                Questo passaggio è opzionale. Puoi invitare altri utenti in qualsiasi momento
                dalla sezione Utenti nella dashboard.
              </Alert>

              <Card withBorder p="lg" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Ruoli disponibili:</Text>
                  <Group gap="xs">
                    <Badge color="violet">Dirigente</Badge>
                    <Badge color="blue">Segreteria</Badge>
                    <Badge color="green">Amministratore</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Potrai gestire i permessi di ogni utente dalla dashboard.
                  </Text>
                </Stack>
              </Card>

              <Group justify="space-between" mt="xl">
                <Button
                  variant="light"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(1)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    onClick={handleSkipStep}
                    loading={submitting}
                  >
                    Salta
                  </Button>
                  <Button
                    component={Link}
                    href={`/${locale}/dashboard/admin/users`}
                    rightSection={<IconArrowRight size={18} />}
                  >
                    Vai a Gestione Utenti
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {active === 3 && (
            <Stack gap="lg" py="xl" maw={500} mx="auto">
              <Title order={2} ta="center">Aggiungi Insegnanti</Title>
              <Text c="dimmed" ta="center">
                Crea i profili dei docenti della tua scuola.
              </Text>

              {data?.stats && data.stats.teachers > 0 ? (
                <Alert icon={<IconCheck />} color="green">
                  Hai già {data.stats.teachers} insegnante/i nel sistema!
                </Alert>
              ) : (
                <Alert icon={<IconAlertCircle />} color="orange">
                  Non hai ancora aggiunto insegnanti. Aggiungi almeno un insegnante per iniziare.
                </Alert>
              )}

              <Group justify="space-between" mt="xl">
                <Button
                  variant="light"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(2)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="subtle"
                    onClick={handleSkipStep}
                    loading={submitting}
                  >
                    Salta
                  </Button>
                  <Button
                    component={Link}
                    href={`/${locale}/dashboard/teachers`}
                    rightSection={<IconArrowRight size={18} />}
                  >
                    Vai a Gestione Insegnanti
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}

          {active === 4 && (
            <Stack gap="lg" py="xl" maw={500} mx="auto">
              <Title order={2} ta="center">Crea le Classi</Title>
              <Text c="dimmed" ta="center">
                Configura le classi della tua scuola.
              </Text>

              {data?.stats && data.stats.classes > 0 ? (
                <Alert icon={<IconCheck />} color="green">
                  Hai già {data.stats.classes} classe/i nel sistema!
                </Alert>
              ) : (
                <Alert icon={<IconAlertCircle />} color="orange">
                  Non hai ancora creato classi. Crea almeno una classe per organizzare gli studenti.
                </Alert>
              )}

              <Group justify="space-between" mt="xl">
                <Button
                  variant="light"
                  leftSection={<IconArrowLeft size={18} />}
                  onClick={() => setActive(3)}
                >
                  Indietro
                </Button>
                <Group gap="sm">
                  <Button
                    variant="filled"
                    color="green"
                    onClick={handleComplete}
                    loading={submitting}
                    rightSection={<IconCheck size={18} />}
                  >
                    Completa Setup
                  </Button>
                  <Button
                    component={Link}
                    href={`/${locale}/dashboard/classes`}
                    variant="light"
                    rightSection={<IconArrowRight size={18} />}
                  >
                    Vai a Gestione Classi
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
