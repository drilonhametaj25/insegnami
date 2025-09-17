'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Modal,
  Title,
  Text,
  PasswordInput,
  Button,
  Alert,
  Stack,
  Group,
  Progress,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconLock, IconShieldCheck } from '@tabler/icons-react';

interface ChangePasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ opened, onClose }: ChangePasswordModalProps) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangePasswordForm>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) => {
        if (!value) return t('currentPasswordRequired');
        return null;
      },
      newPassword: (value) => {
        if (!value) return t('newPasswordRequired');
        if (value.length < 8) return t('passwordMinLength');
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return t('passwordComplexity');
        }
        return null;
      },
      confirmPassword: (value, values) => {
        if (!value) return t('confirmPasswordRequired');
        if (value !== values.newPassword) return t('passwordsDoNotMatch');
        return null;
      },
    },
  });

  // Calculate password strength
  const getPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[a-z]/.test(password)) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/\d/.test(password)) score += 25;
    return score;
  };

  const getPasswordStrengthColor = (score: number) => {
    if (score < 50) return 'red';
    if (score < 75) return 'yellow';
    return 'green';
  };

  const getPasswordStrengthLabel = (score: number) => {
    if (score < 25) return t('passwordWeak');
    if (score < 50) return t('passwordFair');
    if (score < 75) return t('passwordGood');
    return t('passwordStrong');
  };

  const passwordStrength = getPasswordStrength(form.values.newPassword);

  const handleSubmit = async (values: ChangePasswordForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        notifications.show({
          title: t('success'),
          message: t('passwordChangedSuccess'),
          color: 'green',
          icon: <IconCheck size={18} />,
        });

        // Reset form and close modal
        form.reset();
        onClose();
      } else {
        setError(data.error || t('changePasswordError'));
        notifications.show({
          title: t('error'),
          message: data.error || t('changePasswordError'),
          color: 'red',
          icon: <IconX size={18} />,
        });
      }
    } catch (error) {
      console.error('Change password error:', error);
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

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <IconLock size={20} />
          <Title order={3}>{t('changePassword')}</Title>
        </Group>
      }
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('changePasswordDescription')}
          </Text>

          <PasswordInput
            label={t('currentPassword')}
            placeholder={t('enterCurrentPassword')}
            required
            disabled={isLoading}
            {...form.getInputProps('currentPassword')}
          />

          <div>
            <PasswordInput
              label={t('newPassword')}
              placeholder={t('enterNewPassword')}
              required
              disabled={isLoading}
              {...form.getInputProps('newPassword')}
            />
            {form.values.newPassword && (
              <Stack gap="xs" mt="xs">
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">{t('passwordStrength')}</Text>
                  <Text size="xs" c={getPasswordStrengthColor(passwordStrength)}>
                    {getPasswordStrengthLabel(passwordStrength)}
                  </Text>
                </Group>
                <Progress 
                  value={passwordStrength} 
                  color={getPasswordStrengthColor(passwordStrength)}
                  size="xs"
                />
              </Stack>
            )}
          </div>

          <PasswordInput
            label={t('confirmNewPassword')}
            placeholder={t('confirmNewPassword')}
            required
            disabled={isLoading}
            {...form.getInputProps('confirmPassword')}
          />

          {error && (
            <Alert color="red" variant="light" icon={<IconX size={16} />}>
              {error}
            </Alert>
          )}

          <Alert color="blue" variant="light" icon={<IconShieldCheck size={16} />}>
            <Text size="sm">
              {t('passwordRequirements')}
            </Text>
          </Alert>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={handleClose}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              disabled={!form.isValid() || passwordStrength < 75}
            >
              {t('changePassword')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
