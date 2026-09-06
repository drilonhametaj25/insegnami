'use client';

// Portale famiglia: pagamenti in sola lettura (nessun pagamento online)

import {
  Container,
  Stack,
  Paper,
  Table,
  Text,
  Badge,
  Alert,
  Skeleton,
} from '@mantine/core';
import {
  IconCreditCard,
  IconInfoCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchJson,
  useChildFilter,
  ChildSelect,
  MyPageHeader,
} from '../_components/family';

interface PaymentRow {
  id: string;
  amount: string | number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate: string;
  paidDate?: string | null;
  description: string;
  student: { id: string; firstName: string; lastName: string };
  class?: { id: string; name: string } | null;
}

const STATUS_META: Record<PaymentRow['status'], { label: string; color: string }> = {
  PENDING: { label: 'In attesa', color: 'yellow' },
  PAID: { label: 'Pagato', color: 'green' },
  OVERDUE: { label: 'Scaduto', color: 'red' },
  CANCELLED: { label: 'Annullato', color: 'gray' },
};

function formatAmount(amount: string | number): string {
  return `€ ${Number(amount).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MyPaymentsPage() {
  const { isParent, children, selectedChildId, setSelectedChildId, childParam } =
    useChildFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-payments', selectedChildId],
    queryFn: () =>
      fetchJson<{ payments: PaymentRow[] }>(
        `/api/payments?page=1&limit=100${childParam}`
      ),
  });

  const payments = data?.payments ?? [];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconCreditCard size="1.5rem" />}
          title="Pagamenti"
          subtitle={
            isParent
              ? 'Stato dei pagamenti e delle scadenze dei tuoi figli'
              : 'Stato dei tuoi pagamenti e delle scadenze'
          }
          action={
            <ChildSelect
              options={children}
              value={selectedChildId}
              onChange={setSelectedChildId}
            />
          }
        />

        <Alert
          color="blue"
          icon={<IconInfoCircle size="1rem" />}
          data-testid="my-payments-info"
        >
          I pagamenti si effettuano presso la segreteria della scuola. Questa pagina è di
          sola consultazione.
        </Alert>

        {error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(error as Error).message}
          </Alert>
        )}

        {isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : payments.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessun pagamento registrato al momento.
          </Alert>
        ) : (
          <Paper withBorder radius="md" p="md">
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm" data-testid="my-payments-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Descrizione</Table.Th>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Importo</Table.Th>
                    <Table.Th>Scadenza</Table.Th>
                    <Table.Th>Stato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>
                        <Text fw={500}>{p.description}</Text>
                        {p.class?.name && (
                          <Text size="xs" c="dimmed">
                            {p.class.name}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {p.student.firstName} {p.student.lastName}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600}>{formatAmount(p.amount)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {new Date(p.dueDate).toLocaleDateString('it-IT')}
                        {p.paidDate && (
                          <Text size="xs" c="dimmed">
                            Pagato il {new Date(p.paidDate).toLocaleDateString('it-IT')}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={STATUS_META[p.status]?.color ?? 'gray'}
                          variant="light"
                        >
                          {STATUS_META[p.status]?.label ?? p.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
