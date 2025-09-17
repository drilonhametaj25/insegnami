'use client';

import { Container, Title, Group, Button, Stack, Paper, Card, Badge } from '@mantine/core';
import { ReactNode } from 'react';

interface ModernPageLayoutProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  showContainer?: boolean;
  maxWidth?: string | number;
}

export function ModernPageLayout({ 
  title, 
  children, 
  actions,
  showContainer = true,
  maxWidth = 'xl'
}: ModernPageLayoutProps) {
  const content = (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title 
          order={1}
          style={{ 
            color: 'white',
            fontSize: '2.5rem',
            fontWeight: 700,
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            letterSpacing: '-0.5px'
          }}
        >
          {title}
        </Title>
        {actions && (
          <Group gap="md">
            {actions}
          </Group>
        )}
      </Group>
      {children}
    </Stack>
  );

  if (showContainer) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '24px'
      }}>
        <Container size={maxWidth}>
          {content}
        </Container>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px'
    }}>
      {content}
    </div>
  );
}

// Reusable components with consistent styling
export function ModernCard({ children, ...props }: any) {
  return (
    <Card
      shadow="lg"
      padding="lg"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        ...props.style
      }}
      {...props}
    >
      {children}
    </Card>
  );
}

export function ModernPaper({ children, ...props }: any) {
  return (
    <Paper
      p="lg"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        ...props.style
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}

export function ModernButton({ children, variant = 'primary', ...props }: any) {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      border: 'none',
      boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
      borderRadius: '12px',
      color: 'white',
      fontWeight: 600,
      transition: 'all 0.2s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 6px 20px rgba(59, 130, 246, 0.6)',
      }
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.15)',
        transform: 'translateY(-1px)',
      }
    },
    success: {
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      color: '#4ade80',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      '&:hover': {
        background: 'rgba(34, 197, 94, 0.15)',
        transform: 'translateY(-1px)',
      }
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      color: '#f87171',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      fontWeight: 500,
      transition: 'all 0.2s ease',
      '&:hover': {
        background: 'rgba(239, 68, 68, 0.15)',
        transform: 'translateY(-1px)',
      }
    }
  };

  return (
    <Button
      style={styles[variant as keyof typeof styles]}
      {...props}
    >
      {children}
    </Button>
  );
}

export function ModernStatsCard({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  trend,
  subtitle 
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'teal';
  trend?: { value: number; label: string };
  subtitle?: string;
}) {
  const colorMap = {
    blue: { 
      bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
      border: 'rgba(59, 130, 246, 0.2)',
      icon: '#3b82f6'
    },
    green: { 
      bg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(21, 128, 61, 0.1) 100%)',
      border: 'rgba(34, 197, 94, 0.2)',
      icon: '#22c55e'
    },
    red: { 
      bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
      border: 'rgba(239, 68, 68, 0.2)',
      icon: '#ef4444'
    },
    yellow: { 
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
      border: 'rgba(245, 158, 11, 0.2)',
      icon: '#f59e0b'
    },
    purple: { 
      bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
      border: 'rgba(168, 85, 247, 0.2)',
      icon: '#a855f7'
    },
    teal: { 
      bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(13, 148, 136, 0.1) 100%)',
      border: 'rgba(20, 184, 166, 0.2)',
      icon: '#14b8a6'
    },
  };

  const colors = colorMap[color];

  return (
    <Card
      shadow="lg"
      padding="lg"
      radius="md"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
        }
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div style={{ flex: 1 }}>
          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            {title}
          </div>
          <div style={{ color: 'white', fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '4px' }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
              {subtitle}
            </div>
          )}
          {trend && (
            <Badge 
              size="sm" 
              color={trend.value >= 0 ? 'green' : 'red'} 
              variant="light"
              style={{ marginTop: '8px' }}
            >
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </Badge>
          )}
        </div>
        <div style={{ color: colors.icon, fontSize: '32px' }}>
          {icon}
        </div>
      </Group>
    </Card>
  );
}
