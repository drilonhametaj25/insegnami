'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Modal,
  Button,
  Group,
  Text,
  Alert,
  LoadingOverlay,
  Avatar,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconInfoCircle, IconEye } from '@tabler/icons-react';
import { DataTable, TableRenderers } from '@/components/tables/DataTable';
import { UserForm, UserFormData } from '@/components/forms/UserForm';
import { Role } from '@prisma/client';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  tenants: Array<{
    role: Role;
    tenant: {
      id: string;
      name: string;
    };
  }>;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function UsersManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  const [opened, { open, close }] = useDisclosure(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Check if user has permission to manage users
  const canManageUsers = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Navigate to user detail
  const handleViewUser = (userId: string) => {
    router.push(`/${locale}/dashboard/users/${userId}`);
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
      });

      const response = await fetch(`/api/users?${params}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli utenti');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare gli utenti',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [pagination.page, searchQuery, roleFilter, canManageUsers]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle filter
  const handleFilter = (filter: string) => {
    setRoleFilter(filter);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Handle create user
  const handleCreate = () => {
    setEditingUser(null);
    open();
  };

  // Handle edit user
  const handleEdit = (user: User) => {
    setEditingUser(user);
    open();
  };

  // Handle delete user
  const handleDelete = (user: User) => {
    setUserToDelete(user);
    openDelete();
  };

  // Submit user form
  const handleSubmit = async (data: UserFormData) => {
    try {
      setSubmitting(true);
      const isEdit = !!editingUser;
      const url = isEdit ? `/api/users/${editingUser.id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante il salvataggio');
      }

      notifications.show({
        title: 'Successo',
        message: `Utente ${isEdit ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
        icon: <IconCheck />,
      });

      close();
      fetchUsers();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Errore durante il salvataggio',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm delete user
  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante l\'eliminazione');
      }

      notifications.show({
        title: 'Successo',
        message: 'Utente eliminato con successo',
        color: 'green',
        icon: <IconCheck />,
      });

      closeDelete();
      fetchUsers();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Errore durante l\'eliminazione',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'firstName' as keyof User,
      title: 'Utente',
      render: (_value: any, user: User) => (
        <Group gap="sm">
          <UnstyledButton onClick={() => handleViewUser(user.id)}>
            <Group gap="sm">
              <Avatar size="sm" color="blue">
                {user.firstName[0]}{user.lastName[0]}
              </Avatar>
              <div>
                <Text fw={500} size="sm" c="blue" style={{ cursor: 'pointer' }}>
                  {user.firstName} {user.lastName}
                </Text>
                <Text size="xs" c="dimmed">
                  {user.email}
                </Text>
              </div>
            </Group>
          </UnstyledButton>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={() => handleViewUser(user.id)}
          >
            Dettagli
          </Button>
        </Group>
      ),
    },
    {
      key: 'phone' as keyof User,
      title: 'Telefono',
      render: (phone: string | null) => phone || '-',
    },
    {
      key: 'tenants' as keyof User,
      title: 'Ruolo',
      render: (tenants: User['tenants']) => {
        const role = tenants[0]?.role || 'N/A';
        return TableRenderers.status(role, {
          ADMIN: 'blue',
          TEACHER: 'green',
          STUDENT: 'orange',
          PARENT: 'purple',
          SUPERADMIN: 'red',
        });
      },
    },
    {
      key: 'status' as keyof User,
      title: 'Stato',
      render: (status: string) => TableRenderers.status(status),
    },
    {
      key: 'createdAt' as keyof User,
      title: 'Creato il',
      render: (date: string) => TableRenderers.date(date),
    },
  ];

  const roleOptions = [
    { value: 'ADMIN', label: 'Amministratore' },
    { value: 'TEACHER', label: 'Docente' },
    { value: 'STUDENT', label: 'Studente' },
    { value: 'PARENT', label: 'Genitore' },
  ];

  if (!canManageUsers) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading && users.length === 0} />
      
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Gestione Utenti</Title>
        </Group>

        <DataTable
          data={users}
          columns={columns}
          loading={loading}
          searchPlaceholder="Cerca per nome, cognome o email..."
          onSearch={handleSearch}
          filterable
          filterOptions={roleOptions}
          filterLabel="Filtra per ruolo"
          onFilter={handleFilter}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={handleCreate}
          createButtonLabel="Nuovo Utente"
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          pageSize={pagination.limit}
          total={pagination.total}
        />
      </Stack>

      {/* User Form Modal */}
      <UserForm
        opened={opened}
        onClose={close}
        initialData={editingUser ? {
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          phone: editingUser.phone || '',
          role: editingUser.tenants[0]?.role || 'STUDENT',
        } : undefined}
        onSubmit={handleSubmit}
        loading={submitting}
        isEdit={!!editingUser}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        title="Conferma Eliminazione"
        size="sm"
      >
        <Stack>
          <Text>
            Sei sicuro di voler eliminare l'utente{' '}
            <strong>
              {userToDelete?.firstName} {userToDelete?.lastName}
            </strong>
            ?
          </Text>
          <Text size="sm" c="dimmed">
            Questa azione non può essere annullata.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={closeDelete}>
              Annulla
            </Button>
            <Button color="red" onClick={confirmDelete} loading={submitting}>
              Elimina
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
