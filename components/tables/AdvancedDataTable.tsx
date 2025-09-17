'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import {
  Table,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Paper,
  Badge,
  ActionIcon,
  Menu,
  Text,
  Pagination,
  Flex,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconRefresh,
  IconDownload,
  IconEdit,
  IconTrash,
  IconEye,
  IconDots,
  IconChevronUp,
  IconChevronDown,
} from '@tabler/icons-react';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  enableSearch?: boolean;
  enableFilters?: boolean;
  enableActions?: boolean;
  pageSize?: number;
}

export function AdvancedDataTable<T>({
  data,
  columns,
  loading = false,
  searchPlaceholder = 'Cerca...',
  onRefresh,
  onExport,
  onEdit,
  onDelete,
  onView,
  enableSearch = true,
  enableFilters = true,
  enableActions = true,
  pageSize = 10,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Add actions column if actions are enabled
  const finalColumns = useMemo(() => {
    if (!enableActions) return columns;

    const actionsColumn: ColumnDef<T> = {
      id: 'actions',
      header: 'Azioni',
      cell: ({ row }) => (
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm">
              <IconDots size={16} />
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            {onView && (
              <Menu.Item
                leftSection={<IconEye size={14} />}
                onClick={() => onView(row.original)}
              >
                Visualizza
              </Menu.Item>
            )}
            {onEdit && (
              <Menu.Item
                leftSection={<IconEdit size={14} />}
                onClick={() => onEdit(row.original)}
              >
                Modifica
              </Menu.Item>
            )}
            {onDelete && (
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => onDelete(row.original)}
              >
                Elimina
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      ),
      enableSorting: false,
      size: 80,
    };

    return [...columns, actionsColumn];
  }, [columns, enableActions, onView, onEdit, onDelete]);

  const table = useReactTable({
    data,
    columns: finalColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const getStatusBadgeColor = (status: string) => {
    const statusColors: Record<string, string> = {
      ACTIVE: 'green',
      INACTIVE: 'red',
      PENDING: 'yellow',
      PAID: 'green',
      OVERDUE: 'red',
      CANCELLED: 'gray',
      COMPLETED: 'blue',
      DRAFT: 'gray',
    };
    return statusColors[status] || 'blue';
  };

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between">
        <Group>
          {enableSearch && (
            <TextInput
              placeholder={searchPlaceholder}
              leftSection={<IconSearch size={16} />}
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              style={{ minWidth: 250 }}
            />
          )}
          
          {enableFilters && (
            <Button
              variant="light"
              leftSection={<IconFilter size={16} />}
              onClick={() => {
                // Toggle filters visibility - implement as needed
              }}
            >
              Filtri
            </Button>
          )}
        </Group>

        <Group>
          {onRefresh && (
            <ActionIcon
              variant="light"
              onClick={onRefresh}
              loading={loading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          )}
          
          {onExport && (
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={onExport}
            >
              Esporta
            </Button>
          )}
        </Group>
      </Group>

      {/* Table */}
      <Paper withBorder>
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover>
            <Table.Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Table.Th key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <Group gap="xs">
                          <Text
                            size="sm"
                            fw={500}
                            style={{
                              cursor: header.column.getCanSort() ? 'pointer' : 'default',
                            }}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </Text>
                          {header.column.getCanSort() && (
                            <div>
                              {{
                                asc: <IconChevronUp size={14} />,
                                desc: <IconChevronDown size={14} />,
                              }[header.column.getIsSorted() as string] ?? null}
                            </div>
                          )}
                        </Group>
                      )}
                    </Table.Th>
                  ))}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {loading ? (
                <Table.Tr>
                  <Table.Td colSpan={finalColumns.length}>
                    <Text ta="center" py="xl">
                      Caricamento...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={finalColumns.length}>
                    <Text ta="center" py="xl" c="dimmed">
                      Nessun dato trovato
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <Table.Tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {/* Pagination */}
      <Flex justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Mostrando {table.getState().pagination.pageIndex * pageSize + 1} -{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          di {table.getFilteredRowModel().rows.length} elementi
        </Text>

        <Group>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onChange={(value) => {
              table.setPageSize(Number(value));
            }}
            data={[
              { value: '5', label: '5 per pagina' },
              { value: '10', label: '10 per pagina' },
              { value: '25', label: '25 per pagina' },
              { value: '50', label: '50 per pagina' },
            ]}
            size="sm"
            style={{ width: 130 }}
          />

          <Pagination
            value={table.getState().pagination.pageIndex + 1}
            onChange={(page) => table.setPageIndex(page - 1)}
            total={table.getPageCount()}
            size="sm"
          />
        </Group>
      </Flex>
    </Stack>
  );
}

// Helper function to create common cell renderers
export const createCellRenderers = {
  badge: (accessor: string, colorMap?: Record<string, string>) => ({
    accessorKey: accessor,
    cell: ({ getValue }: any) => {
      const value = getValue();
      const color = colorMap?.[value] || 'blue';
      return (
        <Badge color={color} size="sm">
          {value}
        </Badge>
      );
    },
  }),

  date: (accessor: string, format = 'dd/MM/yyyy') => ({
    accessorKey: accessor,
    cell: ({ getValue }: any) => {
      const value = getValue();
      if (!value) return '-';
      return new Date(value).toLocaleDateString('it-IT');
    },
  }),

  currency: (accessor: string) => ({
    accessorKey: accessor,
    cell: ({ getValue }: any) => {
      const value = getValue();
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
      }).format(value);
    },
  }),
};
