'use client';

import { ReactNode, useState } from 'react';
import { ProfessionalCard, COLORS, SPACING, RADIUS } from '../design-system/ProfessionalComponents';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface ProfessionalTableProps {
  columns: Column[];
  data: Record<string, any>[];
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  pagination?: {
    current: number;
    total: number;
    onChange: (page: number) => void;
  };
}

export function ProfessionalTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'Nessun dato disponibile',
  onSort,
  pagination
}: ProfessionalTableProps) {
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: Column) => {
    if (!column.sortable) return;

    let direction: 'asc' | 'desc' = 'asc';
    if (sortColumn === column.key && sortDirection === 'asc') {
      direction = 'desc';
    }

    setSortColumn(column.key);
    setSortDirection(direction);
    onSort?.(column.key, direction);
  };

  const renderPaginationButtons = () => {
    if (!pagination) return null;

    const { current, total, onChange } = pagination;
    const pages = [];
    
    // Previous button
    pages.push(
      <button
        key="prev"
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          background: current === 1 ? COLORS.background.card : COLORS.background.glass,
          border: `1px solid ${COLORS.border.light}`,
          borderRadius: RADIUS.sm,
          color: current === 1 ? COLORS.text.muted : COLORS.text.primary,
          cursor: current === 1 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        ‹ Precedente
      </button>
    );

    // Page numbers
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(total, current + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            padding: `${SPACING.sm} ${SPACING.md}`,
            background: current === i ? COLORS.primary.gradient : COLORS.background.glass,
            border: `1px solid ${current === i ? 'transparent' : COLORS.border.light}`,
            borderRadius: RADIUS.sm,
            color: COLORS.text.primary,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: current === i ? 600 : 400,
          }}
        >
          {i}
        </button>
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        style={{
          padding: `${SPACING.sm} ${SPACING.md}`,
          background: current === total ? COLORS.background.card : COLORS.background.glass,
          border: `1px solid ${COLORS.border.light}`,
          borderRadius: RADIUS.sm,
          color: current === total ? COLORS.text.muted : COLORS.text.primary,
          cursor: current === total ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        Successivo ›
      </button>
    );

    return pages;
  };

  if (loading) {
    return (
      <ProfessionalCard variant="elevated">
        <div style={{ padding: SPACING.xl, textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(102, 126, 234, 0.3)',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }} />
          <p style={{ marginTop: SPACING.md, color: COLORS.text.secondary }}>
            Caricamento dati...
          </p>
        </div>
      </ProfessionalCard>
    );
  }

  if (data.length === 0) {
    return (
      <ProfessionalCard variant="elevated">
        <div style={{ padding: SPACING.xl, textAlign: 'center' }}>
          <p style={{ color: COLORS.text.secondary, fontSize: '1.125rem' }}>
            {emptyMessage}
          </p>
        </div>
      </ProfessionalCard>
    );
  }

  return (
    <ProfessionalCard variant="elevated" padding="md">
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  style={{
                    padding: SPACING.md,
                    textAlign: column.align || 'left',
                    borderBottom: `2px solid ${COLORS.border.medium}`,
                    background: COLORS.background.glass,
                    color: COLORS.text.primary,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    cursor: column.sortable ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    width: column.width,
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start',
                    gap: SPACING.sm 
                  }}>
                    {column.label}
                    {column.sortable && (
                      <span style={{
                        display: 'flex',
                        flexDirection: 'column',
                        fontSize: '0.75rem',
                        lineHeight: '1',
                      }}>
                        <span style={{ 
                          opacity: sortColumn === column.key && sortDirection === 'asc' ? 1 : 0.3 
                        }}>▲</span>
                        <span style={{ 
                          opacity: sortColumn === column.key && sortDirection === 'desc' ? 1 : 0.3 
                        }}>▼</span>
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                style={{
                  borderBottom: `1px solid ${COLORS.border.light}`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = COLORS.background.cardHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: SPACING.md,
                      textAlign: column.align || 'left',
                      color: COLORS.text.secondary,
                      fontSize: '0.875rem',
                      verticalAlign: 'middle',
                    }}
                  >
                    {typeof row[column.key] === 'object' && row[column.key] !== null
                      ? row[column.key]
                      : String(row[column.key] || '-')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: SPACING.sm,
          paddingTop: SPACING.lg,
          marginTop: SPACING.lg,
          borderTop: `1px solid ${COLORS.border.light}`,
        }}>
          {renderPaginationButtons()}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </ProfessionalCard>
  );
}
