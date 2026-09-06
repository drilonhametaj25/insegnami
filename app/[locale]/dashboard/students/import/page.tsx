'use client';

// Import studenti da CSV (feature 'bulkImport'): upload + parse client-side
// con papaparse, anteprima con validazione riga per riga, submit su
// POST /api/students/bulk {action:'import'}.

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Papa from 'papaparse';
import {
  Container,
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  FileInput,
  Table,
  Badge,
  Alert,
  Anchor,
  Code,
  List,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconUpload,
  IconFileSpreadsheet,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react';

interface ImportRow {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
}

interface RowValidation {
  row: ImportRow;
  index: number;
  errors: string[];
}

interface ImportResult {
  created: number;
  errors: Array<{ row: number; error: string }>;
}

// Alias intestazioni: accettiamo sia i nomi canonici sia quelli italiani
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  firstname: 'firstName',
  nome: 'firstName',
  lastname: 'lastName',
  cognome: 'lastName',
  email: 'email',
  'e-mail': 'email',
  phone: 'phone',
  telefono: 'phone',
  dateofbirth: 'dateOfBirth',
  datanascita: 'dateOfBirth',
  'data di nascita': 'dateOfBirth',
  address: 'address',
  indirizzo: 'address',
};

function normalizeRow(raw: Record<string, unknown>): ImportRow {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = HEADER_ALIASES[key.trim().toLowerCase()];
    if (canonical && value != null && String(value).trim() !== '') {
      out[canonical] = String(value).trim();
    }
  }
  return out as unknown as ImportRow;
}

function validateRow(row: ImportRow, index: number): RowValidation {
  const errors: string[] = [];
  if (!row.firstName) errors.push('Nome mancante');
  if (!row.lastName) errors.push('Cognome mancante');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push('Email non valida');
  }
  if (row.dateOfBirth && isNaN(new Date(row.dateOfBirth).getTime())) {
    errors.push('Data di nascita non valida');
  }
  return { row, index, errors };
}

export default function StudentsImportPage() {
  const locale = useLocale();

  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RowValidation[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleFile = (selected: File | null) => {
    setFile(selected);
    setRows([]);
    setResult(null);
    setParseError(null);
    if (!selected) return;

    Papa.parse<Record<string, unknown>>(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        if (!parsed.data.length) {
          setParseError('Il file CSV non contiene righe.');
          return;
        }
        const normalized = parsed.data.map((raw, i) =>
          validateRow(normalizeRow(raw), i)
        );
        setRows(normalized);
      },
      error: (err: Error) => {
        setParseError(`Errore nel parsing del CSV: ${err.message}`);
      },
    });
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import',
          rows: validRows.map((r) => r.row),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Errore durante l'import");
      }
      const data: ImportResult = body.data;
      setResult(data);
      notifications.show({
        title: 'Import completato',
        message: `${data.created} studenti creati${
          data.errors.length ? `, ${data.errors.length} righe con errori` : ''
        }`,
        color: data.errors.length ? 'yellow' : 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error?.message || "Errore durante l'import",
        color: 'red',
        icon: <IconAlertTriangle size={16} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Anchor
            component={Link}
            href={`/${locale}/dashboard/students`}
            style={{ display: 'inline-block' }}
            mb="xs"
          >
            <Group gap={4}>
              <IconArrowLeft size={16} />
              <span>Torna agli studenti</span>
            </Group>
          </Anchor>
          <Title order={2}>Importa studenti da CSV</Title>
          <Text c="dimmed" size="sm">
            Carica un file CSV con intestazioni. Colonne supportate:{' '}
            <Code>firstName/nome</Code>, <Code>lastName/cognome</Code>,{' '}
            <Code>email</Code>, <Code>phone/telefono</Code>,{' '}
            <Code>dateOfBirth/dataNascita</Code>, <Code>address/indirizzo</Code>.
            Nome e cognome sono obbligatori.
          </Text>
        </div>

        <Paper withBorder p="lg" radius="md">
          <Group align="flex-end" wrap="wrap">
            <FileInput
              label="File CSV"
              placeholder="Seleziona il file..."
              accept=".csv,text/csv"
              leftSection={<IconFileSpreadsheet size={16} />}
              value={file}
              onChange={handleFile}
              w={{ base: '100%', sm: 340 }}
              data-testid="students-import-file"
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleSubmit}
              disabled={validRows.length === 0}
              loading={submitting}
              data-testid="students-import-submit"
            >
              Importa {validRows.length > 0 ? `${validRows.length} studenti` : ''}
            </Button>
          </Group>

          {parseError && (
            <Alert color="red" mt="md" icon={<IconAlertTriangle size={16} />}>
              {parseError}
            </Alert>
          )}
        </Paper>

        {result && (
          <Alert
            color={result.errors.length ? 'yellow' : 'green'}
            icon={<IconCheck size={16} />}
            title={`Import completato: ${result.created} studenti creati`}
            data-testid="students-import-result"
          >
            {result.errors.length > 0 && (
              <List size="sm" mt="xs">
                {result.errors.map((e) => (
                  <List.Item key={`${e.row}-${e.error}`}>
                    Riga {e.row}: {e.error}
                  </List.Item>
                ))}
              </List>
            )}
          </Alert>
        )}

        {rows.length > 0 && !result && (
          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={600}>Anteprima ({rows.length} righe)</Text>
              <Group gap="xs">
                <Badge color="green" variant="light">
                  {validRows.length} valide
                </Badge>
                {invalidRows.length > 0 && (
                  <Badge color="red" variant="light">
                    {invalidRows.length} con errori
                  </Badge>
                )}
              </Group>
            </Group>

            {invalidRows.length > 0 && (
              <Alert color="yellow" mb="sm" icon={<IconInfoCircle size={16} />}>
                Le righe con errori verranno ignorate durante l&apos;import.
              </Alert>
            )}

            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover data-testid="students-import-preview">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>Cognome</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Telefono</Table.Th>
                    <Table.Th>Data di nascita</Table.Th>
                    <Table.Th>Esito</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => (
                    <Table.Tr key={r.index}>
                      <Table.Td>{r.index + 1}</Table.Td>
                      <Table.Td>{r.row.firstName || '—'}</Table.Td>
                      <Table.Td>{r.row.lastName || '—'}</Table.Td>
                      <Table.Td>{r.row.email || '—'}</Table.Td>
                      <Table.Td>{r.row.phone || '—'}</Table.Td>
                      <Table.Td>{r.row.dateOfBirth || '—'}</Table.Td>
                      <Table.Td>
                        {r.errors.length === 0 ? (
                          <Badge color="green" variant="light">
                            OK
                          </Badge>
                        ) : (
                          <Badge color="red" variant="light">
                            {r.errors.join(', ')}
                          </Badge>
                        )}
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
