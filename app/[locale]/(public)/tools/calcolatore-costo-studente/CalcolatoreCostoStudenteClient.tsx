'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Divider,
  Grid,
  Group,
  List,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  rem,
} from '@mantine/core';
import { IconCurrencyEuro, IconPlus, IconTrash } from '@tabler/icons-react';
import { PUB_GRADIENT } from '@/components/public/PublicUI';
import {
  RelatedToolsCard,
  ToolCtaCard,
  ToolFaq,
  ToolHero,
  ToolInfoCard,
  ToolLayout,
  ToolSection,
  type FaqItem,
} from '@/components/public/ToolPageShell';

interface CostItem {
  id: string;
  name: string;
  amount: number;
}

interface CostResult {
  totalCosts: number;
  costPerStudent: number;
  costPerStudentMonthly: number;
  breakdown: { name: string; amount: number; percentage: number }[];
}

// Voci di costo iniziali: il reset deve ripristinare ESATTAMENTE queste 7 voci
const DEFAULT_STUDENTS = 50;
const DEFAULT_COSTS: CostItem[] = [
  { id: '1', name: 'Affitto locali', amount: 24000 },
  { id: '2', name: 'Stipendi docenti', amount: 80000 },
  { id: '3', name: 'Utenze (luce, gas, acqua)', amount: 8000 },
  { id: '4', name: 'Materiali didattici', amount: 5000 },
  { id: '5', name: 'Assicurazioni', amount: 3000 },
  { id: '6', name: 'Manutenzione', amount: 4000 },
  { id: '7', name: 'Pubblicità e marketing', amount: 6000 },
];

export function CalcolatoreCostoStudenteClient({
  locale,
  faqs,
}: {
  locale?: string;
  faqs: FaqItem[];
}) {
  // Fallback sicuro su 'it' se il locale non arriva dal server
  const safeLocale = locale || 'it';

  const [students, setStudents] = useState<number | ''>(DEFAULT_STUDENTS);
  const [costs, setCosts] = useState<CostItem[]>(() => DEFAULT_COSTS.map((c) => ({ ...c })));
  const [result, setResult] = useState<CostResult | null>(null);

  const addCost = () => {
    setCosts([
      ...costs,
      { id: Date.now().toString(), name: '', amount: 0 },
    ]);
  };

  const removeCost = (id: string) => {
    if (costs.length > 1) {
      setCosts(costs.filter((c) => c.id !== id));
    }
  };

  const updateCost = (id: string, field: keyof CostItem, value: string | number) => {
    setCosts(
      costs.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const calculate = () => {
    if (!students || students === 0) {
      setResult(null);
      return;
    }

    const totalCosts = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
    const costPerStudent = totalCosts / students;
    const costPerStudentMonthly = costPerStudent / 12;

    const breakdown = costs
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.name || 'Altro',
        amount: c.amount,
        percentage: (c.amount / totalCosts) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    setResult({
      totalCosts,
      costPerStudent: Math.round(costPerStudent * 100) / 100,
      costPerStudentMonthly: Math.round(costPerStudentMonthly * 100) / 100,
      breakdown,
    });
  };

  // Il reset ripristina tutte e 7 le voci di default (clone profondo)
  const reset = () => {
    setStudents(DEFAULT_STUDENTS);
    setCosts(DEFAULT_COSTS.map((c) => ({ ...c })));
    setResult(null);
  };

  return (
    <>
      <ToolHero
        locale={safeLocale}
        icon={IconCurrencyEuro}
        title="Calcolatore Costo per Studente"
        description="Calcola il costo effettivo per ogni studente"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={safeLocale} />

            <ToolInfoCard title="Voci di Costo Tipiche">
              <List size="sm" spacing={6} c="dimmed">
                <List.Item>Affitto e utenze (20-30%)</List.Item>
                <List.Item>Stipendi docenti (40-50%)</List.Item>
                <List.Item>Materiali didattici (5-10%)</List.Item>
                <List.Item>Assicurazioni (2-5%)</List.Item>
                <List.Item>Marketing (5-10%)</List.Item>
                <List.Item>Amministrazione (5-10%)</List.Item>
              </List>
            </ToolInfoCard>

            <RelatedToolsCard
              locale={safeLocale}
              tools={[
                { slug: 'calcolatore-ore-corso', title: 'Calcolatore Ore Corso' },
                { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
                { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario' },
              ]}
            />
          </>
        }
      >
        <ToolSection title="Inserisci i dati">
          <Stack gap="lg">
            <NumberInput
              label="Numero di studenti"
              description="Studenti totali iscritti"
              placeholder="50"
              min={1}
              value={students}
              onChange={(val) => setStudents(val === '' ? '' : Number(val))}
              size="md"
            />

            <Divider label="Costi annuali (€)" />

            <Stack gap="sm">
              {costs.map((cost) => (
                <Grid key={cost.id} gutter="xs" align="center">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      placeholder="Nome voce di costo"
                      value={cost.name}
                      onChange={(e) =>
                        updateCost(cost.id, 'name', e.target.value)
                      }
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 9, sm: 4 }}>
                    <NumberInput
                      placeholder="0"
                      min={0}
                      value={cost.amount}
                      onChange={(val) =>
                        updateCost(cost.id, 'amount', val || 0)
                      }
                      prefix="€"
                      thousandSeparator="."
                      decimalSeparator=","
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 3, sm: 2 }} ta="right">
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={() => removeCost(cost.id)}
                      disabled={costs.length === 1}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Grid.Col>
                </Grid>
              ))}
            </Stack>

            <Group>
              <Button
                variant="light"
                color="indigo"
                radius="xl"
                leftSection={<IconPlus size={18} />}
                onClick={addCost}
              >
                Aggiungi voce di costo
              </Button>
            </Group>

            <Group>
              <Button
                onClick={calculate}
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={PUB_GRADIENT}
                fw={700}
              >
                Calcola
              </Button>
              <Button variant="default" radius="xl" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato */}
            {result && (
              <Stack gap="lg">
                <Paper p="xl" radius="lg" withBorder bg="var(--pub-surface)">
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Costi Totali Annui
                      </Text>
                      <Text fz={rem(26)} fw={800} c="var(--pub-ink)">
                        € {result.totalCosts.toLocaleString('it-IT')}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Costo per Studente (Anno)
                      </Text>
                      <Text fz={rem(26)} fw={800} c="var(--pub-ink)">
                        € {result.costPerStudent.toLocaleString('it-IT')}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Costo per Studente (Mese)
                      </Text>
                      <Text fz={rem(26)} fw={800} c="var(--pub-ink)">
                        € {result.costPerStudentMonthly.toLocaleString('it-IT')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </Paper>

                <Divider />

                <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                  Ripartizione Costi
                </Title>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Voce</Table.Th>
                      <Table.Th ta="right">Importo</Table.Th>
                      <Table.Th ta="right">%</Table.Th>
                      <Table.Th ta="right">Per Studente</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {result.breakdown.map((item, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>{item.name}</Table.Td>
                        <Table.Td ta="right">
                          € {item.amount.toLocaleString('it-IT')}
                        </Table.Td>
                        <Table.Td ta="right">
                          {item.percentage.toFixed(1)}%
                        </Table.Td>
                        <Table.Td ta="right">
                          € {(item.amount / (students || 1)).toLocaleString('it-IT', {
                            maximumFractionDigits: 2,
                          })}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Paper p="md" radius="md" bg="var(--pub-surface)">
                  <Text size="sm">
                    <strong>Suggerimento:</strong> Per coprire i costi e avere un margine del 20%,
                    la retta annuale consigliata è di{' '}
                    <strong>
                      € {(result.costPerStudent * 1.2).toLocaleString('it-IT', {
                        maximumFractionDigits: 0,
                      })}
                    </strong>{' '}
                    (€{' '}
                    {(result.costPerStudentMonthly * 1.2).toLocaleString('it-IT', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    al mese).
                  </Text>
                </Paper>
              </Stack>
            )}
          </Stack>
        </ToolSection>

        <ToolSection title="Come Funziona">
          <Text mb="md">
            Il calcolatore somma tutte le voci di costo annuali della scuola e divide il
            totale per il numero di studenti: <strong>Costo per studente = Costi totali /
            Numero studenti</strong>. Il costo mensile si ottiene dividendo per 12.
          </Text>
          <Text>
            Come riferimento per la retta, aggiungi al costo per studente un margine di
            almeno il 20%, così da coprire imprevisti e posti non occupati.
          </Text>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
