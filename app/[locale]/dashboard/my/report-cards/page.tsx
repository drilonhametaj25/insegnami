'use client';

// Portale famiglia: pagelle pubblicate con download PDF

import {
  Container,
  Stack,
  Paper,
  Table,
  Text,
  Badge,
  Alert,
  Skeleton,
  Button,
} from '@mantine/core';
import {
  IconCertificate,
  IconInfoCircle,
  IconAlertTriangle,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchJson,
  useChildFilter,
  ChildSelect,
  MyPageHeader,
} from '../_components/family';

interface ReportCardRow {
  id: string;
  status: string;
  publishedAt?: string | null;
  student: { id: string; firstName: string; lastName: string };
  class: { id: string; name: string };
  period: {
    id: string;
    name: string;
    academicYear?: { id: string; name: string } | null;
  };
}

export default function MyReportCardsPage() {
  const { isParent, children, selectedChildId, setSelectedChildId } = useChildFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-report-cards'],
    queryFn: () => fetchJson<{ data: ReportCardRow[] }>('/api/report-cards?limit=100'),
  });

  // Per STUDENT/PARENT l'API restituisce solo pagelle PUBBLICATE;
  // il filtro figlio è applicato client-side.
  const reportCards = (data?.data ?? []).filter(
    (rc) => !selectedChildId || rc.student.id === selectedChildId
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconCertificate size="1.5rem" />}
          title="Pagelle"
          subtitle={
            isParent ? 'Le pagelle pubblicate dei tuoi figli' : 'Le tue pagelle pubblicate'
          }
          action={
            <ChildSelect
              options={children}
              value={selectedChildId}
              onChange={setSelectedChildId}
            />
          }
        />

        {error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(error as Error).message}
          </Alert>
        )}

        {isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : reportCards.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessuna pagella pubblicata al momento.
          </Alert>
        ) : (
          <Paper withBorder radius="md" p="md">
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm" data-testid="my-report-cards-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Classe</Table.Th>
                    <Table.Th>Periodo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {reportCards.map((rc) => (
                    <Table.Tr key={rc.id}>
                      <Table.Td>
                        <Text fw={500}>
                          {rc.student.firstName} {rc.student.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>{rc.class?.name ?? '—'}</Table.Td>
                      <Table.Td>
                        {rc.period?.name}
                        {rc.period?.academicYear ? ` · ${rc.period.academicYear.name}` : ''}
                      </Table.Td>
                      <Table.Td>
                        <Badge color="green" variant="light">
                          Pubblicata
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          data-testid="my-report-card-pdf"
                          component="a"
                          href={`/api/report-cards/${rc.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          variant="light"
                          leftSection={<IconFileTypePdf size="1rem" />}
                        >
                          Scarica PDF
                        </Button>
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
