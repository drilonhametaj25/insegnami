'use client';

import { Button, ButtonProps } from '@mantine/core';
import { ReactNode } from 'react';

interface ModernButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function ModernButton({ 
  variant = 'primary', 
  children, 
  style,
  ...props 
}: ModernButtonProps) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
      '&:hover': {
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(59, 130, 246, 0.35)',
      }
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: 'white',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        transform: 'translateY(-1px)',
      }
    },
    success: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
      '&:hover': {
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(16, 185, 129, 0.35)',
      }
    },
    danger: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)',
      '&:hover': {
        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(239, 68, 68, 0.35)',
      }
    },
    warning: {
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
      '&:hover': {
        background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
        transform: 'translateY(-1px)',
        boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)',
      }
    },
    ghost: {
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.8)',
      border: 'none',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.1)',
        color: 'white',
      }
    }
  };

  const buttonStyles = {
    ...variants[variant],
    borderRadius: '8px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
    fontSize: '14px',
    height: '40px',
    padding: '0 20px',
    ...style,
  };

  return (
    <Button
      {...props}
      style={buttonStyles}
    >
      {children}
    </Button>
  );
}

interface IconButtonProps extends Omit<ModernButtonProps, 'children'> {
  icon: ReactNode;
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
}

export function ModernIconButton({ 
  icon, 
  variant = 'secondary', 
  size = 'md',
  style,
  ...props 
}: IconButtonProps) {
  const sizes = {
    sm: { width: '32px', height: '32px' },
    md: { width: '40px', height: '40px' },
    lg: { width: '48px', height: '48px' }
  };

  const iconButtonStyles = {
    ...sizes[size],
    padding: '0',
    minWidth: 'unset',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style
  };

  return (
    <ModernButton
      variant={variant}
      style={iconButtonStyles}
      {...props}
    >
      {icon}
    </ModernButton>
  );
}
