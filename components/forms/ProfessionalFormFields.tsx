'use client';

import { ReactNode, InputHTMLAttributes } from 'react';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../design-system/ProfessionalComponents';

interface ProfessionalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function ProfessionalInput({
  label,
  error,
  helperText,
  required = false,
  leftIcon,
  rightIcon,
  className,
  ...props
}: ProfessionalInputProps) {
  return (
    <div style={{ marginBottom: SPACING.md }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: error ? COLORS.danger.solid : COLORS.text.primary,
        marginBottom: SPACING.xs,
      }}>
        {label}
        {required && (
          <span style={{ color: COLORS.danger.solid, marginLeft: '4px' }}>*</span>
        )}
      </label>
      
      <div style={{ position: 'relative' }}>
        {leftIcon && (
          <div style={{
            position: 'absolute',
            left: SPACING.md,
            top: '50%',
            transform: 'translateY(-50%)',
            color: COLORS.text.muted,
            zIndex: 10,
          }}>
            {leftIcon}
          </div>
        )}
        
        <input
          {...props}
          style={{
            width: '100%',
            padding: `${SPACING.md} ${rightIcon ? '48px' : SPACING.md} ${SPACING.md} ${leftIcon ? '48px' : SPACING.md}`,
            background: COLORS.background.glass,
            border: `1px solid ${error ? COLORS.danger.solid : COLORS.border.medium}`,
            borderRadius: RADIUS.md,
            color: COLORS.text.primary,
            fontSize: '1rem',
            transition: 'all 0.2s ease',
            outline: 'none',
            ...props.style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.primary.light;
            e.target.style.boxShadow = `0 0 0 3px ${error ? COLORS.danger.solid : COLORS.primary.light}20`;
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.border.medium;
            e.target.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
        />
        
        {rightIcon && (
          <div style={{
            position: 'absolute',
            right: SPACING.md,
            top: '50%',
            transform: 'translateY(-50%)',
            color: COLORS.text.muted,
          }}>
            {rightIcon}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <p style={{
          fontSize: '0.75rem',
          marginTop: SPACING.xs,
          color: error ? COLORS.danger.solid : COLORS.text.muted,
        }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}

interface ProfessionalSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  helperText?: string;
  required?: boolean;
  placeholder?: string;
}

export function ProfessionalSelect({
  label,
  value,
  onChange,
  options,
  error,
  helperText,
  required = false,
  placeholder = 'Seleziona...',
}: ProfessionalSelectProps) {
  return (
    <div style={{ marginBottom: SPACING.md }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: error ? COLORS.danger.solid : COLORS.text.primary,
        marginBottom: SPACING.xs,
      }}>
        {label}
        {required && (
          <span style={{ color: COLORS.danger.solid, marginLeft: '4px' }}>*</span>
        )}
      </label>
      
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: COLORS.background.glass,
          border: `1px solid ${error ? COLORS.danger.solid : COLORS.border.medium}`,
          borderRadius: RADIUS.md,
          color: COLORS.text.primary,
          fontSize: '1rem',
          transition: 'all 0.2s ease',
          outline: 'none',
          cursor: 'pointer',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.primary.light;
          e.target.style.boxShadow = `0 0 0 3px ${error ? COLORS.danger.solid : COLORS.primary.light}20`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.border.medium;
          e.target.style.boxShadow = 'none';
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {(error || helperText) && (
        <p style={{
          fontSize: '0.75rem',
          marginTop: SPACING.xs,
          color: error ? COLORS.danger.solid : COLORS.text.muted,
        }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}

interface ProfessionalTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}

export function ProfessionalTextarea({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  rows = 4,
  placeholder,
}: ProfessionalTextareaProps) {
  return (
    <div style={{ marginBottom: SPACING.md }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 600,
        color: error ? COLORS.danger.solid : COLORS.text.primary,
        marginBottom: SPACING.xs,
      }}>
        {label}
        {required && (
          <span style={{ color: COLORS.danger.solid, marginLeft: '4px' }}>*</span>
        )}
      </label>
      
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: COLORS.background.glass,
          border: `1px solid ${error ? COLORS.danger.solid : COLORS.border.medium}`,
          borderRadius: RADIUS.md,
          color: COLORS.text.primary,
          fontSize: '1rem',
          transition: 'all 0.2s ease',
          outline: 'none',
          resize: 'vertical',
          minHeight: '100px',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.primary.light;
          e.target.style.boxShadow = `0 0 0 3px ${error ? COLORS.danger.solid : COLORS.primary.light}20`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? COLORS.danger.solid : COLORS.border.medium;
          e.target.style.boxShadow = 'none';
        }}
      />
      
      {(error || helperText) && (
        <p style={{
          fontSize: '0.75rem',
          marginTop: SPACING.xs,
          color: error ? COLORS.danger.solid : COLORS.text.muted,
        }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}

interface ProfessionalCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  helperText?: string;
}

export function ProfessionalCheckbox({
  label,
  checked,
  onChange,
  error,
  helperText,
}: ProfessionalCheckboxProps) {
  return (
    <div style={{ marginBottom: SPACING.md }}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
        cursor: 'pointer',
        fontSize: '0.875rem',
        color: error ? COLORS.danger.solid : COLORS.text.primary,
      }}>
        <div style={{ position: 'relative' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              position: 'absolute',
              opacity: 0,
              width: '20px',
              height: '20px',
              cursor: 'pointer',
            }}
          />
          <div style={{
            width: '20px',
            height: '20px',
            background: checked ? COLORS.primary.gradient : COLORS.background.glass,
            border: `2px solid ${checked ? 'transparent' : COLORS.border.medium}`,
            borderRadius: RADIUS.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}>
            {checked && (
              <span style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
              }}>✓</span>
            )}
          </div>
        </div>
        {label}
      </label>
      
      {(error || helperText) && (
        <p style={{
          fontSize: '0.75rem',
          marginTop: SPACING.xs,
          color: error ? COLORS.danger.solid : COLORS.text.muted,
        }}>
          {error || helperText}
        </p>
      )}
    </div>
  );
}
