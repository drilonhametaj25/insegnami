'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Paper,
  TextInput,
  PasswordInput,
  Checkbox,
  Button,
  Title,
  Text,
  Anchor,
  Container,
  Group,
  Alert,
  Stack,
  Center,
  Box,
  Loader,
  BackgroundImage,
  Overlay,
  rem,
  Divider,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { 
  IconAlertCircle, 
  IconSchool, 
  IconMail, 
  IconLock,
  IconArrowRight,
  IconShield,
  IconUsers,
  IconCalendar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { isSaaSMode } from '@/lib/config';

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
  tenantId?: string;
}

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  const form = useForm<LoginForm>({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
      tenantId: '',
    },
    validate: {
      email: (value) => {
        if (!value) return 'Email richiesta';
        if (!/^\S+@\S+$/.test(value)) return 'Email non valida';
      },
      password: (value) => {
        if (!value) return 'Password richiesta';
        if (value.length < 6) return 'Password deve essere almeno 6 caratteri';
      },
    },
  });

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        tenantId: values.tenantId,
        redirect: false,
      });

      if (result?.error) {
        setError('Credenziali non valide');
        notifications.show({
          title: 'Errore di accesso',
          message: 'Email o password non corretti',
          color: 'red',
          icon: <IconAlertCircle size="1rem" />,
        });
      } else if (result?.ok) {
        notifications.show({
          title: 'Accesso effettuato',
          message: 'Benvenuto nella piattaforma!',
          color: 'green',
        });
        
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Errore durante l\'accesso. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (verified === 'true') {
      notifications.show({
        title: 'Email verificata!',
        message: 'Il tuo account è stato attivato. Ora puoi accedere.',
        color: 'green',
      });
    }
    
    if (errorParam === 'invalid-verification') {
      notifications.show({
        title: 'Verifica non valida',
        message: 'Il link di verifica non è valido o è già stato utilizzato.',
        color: 'red',
      });
    }
  }, [verified, errorParam]);

  return (
    <Box 
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
      }}
    >
      {/* Background Pattern */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px',
        }}
      />
      
      <Container size="xs" style={{ position: 'relative', zIndex: 1 }}>
        <Center style={{ minHeight: '100vh' }}>
          <Stack align="center" gap="xl" w="100%">
            {/* Logo and Brand Section */}
            <Paper
              radius="xl"
              p="xl"
              shadow="xl"
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Stack align="center" gap="md">
                <ThemeIcon
                  size={80}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'purple' }}
                >
                  <IconSchool size={50} />
                </ThemeIcon>
                <div>
                  <Title
                    order={1}
                    ta="center"
                    style={{
                      background: 'linear-gradient(45deg, #667eea, #764ba2)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      fontSize: rem(36),
                      fontWeight: 900,
                      letterSpacing: '-1px',
                    }}
                  >
                    InsegnaMi.pro
                  </Title>
                  <Text c="dimmed" ta="center" size="sm" mt={4}>
                    Piattaforma di gestione scolastica moderna
                  </Text>
                </div>
              </Stack>
            </Paper>

            {/* Login Form */}
            <Paper
              radius="xl"
              p={40}
              shadow="xl"
              w="100%"
              maw={450}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Stack gap="lg">
                <div>
                  <Title order={2} ta="center" c="dark" size="h3">
                    Accedi al tuo account
                  </Title>
                  <Text c="dimmed" ta="center" size="sm" mt={4}>
                    Inserisci le tue credenziali per continuare
                  </Text>
                </div>

                <form onSubmit={form.onSubmit(handleSubmit)}>
                  <Stack gap="md">
                    {error && (
                      <Alert
                        icon={<IconAlertCircle size="1rem" />}
                        title="Errore di accesso"
                        color="red"
                        variant="light"
                        radius="md"
                      >
                        {error}
                      </Alert>
                    )}

                    <TextInput
                      required
                      label="Email"
                      placeholder="tua.email@esempio.it"
                      leftSection={<IconMail size="1rem" />}
                      value={form.values.email}
                      onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                      error={form.errors.email}
                      radius="md"
                      size="md"
                      styles={{
                        input: {
                          border: '2px solid #e9ecef',
                          '&:focus': {
                            borderColor: '#667eea',
                            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                          },
                        },
                      }}
                    />

                    <PasswordInput
                      required
                      label="Password"
                      placeholder="La tua password"
                      leftSection={<IconLock size="1rem" />}
                      value={form.values.password}
                      onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                      error={form.errors.password}
                      radius="md"
                      size="md"
                      styles={{
                        input: {
                          border: '2px solid #e9ecef',
                          '&:focus': {
                            borderColor: '#667eea',
                            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                          },
                        },
                      }}
                    />

                    {isSaaSMode && (
                      <TextInput
                        label="ID Scuola (Opzionale)"
                        placeholder="Codice della tua scuola"
                        value={form.values.tenantId}
                        onChange={(event) => form.setFieldValue('tenantId', event.currentTarget.value)}
                        radius="md"
                        size="md"
                        description="Lascia vuoto per usare la scuola predefinita"
                        styles={{
                          input: {
                            border: '2px solid #e9ecef',
                            '&:focus': {
                              borderColor: '#667eea',
                              boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                            },
                          },
                        }}
                      />
                    )}

                    <Group justify="space-between" mt="md">
                      <Checkbox
                        label="Ricordami"
                        checked={form.values.rememberMe}
                        onChange={(event) => form.setFieldValue('rememberMe', event.currentTarget.checked)}
                        color="blue"
                      />
                      <Anchor component={Link} href="/auth/forgot-password" size="sm" c="blue">
                        Password dimenticata?
                      </Anchor>
                    </Group>

                    <Button
                      type="submit"
                      radius="md"
                      size="md"
                      loading={loading}
                      fullWidth
                      rightSection={<IconArrowRight size="1rem" />}
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'purple' }}
                      style={{
                        height: rem(50),
                        fontSize: rem(16),
                        fontWeight: 600,
                      }}
                    >
                      Accedi
                    </Button>

                    {isSaaSMode && (
                      <>
                        <Divider label="oppure" labelPosition="center" />
                        <Text ta="center" size="sm">
                          Non hai ancora un account?{' '}
                          <Anchor component={Link} href="/auth/register" fw={600} c="blue">
                            Registrati ora
                          </Anchor>
                        </Text>
                      </>
                    )}
                  </Stack>
                </form>
              </Stack>
            </Paper>

            {/* Features Section */}
            <Paper
              radius="xl"
              p="lg"
              w="100%"
              maw={450}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <Group justify="center" gap="xl">
                <Stack align="center" gap={4}>
                  <ThemeIcon variant="light" color="white" size="lg" radius="xl">
                    <IconShield size="1.2rem" />
                  </ThemeIcon>
                  <Text size="xs" c="white" fw={500}>Sicuro</Text>
                </Stack>
                <Stack align="center" gap={4}>
                  <ThemeIcon variant="light" color="white" size="lg" radius="xl">
                    <IconUsers size="1.2rem" />
                  </ThemeIcon>
                  <Text size="xs" c="white" fw={500}>Multi-utente</Text>
                </Stack>
                <Stack align="center" gap={4}>
                  <ThemeIcon variant="light" color="white" size="lg" radius="xl">
                    <IconCalendar size="1.2rem" />
                  </ThemeIcon>
                  <Text size="xs" c="white" fw={500}>Completo</Text>
                </Stack>
              </Group>
            </Paper>

            {/* Footer */}
            <Box mt="md">
              <Text ta="center" size="xs" c="rgba(255, 255, 255, 0.7)">
                © 2024 InsegnaMi.pro. Tutti i diritti riservati.
              </Text>
              <Group justify="center" mt="xs" gap="md">
                <Anchor href="#" size="xs" c="rgba(255, 255, 255, 0.7)">
                  Termini di Servizio
                </Anchor>
                <Anchor href="#" size="xs" c="rgba(255, 255, 255, 0.7)">
                  Privacy Policy
                </Anchor>
                <Anchor href="#" size="xs" c="rgba(255, 255, 255, 0.7)">
                  Supporto
                </Anchor>
              </Group>
            </Box>
          </Stack>
        </Center>
      </Container>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense 
      fallback={
        <Box 
          style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="white" />
            <Text c="white" size="lg">Caricamento...</Text>
          </Stack>
        </Box>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
