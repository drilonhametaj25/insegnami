import { Card, Text, Group, Badge, ThemeIcon, Skeleton } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown, IconMinus } from '@tabler/icons-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
}

export function StatsCard({
  title,
  value,
  description,
  trend,
  trendValue,
  icon,
  color = 'blue',
  loading = false,
}: StatsCardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <IconTrendingUp size={14} />;
      case 'down':
        return <IconTrendingDown size={14} />;
      default:
        return <IconMinus size={14} />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'green';
      case 'down':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Card withBorder p="xl" radius="md" shadow="sm">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
            {title}
          </Text>
          {loading ? (
            <Skeleton height={28} width={60} mt="xs" />
          ) : (
            <Text fw={700} fz="xl" mt="xs">
              {value}
            </Text>
          )}
          {description && !loading && (
            <Text c="dimmed" fz="sm" mt={5}>
              {description}
            </Text>
          )}
          {trend && trendValue && !loading && (
            <Group gap={5} mt="xs">
              <Text fz="sm" c={getTrendColor()} fw={500}>
                {getTrendIcon()}
                {trendValue}
              </Text>
              <Text fz="sm" c="dimmed">
                rispetto al mese scorso
              </Text>
            </Group>
          )}
        </div>
        {icon && !loading && (
          <ThemeIcon color={color} variant="light" size={38} radius="md">
            {icon}
          </ThemeIcon>
        )}
        {loading && (
          <Skeleton height={38} width={38} radius="md" />
        )}
      </Group>
    </Card>
  );
}
