'use client';

import { Paper, Group, Text, ThemeIcon, Badge, Stack, Progress } from '@mantine/core';
import { 
  IconTrendingUp, 
  IconTrendingDown,
  IconMinus,
} from '@tabler/icons-react';

interface ModernStatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  progress?: {
    value: number;
    label: string;
    color: string;
  };
  badge?: {
    text: string;
    color: string;
  };
}

export function ModernStatsCard({ 
  title, 
  value, 
  icon, 
  gradient, 
  change, 
  progress, 
  badge 
}: ModernStatsCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    
    switch (change.type) {
      case 'increase':
        return <IconTrendingUp size={14} />;
      case 'decrease':
        return <IconTrendingDown size={14} />;
      default:
        return <IconMinus size={14} />;
    }
  };

  const getTrendColor = () => {
    if (!change) return 'gray';
    
    switch (change.type) {
      case 'increase':
        return '#10b981';
      case 'decrease':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  return (
    <Paper 
      p="xl" 
      radius="xl"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        transition: 'all 0.3s ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 20px 40px -4px rgb(0 0 0 / 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0px)';
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1)';
      }}
    >
      {/* Decorative gradient overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '120px',
          height: '120px',
          background: gradient,
          borderRadius: '50%',
          opacity: 0.1,
          transform: 'translate(30%, -30%)',
        }}
      />
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Group justify="space-between" mb="md">
          <div style={{ flex: 1 }}>
            <Text c="dimmed" size="sm" mb={8}>
              {title}
            </Text>
            <Group align="flex-end" gap="sm">
              <Text size="2rem" fw={700} lh={1} style={{ color: '#1f2937' }}>
                {value}
              </Text>
              {badge && (
                <Badge 
                  color={badge.color} 
                  variant="light" 
                  size="sm"
                  radius="md"
                  style={{
                    background: `linear-gradient(135deg, var(--mantine-color-${badge.color}-1), var(--mantine-color-${badge.color}-2))`,
                  }}
                >
                  {badge.text}
                </Badge>
              )}
            </Group>
          </div>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ color: 'white', fontSize: '24px' }}>
              {icon}
            </div>
          </div>
        </Group>

        {change && (
          <Group gap={8} mb={progress ? "md" : 0}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '8px',
                background: change.type === 'increase' ? '#dcfce7' : 
                          change.type === 'decrease' ? '#fee2e2' : '#f3f4f6',
              }}
            >
              <div style={{ color: getTrendColor() }}>
                {getTrendIcon()}
              </div>
              <Text size="xs" fw={500} style={{ color: getTrendColor() }}>
                {change.value > 0 ? '+' : ''}{change.value}%
              </Text>
            </div>
            <Text size="xs" c="dimmed">
              {change.period}
            </Text>
          </Group>
        )}

        {progress && (
          <Stack gap={8}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {progress.label}
              </Text>
              <Text size="xs" fw={600} style={{ color: '#374151' }}>
                {progress.value}%
              </Text>
            </Group>
            <div
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: '#e5e7eb',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress.value}%`,
                  height: '100%',
                  background: gradient,
                  borderRadius: '3px',
                  transition: 'width 1s ease-in-out',
                }}
              />
            </div>
          </Stack>
        )}
      </div>
    </Paper>
  );
}
