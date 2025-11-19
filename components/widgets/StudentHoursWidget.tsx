'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Text,
  Progress,
  Group,
  Stack,
  Badge,
  Alert,
  LoadingOverlay,
  ThemeIcon,
} from '@mantine/core';
import { IconClock, IconAlertCircle, IconPackage } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

interface HoursPackage {
  id: string;
  totalHours: number;
  remainingHours: number;
  expiryDate: string | null;
  isActive: boolean;
  course: {
    name: string;
    code: string;
  };
}

export function StudentHoursWidget() {
  const t = useTranslations();
  const [packages, setPackages] = useState<HoursPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/hours-packages?isActive=true');
      
      if (response.ok) {
        const data = await response.json();
        setPackages(data);
      }
    } catch (error) {
      console.error('Error fetching hours packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card withBorder>
        <LoadingOverlay visible />
        <Text size="sm" c="dimmed" style={{ minHeight: 100 }}>
          {t('loading')}
        </Text>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card withBorder>
        <Group mb="md">
          <ThemeIcon size="lg" radius="md" variant="light" color="gray">
            <IconPackage size="1.2rem" />
          </ThemeIcon>
          <div>
            <Text fw={600}>{t('hoursPackages.title')}</Text>
            <Text size="xs" c="dimmed">
              {t('hoursPackages.noActivePackages')}
            </Text>
          </div>
        </Group>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Group mb="md">
        <ThemeIcon size="lg" radius="md" variant="light" color="blue">
          <IconClock size="1.2rem" />
        </ThemeIcon>
        <div>
          <Text fw={600}>{t('hoursPackages.yourPackages')}</Text>
          <Text size="xs" c="dimmed">
            {packages.length} {packages.length === 1 ? t('hoursPackages.activePackage') : t('hoursPackages.activePackages')}
          </Text>
        </div>
      </Group>

      <Stack gap="md">
        {packages.map((pkg) => {
          const usedHours = parseFloat(pkg.totalHours.toString()) - parseFloat(pkg.remainingHours.toString());
          const usagePercent = (usedHours / parseFloat(pkg.totalHours.toString())) * 100;
          const isLow = usagePercent > 80;
          const isExpired = pkg.expiryDate && new Date(pkg.expiryDate) < new Date();

          return (
            <Card key={pkg.id} withBorder bg="gray.0" p="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="sm">
                    {pkg.course.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {pkg.course.code}
                  </Text>
                </div>
                {isLow && !isExpired && (
                  <Badge color="orange" variant="light" size="sm">
                    {t('hoursPackages.lowHours')}
                  </Badge>
                )}
                {isExpired && (
                  <Badge color="red" variant="light" size="sm">
                    {t('expired')}
                  </Badge>
                )}
              </Group>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {t('hoursPackages.remaining')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {parseFloat(pkg.remainingHours.toString()).toFixed(1)} / {parseFloat(pkg.totalHours.toString()).toFixed(1)} {t('hours')}
                  </Text>
                </Group>

                <Progress
                  value={100 - usagePercent}
                  color={isLow ? 'orange' : 'blue'}
                  size="md"
                  radius="xl"
                />

                {pkg.expiryDate && (
                  <Text size="xs" c="dimmed">
                    {t('hoursPackages.expiresOn')} {new Date(pkg.expiryDate).toLocaleDateString()}
                  </Text>
                )}
              </Stack>

              {isLow && !isExpired && (
                <Alert
                  icon={<IconAlertCircle size="1rem" />}
                  color="orange"
                  variant="light"
                  mt="sm"
                  p="xs"
                >
                  <Text size="xs">
                    {t('hoursPackages.lowHoursWarning')}
                  </Text>
                </Alert>
              )}
            </Card>
          );
        })}
      </Stack>
    </Card>
  );
}
