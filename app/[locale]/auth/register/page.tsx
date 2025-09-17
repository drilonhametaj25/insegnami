'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Group,
  Alert,
  Stack,
  Center,
  Checkbox,
  Select,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconSchool, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { isSaaSMode } from '@/lib/config';

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  schoolName: string;
  role: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const form = useForm<RegisterForm>({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      schoolName: '',
      role: 'admin',
      acceptTerms: false,
      acceptPrivacy: false,
    },
    validate: {
      firstName: (value) => !value && 'Nome richiesto',
      lastName: (value) => !value && 'Cognome richiesto',
      email: (value) => {
        if (!value) return 'Email richiesta';
        if (!/^\S+@\S+$/.test(value)) return 'Email non valida';
      },
      password: (value) => {
        if (!value) return 'Password richiesta';
        if (value.length < 8) return 'Password deve essere almeno 8 caratteri';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) 
          return 'Password deve contenere almeno una lettera minuscola, maiuscola e un numero';
      },
      confirmPassword: (value, values) => 
        value !== values.password && 'Le password non corrispondono',
      schoolName: (value) => !value && 'Nome della scuola richiesto',
      acceptTerms: (value) => !value && 'Devi accettare i termini di servizio',
      acceptPrivacy: (value) => !value && 'Devi accettare la privacy policy',
    },
  });

  // Redirect if not in SaaS mode
  if (!isSaaSMode) {
    router.replace('/auth/login');
    return null;
  }

  const handleSubmit = async (values: RegisterForm) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          password: values.password,
          schoolName: values.schoolName,
          role: values.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la registrazione');
      }

      setSuccess(true);
      notifications.show({
        title: 'Registrazione completata!',
        message: 'Controlla la tua email per confermare l\'account',
        color: 'green',
        icon: <IconCheck size="1rem" />,
      });

      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Errore durante la registrazione. Riprova più tardi.');
      
      notifications.show({
        title: 'Errore di registrazione',
        message: 'Si è verificato un errore. Riprova più tardi.',
        color: 'red',
        icon: <IconAlertCircle size="1rem" />,
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container size="xs" py={80}>
        <Center>
          <Stack align="center" gap="md">
            <IconCheck size="4rem" color="#51cf66" />
            <Title order={2} ta="center" c="green">
              Registrazione Completata!
            </Title>
            <Text ta="center" c="dimmed">
              Ti abbiamo inviato una email di conferma.
              <br />
              Controlla la tua casella di posta e clicca sul link per attivare il tuo account.
            </Text>
            <Text ta="center" size="sm" c="dimmed">
              Verrai reindirizzato alla pagina di login tra pochi secondi...
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="sm" py={80}>
      <Center>
        <Stack align="center" gap="md" mb="xl">
          <IconSchool size="3rem" color="#0ea5e9" />
          <Title order={1} ta="center" c="blue">
            InsegnaMi.pro
          </Title>
          <Text c="dimmed" ta="center">
            Crea il tuo account per iniziare
          </Text>
        </Stack>
      </Center>

      <Paper radius="md" p="xl" withBorder>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {error && (
              <Alert
                icon={<IconAlertCircle size="1rem" />}
                title="Errore di registrazione"
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            <Group grow>
              <TextInput
                required
                label="Nome"
                placeholder="Il tuo nome"
                value={form.values.firstName}
                onChange={(event) => form.setFieldValue('firstName', event.currentTarget.value)}
                error={form.errors.firstName}
                radius="md"
              />

              <TextInput
                required
                label="Cognome"
                placeholder="Il tuo cognome"
                value={form.values.lastName}
                onChange={(event) => form.setFieldValue('lastName', event.currentTarget.value)}
                error={form.errors.lastName}
                radius="md"
              />
            </Group>

            <TextInput
              required
              label="Email"
              placeholder="tua.email@esempio.it"
              value={form.values.email}
              onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
              error={form.errors.email}
              radius="md"
            />

            <TextInput
              required
              label="Nome della Scuola"
              placeholder="Es: Liceo Scientifico Galilei"
              value={form.values.schoolName}
              onChange={(event) => form.setFieldValue('schoolName', event.currentTarget.value)}
              error={form.errors.schoolName}
              radius="md"
            />

            <Select
              required
              label="Ruolo"
              placeholder="Seleziona il tuo ruolo"
              value={form.values.role}
              onChange={(value) => form.setFieldValue('role', value || '')}
              data={[
                { value: 'admin', label: 'Amministratore' },
                { value: 'director', label: 'Dirigente Scolastico' },
                { value: 'secretary', label: 'Segreteria' },
              ]}
              radius="md"
            />

            <PasswordInput
              required
              label="Password"
              placeholder="La tua password"
              value={form.values.password}
              onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
              error={form.errors.password}
              radius="md"
            />

            <PasswordInput
              required
              label="Conferma Password"
              placeholder="Conferma la password"
              value={form.values.confirmPassword}
              onChange={(event) => form.setFieldValue('confirmPassword', event.currentTarget.value)}
              error={form.errors.confirmPassword}
              radius="md"
            />

            <Stack gap="xs" mt="md">
              <Checkbox
                label="Accetto i termini di servizio"
                checked={form.values.acceptTerms}
                onChange={(event) => form.setFieldValue('acceptTerms', event.currentTarget.checked)}
                error={form.errors.acceptTerms}
              />

              <Checkbox
                label="Accetto la privacy policy"
                checked={form.values.acceptPrivacy}
                onChange={(event) => form.setFieldValue('acceptPrivacy', event.currentTarget.checked)}
                error={form.errors.acceptPrivacy}
              />
            </Stack>

            <Button
              type="submit"
              radius="md"
              size="md"
              loading={loading}
              fullWidth
              mt="lg"
            >
              Crea Account
            </Button>

            <Text ta="center" mt="md">
              Hai già un account?{' '}
              <Anchor component={Link} href="/auth/login" fw={500}>
                Accedi
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>

      <Text ta="center" size="sm" c="dimmed" mt="xl">
        © 2024 InsegnaMi.pro. Tutti i diritti riservati.
      </Text>
    </Container>
  );
}
