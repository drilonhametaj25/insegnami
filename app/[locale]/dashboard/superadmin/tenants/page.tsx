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
  Button,
  TextInput,
  Select,
  Table,
  ActionIcon,
  Menu,
  Pagination,
  Loader,
  Alert,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSearch,
  IconPlus,
  IconDotsVertical,
  IconEye,
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconPlayerPause,
  IconClock,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  isActive: boolean;
  createdAt: string;
  trialUntil: string | null;
  isTrialing: boolean;
  trialDaysLeft: number;
  subscription: {
    id: string;
    status: string;
    plan: { name: string; slug: string };
    currentPeriodEnd: string;
  } | null;
  usage: {
    users: number;
    students: number;
    teachers: number;
    classes: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Modal
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

  const loadTenants = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetch(`/api/superadmin/tenants?${params}`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Accesso negato. Solo SUPERADMIN.');
        }
        throw new Error('Errore nel caricamento');
      }

      const data = await response.json();
      setTenants(data.tenants);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [search, statusFilter]);

  const handleAction = async (tenantId: string, action: string, value?: string) => {
    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });

      if (!response.ok) throw new Error('Azione fallita');

      const data = await response.json();
      notifications.show({
        title: 'Successo',
        message: data.message,
        color: 'green',
      });

      loadTenants(pagination.page);
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Azione non riuscita',
        color: 'red',
      });
    }
  };

  const handleDelete = async () => {
    if (!tenantToDelete) return;

    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantToDelete.id}?force=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Eliminazione fallita');
      }

      notifications.show({
        title: 'Successo',
        message: 'Tenant eliminato',
        color: 'green',
      });

      closeDeleteModal();
      setTenantToDelete(null);
      loadTenants(pagination.page);
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Eliminazione fallita',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (tenant: Tenant) => {
    if (!tenant.isActive) {
      return <Badge color="red">Sospeso</Badge>;
    }
    if (tenant.subscription?.status === 'ACTIVE') {
      return <Badge color="green">Attivo</Badge>;
    }
    if (tenant.isTrialing) {
      return (
        <Badge color="yellow">
          Trial ({tenant.trialDaysLeft}gg)
        </Badge>
      );
    }
    if (tenant.subscription?.status === 'PAST_DUE') {
      return <Badge color="orange">Pagamento in ritardo</Badge>;
    }
    return <Badge color="gray">Inattivo</Badge>;
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
            <Title order={1}>Gestione Tenant</Title>
            <Text c="dimmed" size="sm">
              {pagination.total} tenant registrati
            </Text>
          </div>
          <Group>
            <Tooltip label="Aggiorna">
              <ActionIcon variant="light" onClick={() => loadTenants(pagination.page)}>
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={16} />}>Nuovo Tenant</Button>
          </Group>
        </Group>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Group>
            <TextInput
              placeholder="Cerca per nome, slug, dominio..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Stato"
              data={[
                { value: 'active', label: 'Attivi' },
                { value: 'inactive', label: 'Inattivi' },
                { value: 'trialing', label: 'In Trial' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={150}
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
                  <Table.Th>Stato</Table.Th>
                  <Table.Th>Piano</Table.Th>
                  <Table.Th>Utilizzo</Table.Th>
                  <Table.Th>Creato</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tenants.map((tenant) => (
                  <Table.Tr key={tenant.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {tenant.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {tenant.slug}
                          {tenant.domain && ` - ${tenant.domain}`}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(tenant)}</Table.Td>
                    <Table.Td>
                      {tenant.subscription?.plan ? (
                        <Badge variant="outline">{tenant.subscription.plan.name}</Badge>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {tenant.usage.students} studenti, {tenant.usage.teachers} docenti
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(tenant.createdAt).toLocaleDateString('it-IT')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            component={Link}
                            href={`/dashboard/superadmin/tenants/${tenant.id}`}
                            leftSection={<IconEye size={14} />}
                          >
                            Dettagli
                          </Menu.Item>
                          <Menu.Item leftSection={<IconEdit size={14} />}>Modifica</Menu.Item>
                          <Menu.Divider />
                          {tenant.isActive ? (
                            <Menu.Item
                              leftSection={<IconPlayerPause size={14} />}
                              color="orange"
                              onClick={() => handleAction(tenant.id, 'suspend')}
                            >
                              Sospendi
                            </Menu.Item>
                          ) : (
                            <Menu.Item
                              leftSection={<IconPlayerPlay size={14} />}
                              color="green"
                              onClick={() => handleAction(tenant.id, 'activate')}
                            >
                              Riattiva
                            </Menu.Item>
                          )}
                          <Menu.Item
                            leftSection={<IconClock size={14} />}
                            onClick={() => handleAction(tenant.id, 'extend_trial', '14')}
                          >
                            Estendi Trial +14gg
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => {
                              setTenantToDelete(tenant);
                              openDeleteModal();
                            }}
                          >
                            Elimina
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Group justify="center">
            <Pagination
              value={pagination.page}
              onChange={(page) => loadTenants(page)}
              total={pagination.totalPages}
            />
          </Group>
        )}
      </Stack>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Conferma Eliminazione"
        centered
      >
        <Stack>
          <Text>
            Sei sicuro di voler eliminare il tenant <strong>{tenantToDelete?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            Questa azione eliminerà tutti i dati associati (utenti, studenti, pagamenti, ecc.) e non
            può essere annullata.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeDeleteModal}>
              Annulla
            </Button>
            <Button color="red" onClick={handleDelete}>
              Elimina
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
