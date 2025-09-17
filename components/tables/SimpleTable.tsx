'use client';

import { Table, Pagination } from '@mantine/core';
import { ReactNode } from 'react';

interface SimpleTableProps {
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
}

export function SimpleTable({ 
  data, 
  loading = false,
  emptyMessage = 'Nessun elemento trovato',
  onPageChange,
  currentPage = 1,
  totalPages = 1
}: SimpleTableProps) {
  if (data.length === 0 && !loading) {
    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        {emptyMessage}
      </div>
    );
  }

  // Auto-generate headers from first data item
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <Table 
        striped 
        highlightOnHover
        style={{
          '--table-hover-color': 'rgba(255, 255, 255, 0.05)',
          '--table-striped-color': 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <Table.Thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
          <Table.Tr>
            {headers.map((header, index) => (
              <Table.Th 
                key={index} 
                style={{ 
                  color: 'white', 
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  textTransform: 'capitalize'
                }}
              >
                {header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            Array(5).fill(0).map((_, rowIndex) => (
              <Table.Tr key={rowIndex}>
                {headers.map((_, colIndex) => (
                  <Table.Td key={colIndex} style={{ padding: '16px' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      height: '20px',
                      borderRadius: '4px',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          ) : (
            data.map((item, index) => (
              <Table.Tr 
                key={item.id || index}
                style={{
                  transition: 'all 0.2s ease',
                }}
              >
                {headers.map((header, cellIndex) => (
                  <Table.Td 
                    key={cellIndex}
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      padding: '16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '14px'
                    }}
                  >
                    {(() => {
                      const value = item[header];
                      if (value === null || value === undefined) return '-';
                      if (typeof value === 'object') {
                        // Handle objects safely - check for circular references
                        try {
                          // Try to extract meaningful data from the object
                          if (value.name) return value.name;
                          if (value.title) return value.title;
                          if (value.label) return value.label;
                          if (value.id) return `ID: ${value.id}`;
                          // If it's a simple object, try to stringify
                          return JSON.stringify(value);
                        } catch (error) {
                          // If circular reference, show a fallback
                          return '[Object]';
                        }
                      }
                      return String(value);
                    })()}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Pagination
            value={currentPage}
            onChange={onPageChange}
            total={totalPages}
            size="sm"
            radius="lg"
            styles={{
              control: {
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                '&:hover': {
                  background: 'rgba(255, 255, 255, 0.1)',
                },
                '&[data-active]': {
                  background: 'rgba(59, 130, 246, 0.3)',
                  borderColor: 'rgba(59, 130, 246, 0.5)',
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
