'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Alert,
  Stack,
  Center,
  Loader,
  Group,
  Anchor,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const form = useForm<ResetPasswordForm>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    validate: {
      password: (value) => {
        if (!value) return t('passwordRequired');
        if (value.length < 8) return t('passwordMinLength');
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return t('passwordComplexity');
        }
        return null;
      },
      confirmPassword: (value, values) => {
        if (!value) return t('confirmPasswordRequired');
        if (value !== values.password) return t('passwordsDoNotMatch');
        return null;
      },
    },
  });

  // Validate token on mount
  useEffect(() => {
    if (!token || !email) {
      setError(t('invalidResetLink'));
      setIsValidating(false);
      return;
    }

    validateToken();
  }, [token, email]);

  const validateToken = async () => {
    try {
      const response = await fetch('/api/auth/validate-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setTokenValid(true);
        setError(null);
      } else {
        setError(data.error || t('invalidOrExpiredToken'));
      }
    } catch (error) {
      console.error('Token validation error:', error);
      setError(t('validationError'));
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (values: ResetPasswordForm) => {
    if (!tokenValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        notifications.show({
          title: t('success'),
          message: t('passwordResetSuccess'),
          color: 'green',
          icon: <IconCheck size={18} />,
        });

        // Redirect to login after successful reset
        setTimeout(() => {
          router.push('/auth/login?message=password-reset-success');
        }, 2000);
      } else {
        setError(data.error || t('resetError'));
        notifications.show({
          title: t('error'),
          message: data.error || t('resetError'),
          color: 'red',
          icon: <IconX size={18} />,
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      const errorMessage = t('networkError');
      setError(errorMessage);
      notifications.show({
        title: t('error'),
        message: errorMessage,
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <Container size="sm" py={80}>
        <Paper p="xl" withBorder>
          <Center>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text>{t('validatingResetLink')}</Text>
            </Stack>
          </Center>
        </Paper>
      </Container>
    );
  }

  if (!tokenValid || error) {
    return (
      <Container size="sm" py={80}>
        <Paper p="xl" withBorder>
          <Stack align="center" gap="md">
            <Title order={2} ta="center">{t('resetPasswordTitle')}</Title>
            
            <Alert color="red" variant="light" w="100%">
              <Text ta="center">
                {error || t('invalidResetLink')}
              </Text>
            </Alert>

            <Text c="dimmed" ta="center" size="sm">
              {t('resetLinkInstructions')}
            </Text>

            <Group>
              <Button 
                component={Link}
                href="/auth/forgot-password"
                variant="light"
                leftSection={<IconArrowLeft size={16} />}
              >
                {t('requestNewLink')}
              </Button>
              <Button 
                component={Link}
                href="/auth/login"
                variant="outline"
              >
                {t('backToLogin')}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py={80}>
      <Paper p="xl" withBorder>
        <Title order={2} ta="center" mb="lg">
          {t('resetPasswordTitle')}
        </Title>

        <Text c="dimmed" ta="center" mb="xl" size="sm">
          {t('enterNewPassword')}
        </Text>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <PasswordInput
              label={t('newPassword')}
              placeholder={t('enterNewPassword')}
              required
              disabled={isLoading}
              {...form.getInputProps('password')}
            />

            <PasswordInput
              label={t('confirmNewPassword')}
              placeholder={t('confirmNewPassword')}
              required
              disabled={isLoading}
              {...form.getInputProps('confirmPassword')}
            />

            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              loading={isLoading}
              disabled={!form.isValid()}
              fullWidth
              size="lg"
            >
              {t('resetPassword')}
            </Button>

            <Text ta="center" size="sm">
              <Anchor component={Link} href="/auth/login">
                {t('backToLogin')}
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <Container size="sm" py={80}>
        <Paper p="xl" withBorder>
          <Center>
            <Loader size="lg" />
          </Center>
        </Paper>
      </Container>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
