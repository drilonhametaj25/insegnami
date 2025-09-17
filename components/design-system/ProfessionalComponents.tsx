'use client';

import { ReactNode } from 'react';

// Design System Constants
export const COLORS = {
  primary: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    solid: '#667eea',
    light: 'rgba(102, 126, 234, 0.1)',
  },
  success: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    solid: '#10b981',
    light: 'rgba(16, 185, 129, 0.1)',
  },
  warning: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    solid: '#f59e0b',
    light: 'rgba(245, 158, 11, 0.1)',
  },
  danger: {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    solid: '#ef4444',
    light: 'rgba(239, 68, 68, 0.1)',
  },
  info: {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    solid: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.1)',
  },
  neutral: {
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    solid: '#6b7280',
    light: 'rgba(107, 114, 128, 0.1)',
  },
  background: {
    main: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    card: 'rgba(255, 255, 255, 0.05)',
    cardHover: 'rgba(255, 255, 255, 0.08)',
    glass: 'rgba(255, 255, 255, 0.1)',
  },
  text: {
    primary: 'white',
    secondary: 'rgba(255, 255, 255, 0.8)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },
  border: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    strong: 'rgba(255, 255, 255, 0.3)',
  }
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
} as const;

export const SHADOWS = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.1)',
  md: '0 4px 16px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.2)',
  xl: '0 16px 64px rgba(0, 0, 0, 0.25)',
  glow: '0 0 20px rgba(102, 126, 234, 0.3)',
} as const;

// Professional Card Component
interface ProfessionalCardProps {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'elevated';
  padding?: keyof typeof SPACING;
  className?: string;
}

export function ProfessionalCard({ 
  children, 
  variant = 'default', 
  padding = 'lg',
  className = ''
}: ProfessionalCardProps) {
  const variants = {
    default: {
      background: COLORS.background.card,
      border: `1px solid ${COLORS.border.light}`,
      backdropFilter: 'blur(10px)',
    },
    glass: {
      background: COLORS.background.glass,
      border: `1px solid ${COLORS.border.medium}`,
      backdropFilter: 'blur(20px)',
    },
    elevated: {
      background: COLORS.background.cardHover,
      border: `1px solid ${COLORS.border.medium}`,
      boxShadow: SHADOWS.lg,
      backdropFilter: 'blur(15px)',
    }
  };

  return (
    <div 
      className={className}
      style={{
        ...variants[variant],
        borderRadius: RADIUS.lg,
        padding: SPACING[padding],
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

// Professional Button Component
interface ProfessionalButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: ReactNode;
}

export function ProfessionalButton({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  loading = false,
  disabled = false,
  type = 'button',
  icon,
}: ProfessionalButtonProps) {
  const variants = {
    primary: {
      background: COLORS.primary.gradient,
      color: COLORS.text.primary,
      border: 'none',
      boxShadow: `0 4px 12px ${COLORS.primary.light}`,
    },
    secondary: {
      background: COLORS.background.glass,
      color: COLORS.text.primary,
      border: `1px solid ${COLORS.border.medium}`,
    },
    success: {
      background: COLORS.success.gradient,
      color: COLORS.text.primary,
      border: 'none',
      boxShadow: `0 4px 12px ${COLORS.success.light}`,
    },
    danger: {
      background: COLORS.danger.gradient,
      color: COLORS.text.primary,
      border: 'none',
      boxShadow: `0 4px 12px ${COLORS.danger.light}`,
    },
    warning: {
      background: COLORS.warning.gradient,
      color: COLORS.text.primary,
      border: 'none',
      boxShadow: `0 4px 12px ${COLORS.warning.light}`,
    },
    ghost: {
      background: 'transparent',
      color: COLORS.text.secondary,
      border: 'none',
    }
  };

  const sizes = {
    sm: { padding: '8px 16px', fontSize: '13px', height: '32px' },
    md: { padding: '12px 24px', fontSize: '14px', height: '40px' },
    lg: { padding: '16px 32px', fontSize: '16px', height: '48px' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: RADIUS.sm,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.filter = 'brightness(1.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.filter = 'brightness(1)';
        }
      }}
    >
      {loading && (
        <div 
          style={{ 
            width: '16px', 
            height: '16px', 
            border: '2px solid transparent',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} 
        />
      )}
      {!loading && icon && icon}
      {children}
    </button>
  );
}

// Professional Stats Card
interface ProfessionalStatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function ProfessionalStatsCard({
  title,
  value,
  icon,
  variant = 'primary',
  trend
}: ProfessionalStatsCardProps) {
  return (
    <ProfessionalCard variant="elevated">
      <div 
        style={{
          background: COLORS[variant].gradient,
          margin: `-${SPACING.lg}`,
          marginBottom: SPACING.md,
          padding: SPACING.lg,
          borderRadius: `${RADIUS.lg} ${RADIUS.lg} 0 0`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.2)',
            padding: SPACING.md,
            borderRadius: RADIUS.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </div>
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: COLORS.text.primary 
            }}>
              {value}
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.875rem', 
              color: 'rgba(255, 255, 255, 0.9)' 
            }}>
              {title}
            </p>
          </div>
        </div>
      </div>
      
      {trend && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: SPACING.sm,
          color: trend.isPositive ? COLORS.success.solid : COLORS.danger.solid
        }}>
          <span style={{ fontSize: '0.75rem' }}>
            {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
          </span>
          <span style={{ fontSize: '0.75rem', color: COLORS.text.muted }}>
            vs last month
          </span>
        </div>
      )}
    </ProfessionalCard>
  );
}
