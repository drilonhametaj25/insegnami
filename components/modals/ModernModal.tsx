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
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '20px',
          overflow: 'hidden',
        },
        header: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderBottom: 'none',
          padding: '20px 24px',
          margin: 0,
        },
        title: {
          color: 'white',
          fontSize: '1.375rem',
          fontWeight: 600,
        },
        close: {
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            color: 'white',
            transform: 'scale(1.1)',
          },
        },
        body: {
          padding: '24px',
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
          <Group justify="flex-end" mt="lg" style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
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
        <Text style={{ color: '#374151', fontWeight: 500, marginBottom: '4px' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </Text>
      }
      error={error}
      styles={{
        input: {
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          color: '#1a202c',
          fontSize: '14px',
          transition: 'all 0.2s ease',
          '&::placeholder': {
            color: '#a0aec0'
          },
          '&:focus': {
            borderColor: '#667eea',
            boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
          },
          '&:hover': {
            borderColor: '#cbd5e1',
          }
        },
        dropdown: {
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
        },
        option: {
          color: '#1a202c',
          fontSize: '14px',
          '&:hover': {
            background: 'rgba(102, 126, 234, 0.1)',
          },
          '&[data-selected]': {
            background: 'rgba(102, 126, 234, 0.15)',
            color: '#1a202c',
          },
        },
        error: {
          color: '#ef4444',
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
        <Text style={{ color: '#374151', lineHeight: 1.5 }}>
          {message}
        </Text>
      </div>

      <Group justify="flex-end" gap="md">
        <Button
          variant="light"
          onClick={onClose}
          disabled={loading}
          style={{
            background: '#f1f5f9',
            color: '#475569',
            border: '1px solid #e2e8f0',
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
