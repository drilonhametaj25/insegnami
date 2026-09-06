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
  Table,
  ActionIcon,
  Modal,
  NumberInput,
  Switch,
  Loader,
  Alert,
  Menu,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import {
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconAlertCircle,
  IconRefresh,
  IconBrandStripe,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  interval: 'MONTHLY' | 'YEARLY';
  stripePriceId: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  features: Record<string, any>;
  isPopular: boolean;
  sortOrder: number;
  isActive: boolean;
  activeSubscriptions: number;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // Catalogo read-only: via UI si modificano solo isPopular e sortOrder
  // (il resto vive in lib/billing/plans-catalog.ts)
  const form = useForm({
    initialValues: {
      isPopular: false,
      sortOrder: 0,
    },
  });

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/superadmin/plans?includeInactive=true');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Accesso negato. Solo SUPERADMIN.');
        }
        throw new Error('Errore nel caricamento');
      }

      const data = await response.json();
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    form.setValues({
      isPopular: plan.isPopular,
      sortOrder: plan.sortOrder,
    });
    openModal();
  };

  const handleSave = async () => {
    if (!editingPlan) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.values),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Salvataggio fallito');
      }

      notifications.show({
        title: 'Successo',
        message: 'Piano aggiornato',
        color: 'green',
      });

      closeModal();
      loadPlans();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Salvataggio fallito',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!planToDelete) return;

    try {
      const response = await fetch(`/api/superadmin/plans/${planToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Eliminazione fallita');
      }

      notifications.show({
        title: 'Successo',
        message: 'Piano disattivato',
        color: 'green',
      });

      closeDeleteModal();
      setPlanToDelete(null);
      loadPlans();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Eliminazione fallita',
        color: 'red',
      });
    }
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
            <Title order={1}>Gestione Piani</Title>
            <Text c="dimmed" size="sm">
              Catalogo piani e stato di sincronizzazione Stripe
            </Text>
          </div>
          <Tooltip label="Aggiorna">
            <ActionIcon variant="light" onClick={loadPlans}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          Il catalogo piani (nome, prezzo, limiti, funzionalità) è definito nel codice
          (lib/billing/plans-catalog.ts) e sincronizzato con Stripe dalla sync dedicata. Da qui
          puoi modificare solo l&apos;ordine di visualizzazione e il badge &quot;popolare&quot;.
        </Alert>

        <Paper withBorder radius="md">
          {loading ? (
            <Stack align="center" py="xl">
              <Loader />
            </Stack>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Piano</Table.Th>
                  <Table.Th>Prezzo</Table.Th>
                  <Table.Th>Limiti</Table.Th>
                  <Table.Th>Abbonamenti</Table.Th>
                  <Table.Th>Stripe</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th w={50}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {plans.map((plan) => (
                  <Table.Tr key={plan.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <div>
                          <Text size="sm" fw={500}>
                            {plan.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {plan.slug}
                          </Text>
                        </div>
                        {plan.isPopular && (
                          <Badge size="xs" color="yellow">
                            Popolare
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        €{plan.price}/{plan.interval === 'MONTHLY' ? 'mese' : 'anno'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {plan.maxStudents || '∞'} studenti, {plan.maxTeachers || '∞'} docenti,{' '}
                        {plan.maxClasses || '∞'} classi
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline">{plan.activeSubscriptions}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {plan.stripePriceId.startsWith('manual_') ? (
                        <Badge color="gray" size="xs">
                          Manuale
                        </Badge>
                      ) : (
                        <Tooltip label={plan.stripePriceId}>
                          <Badge color="violet" size="xs" leftSection={<IconBrandStripe size={10} />}>
                            Synced
                          </Badge>
                        </Tooltip>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={plan.isActive ? 'green' : 'red'}>
                        {plan.isActive ? 'Attivo' : 'Inattivo'}
                      </Badge>
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
                            leftSection={<IconEdit size={14} />}
                            onClick={() => handleOpenEdit(plan)}
                          >
                            Modifica
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => {
                              setPlanToDelete(plan);
                              openDeleteModal();
                            }}
                            disabled={plan.activeSubscriptions > 0}
                          >
                            {plan.activeSubscriptions > 0 ? 'Ha abbonamenti attivi' : 'Disattiva'}
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
      </Stack>

      {/* Edit Modal — solo campi di presentazione */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={`Modifica Piano${editingPlan ? ` — ${editingPlan.name}` : ''}`}
        size="md"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Nome, prezzo, limiti e funzionalità del piano sono definiti nel codice
            (lib/billing/plans-catalog.ts): qui puoi cambiare solo la presentazione.
          </Text>
          <Group grow>
            <NumberInput
              label="Ordine visualizzazione"
              min={0}
              {...form.getInputProps('sortOrder')}
              data-testid="plan-edit-sort-order"
            />
            <Switch
              label="Piano popolare"
              {...form.getInputProps('isPopular', { type: 'checkbox' })}
              mt="md"
              data-testid="plan-edit-is-popular"
            />
          </Group>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeModal}>
              Annulla
            </Button>
            <Button onClick={handleSave} loading={saving} data-testid="plan-edit-save">
              Salva
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Conferma Disattivazione"
        centered
      >
        <Stack>
          <Text>
            Sei sicuro di voler disattivare il piano <strong>{planToDelete?.name}</strong>?
          </Text>
          <Text size="sm" c="dimmed">
            Il piano non sarà più disponibile per nuovi abbonamenti. Gli abbonamenti esistenti
            rimarranno attivi.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeDeleteModal}>
              Annulla
            </Button>
            <Button color="red" onClick={handleDelete}>
              Disattiva
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
