'use client';

import { Table, Badge, ActionIcon, Text, Group, Avatar, Pagination } from '@mantine/core';
import { ReactNode } from 'react';

interface ModernTableProps {
  headers?: string[];
  data: any[];
  renderRow?: (item: any, index: number) => ReactNode[];
  onPageChange?: (page: number) => void;
  currentPage?: number;
  totalPages?: number;
  loading?: boolean;
  emptyMessage?: string;
}

export function ModernTable({ 
  headers, 
  data, 
  renderRow, 
  onPageChange,
  currentPage = 1,
  totalPages = 1,
  loading = false,
  emptyMessage = 'Nessun elemento trovato'
}: ModernTableProps) {
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
            {headers?.map((header, index) => (
              <Table.Th 
                key={index} 
                style={{ 
                  color: 'white', 
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading ? (
            // Loading skeleton rows
            Array.from({ length: 5 }).map((_, index) => (
              <Table.Tr key={`loading-${index}`}>
                {headers?.map((_, colIndex) => (
                  <Table.Td key={colIndex} style={{ padding: '16px' }}>
                    <div style={{
                      height: '16px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      animation: 'pulse 2s infinite'
                    }} />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          ) : data.length === 0 ? (
            <Table.Tr>
              <Table.Td
                colSpan={headers?.length || 1}
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '16px'
                }}
              >
                {emptyMessage}
              </Table.Td>
            </Table.Tr>
          ) : (
            data.map((item, index) => (
              <Table.Tr 
                key={item.id || index}
                style={{
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }
                }}
              >
                {renderRow?.(item, index).map((cell, cellIndex) => (
                  <Table.Td
                    key={cellIndex}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    {cell}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
      
      {totalPages > 1 && onPageChange && (
        <div style={{ 
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <Pagination
            value={currentPage}
            onChange={onPageChange}
            total={totalPages}
            styles={{
              control: {
                color: 'rgba(255, 255, 255, 0.8)',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
                '&[data-active]': {
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  color: 'white',
                  border: '1px solid rgba(59, 130, 246, 0.5)',
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

// Reusable table cell components
export function UserCell({ 
  name, 
  email, 
  avatar, 
  subtitle 
}: { 
  name: string; 
  email?: string; 
  avatar?: string; 
  subtitle?: string; 
}) {
  return (
    <Group gap="md">
      <Avatar
        src={avatar}
        size="md"
        radius="xl"
        style={{
          border: '2px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
      <div>
        <Text size="sm" fw={500} style={{ color: 'white' }}>
          {name}
        </Text>
        {email && (
          <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            {email}
          </Text>
        )}
        {subtitle && (
          <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            {subtitle}
          </Text>
        )}
      </div>
    </Group>
  );
}

export function StatusBadge({ 
  status, 
  colorMap 
}: { 
  status: string; 
  colorMap?: Record<string, string>; 
}) {
  const defaultColorMap: Record<string, string> = {
    ACTIVE: 'green',
    INACTIVE: 'gray',
    PENDING: 'blue',
    COMPLETED: 'green',
    CANCELLED: 'red',
    PAID: 'green',
    OVERDUE: 'red',
    PRESENT: 'green',
    ABSENT: 'red',
    LATE: 'yellow',
    EXCUSED: 'blue'
  };

  const colors = colorMap || defaultColorMap;
  
  return (
    <Badge 
      color={colors[status] || 'gray'} 
      variant="light"
      style={{
        textTransform: 'capitalize',
        fontWeight: 500
      }}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

export function ActionsGroup({ 
  actions 
}: { 
  actions: Array<{
    icon: ReactNode;
    color?: string;
    onClick: () => void;
    tooltip?: string;
    disabled?: boolean;
  }>;
}) {
  return (
    <Group gap="xs">
      {actions.map((action, index) => (
        <ActionIcon
          key={index}
          variant="light"
          color={action.color || 'blue'}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.tooltip}
          style={{
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
            }
          }}
        >
          {action.icon}
        </ActionIcon>
      ))}
    </Group>
  );
}
