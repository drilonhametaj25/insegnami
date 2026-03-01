'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Select,
  Table,
  Pagination,
  Loader,
  Alert,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Card,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconTrendingUp,
  IconCoin,
  IconUsers,
  IconClock,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
    price: number;
    interval: string;
  } | null;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const loadSubscriptions = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/superadmin/subscriptions?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Accesso negato. Solo SUPERADMIN.');
        }
        throw new Error('Errore nel caricamento');
      }

      const data = await response.json();
      setSubscriptions(data.subscriptions);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'TRIALING':
        return 'yellow';
      case 'PAST_DUE':
        return 'orange';
      case 'CANCELLED':
      case 'CANCELED':
        return 'red';
      case 'UNPAID':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Calculate MRR from subscriptions
  const calculateMRR = () => {
    return subscriptions
      .filter((s) => s.status === 'ACTIVE' && s.plan)
      .reduce((total, s) => {
        const price = s.plan!.price;
        const monthlyPrice = s.plan!.interval === 'YEARLY' ? price / 12 : price;
        return total + monthlyPrice;
      }, 0);
  };

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Errore" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>Abbonamenti</Title>
            <Text c="dimmed" size="sm">
              {summary?.total || 0} abbonamenti totali
            </Text>
          </div>
          <Tooltip label="Aggiorna">
            <ActionIcon variant="light" onClick={() => loadSubscriptions(pagination.page)}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Summary Cards */}
        {summary && (
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Attivi
                  </Text>
                  <Text size="xl" fw={700} c="green">
                    {summary.byStatus['ACTIVE'] || 0}
                  </Text>
                </div>
                <IconUsers size={24} color="green" />
              </Group>
            </Card>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    In Trial
                  </Text>
                  <Text size="xl" fw={700} c="yellow">
                    {summary.byStatus['TRIALING'] || 0}
                  </Text>
                </div>
                <IconClock size={24} color="orange" />
              </Group>
            </Card>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Cancellati
                  </Text>
                  <Text size="xl" fw={700} c="red">
                    {(summary.byStatus['CANCELLED'] || 0) + (summary.byStatus['CANCELED'] || 0)}
                  </Text>
                </div>
                <IconTrendingUp size={24} color="red" />
              </Group>
            </Card>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    MRR Visibile
                  </Text>
                  <Text size="xl" fw={700} c="blue">
                    €{calculateMRR().toFixed(2)}
                  </Text>
                </div>
                <IconCoin size={24} color="blue" />
              </Group>
            </Card>
          </SimpleGrid>
        )}

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Group>
            <Select
              placeholder="Filtra per stato"
              data={[
                { value: 'ACTIVE', label: 'Attivi' },
                { value: 'TRIALING', label: 'In Trial' },
                { value: 'PAST_DUE', label: 'Pagamento in ritardo' },
                { value: 'CANCELLED', label: 'Cancellati' },
                { value: 'UNPAID', label: 'Non pagati' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={200}
            />
          </Group>
        </Paper>

        {/* Table */}
        <Paper withBorder radius="md">
          {loading ? (
            <Stack align="center" py="xl">
              <Loader />
            </Stack>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tenant</Table.Th>
                  <Table.Th>Piano</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th>Periodo corrente</Table.Th>
                  <Table.Th>Creato</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subscriptions.map((sub) => (
                  <Table.Tr key={sub.id}>
                    <Table.Td>
                      <Link
                        href={`/dashboard/superadmin/tenants/${sub.tenant.id}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <Text size="sm" fw={500}>
                          {sub.tenant.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {sub.tenant.slug}
                        </Text>
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      {sub.plan ? (
                        <Group gap="xs">
                          <Badge variant="outline">{sub.plan.name}</Badge>
                          <Text size="xs" c="dimmed">
                            €{sub.plan.price}/{sub.plan.interval === 'MONTHLY' ? 'mo' : 'yr'}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(sub.status)}>{sub.status}</Badge>
                      {sub.cancelAtPeriodEnd && (
                        <Badge size="xs" color="orange" ml="xs">
                          Cancella a fine periodo
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(sub.currentPeriodStart).toLocaleDateString('it-IT')} -{' '}
                        {new Date(sub.currentPeriodEnd).toLocaleDateString('it-IT')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(sub.createdAt).toLocaleDateString('it-IT')}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {subscriptions.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed" ta="center" py="xl">
                        Nessun abbonamento trovato
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Group justify="center">
            <Pagination
              value={pagination.page}
              onChange={(page) => loadSubscriptions(page)}
              total={pagination.totalPages}
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
