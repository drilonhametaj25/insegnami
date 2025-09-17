'use client';

import { ReactNode, useEffect } from 'react';
import { ProfessionalButton } from '../design-system/ProfessionalComponents';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../design-system/ProfessionalComponents';

interface ProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  footer?: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger' | 'success' | 'warning';
  isLoading?: boolean;
}

export function ProfessionalModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  footer,
  onConfirm,
  onCancel,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  confirmVariant = 'primary',
  isLoading = false,
}: ProfessionalModalProps) {
  
  const sizeClasses = {
    sm: { maxWidth: '400px', width: '90vw' },
    md: { maxWidth: '600px', width: '90vw' },
    lg: { maxWidth: '800px', width: '90vw' },
    xl: { maxWidth: '1200px', width: '95vw' },
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const defaultFooter = (onConfirm || onCancel) && (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: SPACING.md,
      paddingTop: SPACING.lg,
      borderTop: `1px solid ${COLORS.border.light}`,
    }}>
      {onCancel && (
        <ProfessionalButton
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelText}
        </ProfessionalButton>
      )}
      {onConfirm && (
        <ProfessionalButton
          variant={confirmVariant}
          onClick={onConfirm}
          loading={isLoading}
        >
          {confirmText}
        </ProfessionalButton>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: COLORS.background.glass,
          border: `1px solid ${COLORS.border.light}`,
          borderRadius: RADIUS.lg,
          boxShadow: SHADOWS.xl,
          ...sizeClasses[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: SPACING.lg,
          borderBottom: `1px solid ${COLORS.border.light}`,
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 600,
            color: COLORS.text.primary,
          }}>
            {title}
          </h2>
          
          {showCloseButton && (
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                background: 'none',
                border: 'none',
                color: COLORS.text.muted,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '24px',
                padding: SPACING.xs,
                borderRadius: RADIUS.sm,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = COLORS.background.cardHover;
                  e.currentTarget.style.color = COLORS.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = COLORS.text.muted;
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{
          padding: SPACING.lg,
          overflowY: 'auto',
          flex: 1,
        }}>
          {children}
        </div>

        {/* Footer */}
        {(footer || defaultFooter) && (
          <div style={{
            padding: SPACING.lg,
            flexShrink: 0,
          }}>
            {footer || defaultFooter}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// Confirmation Modal
interface ProfessionalConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'warning';
  isLoading?: boolean;
}

export function ProfessionalConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  variant = 'primary',
  isLoading = false,
}: ProfessionalConfirmModalProps) {
  return (
    <ProfessionalModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      onConfirm={onConfirm}
      onCancel={onClose}
      confirmText={confirmText}
      cancelText={cancelText}
      confirmVariant={variant}
      isLoading={isLoading}
    >
      <p style={{
        color: COLORS.text.secondary,
        lineHeight: 1.6,
        margin: 0,
      }}>
        {message}
      </p>
    </ProfessionalModal>
  );
}
