'use client';

import { useState } from 'react';
import {
  Table,
  Group,
  Text,
  ActionIcon,
  ScrollArea,
  rem,
  Badge,
  Avatar,
  TextInput,
  Select,
  Pagination,
  Paper,
  Stack,
  Button,
  Flex,
} from '@mantine/core';
import {
  IconSearch,
  IconEdit,
  IconTrash,
  IconEye,
  IconPlus,
} from '@tabler/icons-react';

interface Column<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterable?: boolean;
  filterOptions?: { value: string; label: string }[];
  filterLabel?: string;
  onSearch?: (query: string) => void;
  onFilter?: (filter: string) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onView?: (row: T) => void;
  onCreate?: () => void;
  createButtonLabel?: string;
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  total?: number;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Cerca...',
  filterable = false,
  filterOptions = [],
  filterLabel = 'Filtra',
  onSearch,
  onFilter,
  onEdit,
  onDelete,
  onView,
  onCreate,
  createButtonLabel = 'Aggiungi',
  page = 1,
  totalPages = 1,
  onPageChange,
  pageSize = 10,
  total = 0,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('');

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleFilter = (filter: string | null) => {
    const filterValue = filter || '';
    setSelectedFilter(filterValue);
    onFilter?.(filterValue);
  };

  const hasActions = onEdit || onDelete || onView;

  const rows = data.map((row) => (
    <Table.Tr key={row.id}>
      {columns.map((column) => {
        const value = row[column.key];
        return (
          <Table.Td key={String(column.key)} style={{ width: column.width }}>
            {column.render ? column.render(value, row) : String(value || '')}
          </Table.Td>
        );
      })}
      {hasActions && (
        <Table.Td>
          <Group gap="xs">
            {onView && (
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={() => onView(row)}
                size="sm"
              >
                <IconEye style={{ width: rem(16), height: rem(16) }} />
              </ActionIcon>
            )}
            {onEdit && (
              <ActionIcon
                variant="subtle"
                color="orange"
                onClick={() => onEdit(row)}
                size="sm"
              >
                <IconEdit style={{ width: rem(16), height: rem(16) }} />
              </ActionIcon>
            )}
            {onDelete && (
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => onDelete(row)}
                size="sm"
              >
                <IconTrash style={{ width: rem(16), height: rem(16) }} />
              </ActionIcon>
            )}
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  ));

  return (
    <Paper p="md">
      <Stack gap="md">
        {/* Header with search, filter, and create button */}
        <Flex justify="space-between" align="center" wrap="wrap" gap="md">
          <Group>
            {searchable && (
              <TextInput
                placeholder={searchPlaceholder}
                leftSection={<IconSearch style={{ width: rem(16), height: rem(16) }} />}
                value={searchQuery}
                onChange={(event) => handleSearch(event.currentTarget.value)}
                style={{ minWidth: 250 }}
              />
            )}
            {filterable && filterOptions.length > 0 && (
              <Select
                placeholder={filterLabel}
                data={[{ value: '', label: 'Tutti' }, ...filterOptions]}
                value={selectedFilter}
                onChange={handleFilter}
                clearable
                style={{ minWidth: 150 }}
              />
            )}
          </Group>
          {onCreate && (
            <Button
              leftSection={<IconPlus style={{ width: rem(16), height: rem(16) }} />}
              onClick={onCreate}
            >
              {createButtonLabel}
            </Button>
          )}
        </Flex>

        {/* Table */}
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                {columns.map((column) => (
                  <Table.Th key={String(column.key)} style={{ width: column.width }}>
                    {column.title}
                  </Table.Th>
                ))}
                {hasActions && <Table.Th>Azioni</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={columns.length + (hasActions ? 1 : 0)}>
                    <Text ta="center" py="xl">
                      Caricamento...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : rows.length > 0 ? (
                rows
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={columns.length + (hasActions ? 1 : 0)}>
                    <Text ta="center" py="xl" c="dimmed">
                      Nessun dato trovato
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Mostrando {Math.min((page - 1) * pageSize + 1, total)} -{' '}
              {Math.min(page * pageSize, total)} di {total} elementi
            </Text>
            <Pagination
              value={page}
              onChange={onPageChange}
              total={totalPages}
              size="sm"
            />
          </Group>
        )}
      </Stack>
    </Paper>
  );
}

// Utility functions for common table renderers
export const TableRenderers = {
  avatar: (name: string, email?: string) => (
    <Group gap="sm">
      <Avatar size="sm" radius="xl">
        {name?.charAt(0)?.toUpperCase()}
      </Avatar>
      <div>
        <Text size="sm" fw={500}>
          {name}
        </Text>
        {email && (
          <Text size="xs" c="dimmed">
            {email}
          </Text>
        )}
      </div>
    </Group>
  ),

  status: (status: string, colorMap?: Record<string, string>) => {
    const colors = colorMap || {
      ACTIVE: 'green',
      INACTIVE: 'gray',
      SUSPENDED: 'red',
      PENDING: 'yellow',
    };
    return (
      <Badge color={colors[status] || 'gray'} variant="light" size="sm">
        {status}
      </Badge>
    );
  },

  date: (date: Date | string) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('it-IT');
  },

  currency: (amount: number | string) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(Number(amount));
  },
};
