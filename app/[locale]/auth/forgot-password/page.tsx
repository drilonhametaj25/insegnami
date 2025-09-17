'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paper,
  TextInput,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Alert,
  Stack,
  Center,
  Box,
  Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconSchool, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const form = useForm<ForgotPasswordForm>({
    initialValues: {
      email: '',
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email richiesta';
        if (!/^\S+@\S+$/.test(value)) return 'Email non valida';
      },
    },
  });

  const handleSubmit = async (values: ForgotPasswordForm) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante l\'invio dell\'email');
      }

      setSuccess(true);
      notifications.show({
        title: 'Email inviata!',
        message: 'Controlla la tua casella di posta per le istruzioni',
        color: 'green',
        icon: <IconCheck size="1rem" />,
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      setError(error instanceof Error ? error.message : 'Errore durante l\'invio dell\'email. Riprova più tardi.');
      
      notifications.show({
        title: 'Errore',
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
              Email Inviata!
            </Title>
            <Text ta="center" c="dimmed">
              Ti abbiamo inviato un'email con le istruzioni per reimpostare la tua password.
              <br />
              Controlla la tua casella di posta (e anche lo spam).
            </Text>
            <Button
              component={Link}
              href="/auth/login"
              variant="light"
              leftSection={<IconArrowLeft size="1rem" />}
              mt="md"
            >
              Torna al Login
            </Button>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xs" py={80}>
      <Center>
        <Stack align="center" gap="md" mb="xl">
          <IconSchool size="3rem" color="#0ea5e9" />
          <Title order={1} ta="center" c="blue">
            InsegnaMi.pro
          </Title>
          <Text c="dimmed" ta="center">
            Recupera la tua password
          </Text>
        </Stack>
      </Center>

      <Paper radius="md" p="xl" withBorder>
        <Stack>
          <Box mb="lg">
            <Title order={3} mb="xs">
              Password Dimenticata?
            </Title>
            <Text size="sm" c="dimmed">
              Inserisci la tua email e ti invieremo un link per reimpostare la password.
            </Text>
          </Box>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              {error && (
                <Alert
                  icon={<IconAlertCircle size="1rem" />}
                  title="Errore"
                  color="red"
                  variant="light"
                >
                  {error}
                </Alert>
              )}

              <TextInput
                required
                label="Email"
                placeholder="tua.email@esempio.it"
                value={form.values.email}
                onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                error={form.errors.email}
                radius="md"
              />

              <Button
                type="submit"
                radius="md"
                size="md"
                loading={loading}
                fullWidth
                mt="md"
              >
                Invia Email di Recupero
              </Button>

              <Center mt="lg">
                <Anchor component={Link} href="/auth/login" size="sm">
                  <IconArrowLeft size="0.8rem" style={{ marginRight: '0.25rem' }} />
                  Torna al Login
                </Anchor>
              </Center>
            </Stack>
          </form>
        </Stack>
      </Paper>

      <Box mt="xl">
        <Text ta="center" size="sm" c="dimmed">
          © 2024 InsegnaMi.pro. Tutti i diritti riservati.
        </Text>
        <Group justify="center" mt="xs">
          <Anchor href="#" size="xs" c="dimmed">
            Supporto
          </Anchor>
          <Text size="xs" c="dimmed">•</Text>
          <Anchor href="#" size="xs" c="dimmed">
            Contatti
          </Anchor>
        </Group>
      </Box>
    </Container>
  );
}
