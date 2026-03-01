'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  NumberInput,
  Button,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Divider,
  Table,
} from '@mantine/core';
import { IconCurrencyEuro, IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';

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

export default function CalcolatoreCostoStudentePage() {
  const [students, setStudents] = useState<number | ''>(50);
  const [costs, setCosts] = useState<CostItem[]>([
    { id: '1', name: 'Affitto locali', amount: 24000 },
    { id: '2', name: 'Stipendi docenti', amount: 80000 },
    { id: '3', name: 'Utenze (luce, gas, acqua)', amount: 8000 },
    { id: '4', name: 'Materiali didattici', amount: 5000 },
    { id: '5', name: 'Assicurazioni', amount: 3000 },
    { id: '6', name: 'Manutenzione', amount: 4000 },
    { id: '7', name: 'Pubblicità e marketing', amount: 6000 },
  ]);
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

  const reset = () => {
    setStudents(50);
    setCosts([
      { id: '1', name: 'Affitto locali', amount: 24000 },
      { id: '2', name: 'Stipendi docenti', amount: 80000 },
      { id: '3', name: 'Utenze', amount: 8000 },
    ]);
    setResult(null);
  };

  const faqs = [
    {
      question: 'Quali costi devo includere nel calcolo?',
      answer:
        'Dovresti includere tutti i costi fissi e variabili della scuola: affitto, stipendi, utenze, materiali, assicurazioni, manutenzione, marketing, software, consulenze, tasse. Non dimenticare i costi nascosti come ammortamenti e imprevisti.',
    },
    {
      question: 'Come uso questo dato per stabilire le rette?',
      answer:
        'Il costo per studente è il tuo "punto di pareggio". Per avere un margine, la retta dovrebbe essere superiore a questo valore. Un margine del 15-25% è tipico per le scuole private, considerando anche un tasso di occupazione non al 100%.',
    },
    {
      question: 'Devo considerare studenti a tempo pieno e part-time diversamente?',
      answer:
        'Sì, è consigliabile calcolare gli studenti in "equivalenti a tempo pieno" (FTE). Ad esempio, uno studente part-time al 50% conta come 0.5 FTE. Questo dà un costo per studente più accurato.',
    },
    {
      question: 'Con quale frequenza dovrei rifare questo calcolo?',
      answer:
        'È consigliabile rifare il calcolo almeno una volta all\'anno o quando ci sono cambiamenti significativi nei costi o nel numero di studenti. InsegnaMi.pro può calcolare automaticamente questi dati in tempo reale.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-yellow-6) 0%, var(--mantine-color-orange-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="lg">
          <Stack gap="md">
            <Anchor component={Link} href="/it/tools" c="white" size="sm">
              <Group gap={4}>
                <IconArrowLeft size={16} />
                Tutti gli strumenti
              </Group>
            </Anchor>
            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="yellow">
                <IconCurrencyEuro size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Calcolatore Costo per Studente</Title>
                <Text size="lg" mt="xs">
                  Calcola il costo effettivo per ogni studente
                </Text>
              </div>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="lg" py="xl">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
          {/* Main Tool */}
          <Box style={{ gridColumn: 'span 2' }}>
            <Card withBorder shadow="sm" radius="md" p="xl">
              <Stack gap="lg">
                <Title order={2} size="h3">
                  Inserisci i dati
                </Title>

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
                    <Group key={cost.id} gap="sm">
                      <Box style={{ flex: 1 }}>
                        <input
                          type="text"
                          placeholder="Nome voce di costo"
                          value={cost.name}
                          onChange={(e) =>
                            updateCost(cost.id, 'name', e.target.value)
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid var(--mantine-color-gray-4)',
                            borderRadius: 'var(--mantine-radius-sm)',
                            fontSize: '14px',
                          }}
                        />
                      </Box>
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
                        style={{ width: 150 }}
                      />
                      <Button
                        color="red"
                        variant="subtle"
                        size="sm"
                        onClick={() => removeCost(cost.id)}
                        disabled={costs.length === 1}
                        px="xs"
                      >
                        <IconTrash size={18} />
                      </Button>
                    </Group>
                  ))}
                </Stack>

                <Button
                  variant="light"
                  leftSection={<IconPlus size={18} />}
                  onClick={addCost}
                >
                  Aggiungi voce di costo
                </Button>

                <Group>
                  <Button onClick={calculate} size="lg" color="yellow">
                    Calcola
                  </Button>
                  <Button variant="outline" onClick={reset} color="yellow">
                    Reset
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Stack gap="lg">
                    <Paper p="xl" radius="md" bg="yellow.0">
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl">
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Costi Totali Annui
                          </Text>
                          <Text size="xl" fw={700}>
                            € {result.totalCosts.toLocaleString('it-IT')}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Costo per Studente (Anno)
                          </Text>
                          <Text size="xl" fw={700} c="yellow.8">
                            € {result.costPerStudent.toLocaleString('it-IT')}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Costo per Studente (Mese)
                          </Text>
                          <Text size="xl" fw={700} c="orange">
                            € {result.costPerStudentMonthly.toLocaleString('it-IT')}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                    </Paper>

                    <Divider />

                    <Title order={3}>Ripartizione Costi</Title>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Voce</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Importo</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Per Studente</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {result.breakdown.map((item, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{item.name}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              € {item.amount.toLocaleString('it-IT')}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              {item.percentage.toFixed(1)}%
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              € {(item.amount / (students || 1)).toLocaleString('it-IT', {
                                maximumFractionDigits: 2,
                              })}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>

                    <Paper p="md" radius="md" bg="gray.0">
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
            </Card>

            {/* FAQ */}
            <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
              <Title order={2} size="h3" mb="md">
                Domande Frequenti
              </Title>
              <Accordion>
                {faqs.map((faq, index) => (
                  <Accordion.Item key={index} value={`faq-${index}`}>
                    <Accordion.Control>{faq.question}</Accordion.Control>
                    <Accordion.Panel>
                      <Text size="sm" c="dimmed">
                        {faq.answer}
                      </Text>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card>
          </Box>

          {/* Sidebar */}
          <Box>
            <Stack gap="lg" style={{ position: 'sticky', top: 100 }}>
              {/* CTA Card */}
              <Card withBorder p="xl" radius="md" bg="yellow.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Monitora i Costi in Tempo Reale
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro hai report finanziari automatici,
                    analisi dei costi e previsioni di budget.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-yellow-6)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: 'var(--mantine-radius-md)',
                      textDecoration: 'none',
                      fontWeight: 500,
                      textAlign: 'center',
                      display: 'block',
                    }}
                  >
                    Prova Gratis 14 Giorni
                  </Anchor>
                  <Text ta="center" size="xs" c="dimmed">
                    Nessuna carta di credito
                  </Text>
                </Stack>
              </Card>

              {/* Tips */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Voci di Costo Tipiche
                </Title>
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">• Affitto e utenze (20-30%)</Text>
                  <Text size="sm" c="dimmed">• Stipendi docenti (40-50%)</Text>
                  <Text size="sm" c="dimmed">• Materiali didattici (5-10%)</Text>
                  <Text size="sm" c="dimmed">• Assicurazioni (2-5%)</Text>
                  <Text size="sm" c="dimmed">• Marketing (5-10%)</Text>
                  <Text size="sm" c="dimmed">• Amministrazione (5-10%)</Text>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href="/it/tools/calcolatore-ore-corso" size="sm">
                    Calcolatore Ore Corso
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/calcolatore-presenze" size="sm">
                    Calcolatore Presenze
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/generatore-calendario-scolastico" size="sm">
                    Generatore Calendario
                  </Anchor>
                </Stack>
              </Card>
            </Stack>
          </Box>
        </SimpleGrid>
      </Container>
    </>
  );
}
