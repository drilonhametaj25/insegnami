'use client';

import { ReactNode } from 'react';
import { ProfessionalCard, ProfessionalButton, ProfessionalStatsCard, COLORS, SPACING, RADIUS } from '../design-system/ProfessionalComponents';

interface ProfessionalPageLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode[];
  stats?: Array<{
    title: string;
    value: string | number;
    icon: ReactNode;
    variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    trend?: {
      value: number;
      isPositive: boolean;
    };
  }>;
  loading?: boolean;
}

export function ProfessionalPageLayout({
  title,
  subtitle,
  children,
  actions = [],
  stats = [],
  loading = false
}: ProfessionalPageLayoutProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.background.main,
      padding: SPACING.lg,
    }}>
      {/* Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.xl,
        flexWrap: 'wrap',
        gap: SPACING.md,
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '2.5rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: SPACING.sm,
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{
              margin: 0,
              fontSize: '1.125rem',
              color: COLORS.text.secondary,
              fontWeight: 400,
            }}>
              {subtitle}
            </p>
          )}
        </div>
        
        {actions.length > 0 && (
          <div style={{
            display: 'flex',
            gap: SPACING.md,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            {actions}
          </div>
        )}
      </div>

      {/* Stats Section */}
      {stats.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: SPACING.lg,
          marginBottom: SPACING.xl,
        }}>
          {stats.map((stat, index) => (
            <ProfessionalStatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              variant={stat.variant}
              trend={stat.trend}
            />
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: RADIUS.lg,
            backdropFilter: 'blur(5px)',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(102, 126, 234, 0.3)',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
        )}
        {children}
      </div>

      {/* Add keyframes for animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .fade-in {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
