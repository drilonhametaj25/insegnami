import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface UseChangePasswordReturn {
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useChangePassword(): UseChangePasswordReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('auth');

  const changePassword = async (data: ChangePasswordData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        notifications.show({
          title: t('success'),
          message: t('passwordChangedSuccess'),
          color: 'green',
        });
        return true;
      } else {
        const errorMessage = result.error || t('changePasswordError');
        setError(errorMessage);
        notifications.show({
          title: t('error'),
          message: errorMessage,
          color: 'red',
        });
        return false;
      }
    } catch (error) {
      console.error('Change password error:', error);
      const errorMessage = t('networkError');
      setError(errorMessage);
      notifications.show({
        title: t('error'),
        message: errorMessage,
        color: 'red',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    changePassword,
    isLoading,
    error,
    clearError,
  };
}
