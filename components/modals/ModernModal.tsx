'use client';

import { Modal, Group, Button, Stack, Text } from '@mantine/core';
import { ReactNode } from 'react';

interface ModernModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: string | number;
  actions?: ReactNode;
  loading?: boolean;
}

export function ModernModal({ 
  opened, 
  onClose, 
  title, 
  children, 
  size = 'lg',
  actions,
  loading = false 
}: ModernModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={size}
      styles={{
        content: {
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          overflow: 'hidden',
        },
        header: {
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px 24px',
          margin: 0,
        },
        title: {
          color: 'white',
          fontSize: '1.375rem',
          fontWeight: 600,
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        },
        close: {
          color: 'rgba(255, 255, 255, 0.7)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            color: 'white',
            transform: 'scale(1.1)',
          },
        },
        body: {
          padding: '24px',
          color: 'white',
        },
      }}
      overlayProps={{
        backgroundOpacity: 0.6,
        blur: 8,
      }}
      transitionProps={{
        transition: 'fade',
        duration: 200,
      }}
    >
      <Stack gap="md">
        {children}
        {actions && (
          <Group justify="flex-end" mt="lg" style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {actions}
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

export function ModernFormField({ 
  component: Component, 
  label, 
  required = false,
  error,
  ...props 
}: any) {
  return (
    <Component
      label={
        <Text style={{ color: 'white', fontWeight: 500, marginBottom: '4px' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </Text>
      }
      error={error}
      styles={{
        input: {
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
          transition: 'all 0.2s ease',
          '&::placeholder': { 
            color: 'rgba(255, 255, 255, 0.5)' 
          },
          '&:focus': {
            borderColor: 'rgba(59, 130, 246, 0.5)',
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
            background: 'rgba(255, 255, 255, 0.08)',
          },
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.07)',
          }
        },
        dropdown: {
          background: '#1e293b',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        },
        option: {
          color: 'white',
          fontSize: '14px',
          '&:hover': {
            background: 'rgba(59, 130, 246, 0.2)',
          },
          '&[data-selected]': {
            background: 'rgba(59, 130, 246, 0.3)',
            color: 'white',
          },
        },
        error: {
          color: '#f87171',
          fontSize: '13px',
          marginTop: '4px',
        }
      }}
      {...props}
    />
  );
}

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  loading = false,
  type = 'danger'
}: ConfirmModalProps) {
  const colors = {
    danger: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' }
  };

  return (
    <ModernModal
      opened={opened}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div style={{ 
        padding: '16px', 
        background: colors[type].bg,
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5 }}>
          {message}
        </Text>
      </div>
      
      <Group justify="flex-end" gap="md">
        <Button
          variant="light"
          onClick={onClose}
          disabled={loading}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.8)',
            border: 'none',
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          loading={loading}
          style={{
            background: colors[type].color,
            color: 'white',
            border: 'none',
          }}
        >
          {confirmLabel}
        </Button>
      </Group>
    </ModernModal>
  );
}
