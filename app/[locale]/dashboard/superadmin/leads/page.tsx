'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Anchor,
  Button,
  Spoiler,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconMailbox,
  IconMailOpened,
  IconCheck,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  subject: string | null;
  message: string;
  locale: string;
  source: string | null;
  handledAt: string | null;
  createdAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<{ total: number; unhandled: number } | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handledFilter, setHandledFilter] = useState<string | null>(null);

  const loadLeads = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: page.toString(), limit: '20' });
        if (handledFilter) params.append('handled', handledFilter);

        const response = await fetch(`/api/superadmin/leads?${params}`);
        if (!response.ok) {
          if (response.status === 403) throw new Error('Accesso negato. Solo SUPERADMIN.');
          throw new Error('Errore nel caricamento');
        }

        const data = await response.json();
        setLeads(data.leads);
        setSummary(data.summary);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setLoading(false);
      }
    },
    [handledFilter]
  );

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const toggleHandled = async (lead: Lead) => {
    try {
      const response = await fetch('/api/superadmin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lead.id, handled: !lead.handledAt }),
      });
      if (!response.ok) throw new Error('Aggiornamento fallito');
      notifications.show({
        title: lead.handledAt ? 'Lead riaperto' : 'Lead gestito',
        message: `${lead.name} (${lead.email})`,
        color: 'green',
      });
      loadLeads(pagination.page);
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
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
            <Title order={1}>Lead</Title>
            <Text c="dimmed" size="sm">
              Richieste dal form contatti del sito pubblico
            </Text>
          </div>
          <Tooltip label="Aggiorna">
            <ActionIcon variant="light" onClick={() => loadLeads(pagination.page)}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Summary */}
        {summary && (
          <SimpleGrid cols={{ base: 2, md: 4 }}>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Totali
                  </Text>
                  <Text size="xl" fw={700}>
                    {summary.total}
                  </Text>
                </div>
                <IconMailbox size={24} color="gray" />
              </Group>
            </Card>
            <Card withBorder p="md" radius="md">
              <Group justify="space-between">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Da gestire
                  </Text>
                  <Text size="xl" fw={700} c="orange">
                    {summary.unhandled}
                  </Text>
                </div>
                <IconMailOpened size={24} color="orange" />
              </Group>
            </Card>
          </SimpleGrid>
        )}

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Select
            placeholder="Filtra per stato"
            data={[
              { value: 'false', label: 'Da gestire' },
              { value: 'true', label: 'Gestiti' },
            ]}
            value={handledFilter}
            onChange={setHandledFilter}
            clearable
            w={200}
          />
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
                  <Table.Th>Contatto</Table.Th>
                  <Table.Th>Messaggio</Table.Th>
                  <Table.Th>Origine</Table.Th>
                  <Table.Th>Ricevuto</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {leads.map((lead) => (
                  <Table.Tr key={lead.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {lead.name}
                      </Text>
                      <Anchor href={`mailto:${lead.email}`} size="xs">
                        {lead.email}
                      </Anchor>
                      {lead.phone && (
                        <Text size="xs" c="dimmed">
                          {lead.phone}
                        </Text>
                      )}
                      {lead.school && (
                        <Text size="xs" c="dimmed">
                          {lead.school}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td maw={360}>
                      {lead.subject && (
                        <Text size="sm" fw={500}>
                          {lead.subject}
                        </Text>
                      )}
                      <Spoiler maxHeight={44} showLabel="Mostra tutto" hideLabel="Nascondi">
                        <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                          {lead.message}
                        </Text>
                      </Spoiler>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" size="sm">
                        {lead.source || 'contact-form'}
                      </Badge>
                      <Text size="xs" c="dimmed" mt={4}>
                        {lead.locale}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(lead.createdAt).toLocaleDateString('it-IT')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {new Date(lead.createdAt).toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {lead.handledAt ? (
                        <Badge color="green" variant="light">
                          Gestito
                        </Badge>
                      ) : (
                        <Badge color="orange" variant="light">
                          Da gestire
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        color={lead.handledAt ? 'gray' : 'green'}
                        leftSection={
                          lead.handledAt ? <IconArrowBackUp size={14} /> : <IconCheck size={14} />
                        }
                        onClick={() => toggleHandled(lead)}
                      >
                        {lead.handledAt ? 'Riapri' : 'Segna gestito'}
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {leads.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="xl">
                        Nessun lead trovato
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
              onChange={(page) => loadLeads(page)}
              total={pagination.totalPages}
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
