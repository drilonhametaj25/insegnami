'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  TextInput,
  NumberInput,
  Button,
  Table,
  ActionIcon,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Badge,
  Divider,
} from '@mantine/core';
import { IconPlus, IconTrash, IconCalculator, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

interface Grade {
  id: string;
  subject: string;
  grade: number | '';
  weight: number;
}

// BUG-054 fix: Extract initial grades constant outside component
const INITIAL_GRADES: Grade[] = [
  { id: '1', subject: '', grade: '', weight: 1 },
];

export default function CalcolatoreMediaVotiPage() {
  // BUG-034/035 fix: Get locale from params for dynamic links
  const params = useParams();
  // BUG-052 fix: Safe cast with fallback
  const locale = typeof params?.locale === 'string' ? params.locale : 'it';

  const [grades, setGrades] = useState<Grade[]>(INITIAL_GRADES);
  const [result, setResult] = useState<{ average: number; totalWeight: number } | null>(null);

  const addGrade = () => {
    setGrades([
      ...grades,
      { id: Date.now().toString(), subject: '', grade: '', weight: 1 },
    ]);
  };

  const removeGrade = (id: string) => {
    if (grades.length > 1) {
      setGrades(grades.filter((g) => g.id !== id));
    }
  };

  const updateGrade = (id: string, field: keyof Grade, value: string | number) => {
    setGrades(
      grades.map((g) => (g.id === id ? { ...g, [field]: value } : g))
    );
  };

  const calculateAverage = () => {
    const validGrades = grades.filter((g) => g.grade !== '' && typeof g.grade === 'number');

    if (validGrades.length === 0) {
      setResult(null);
      return;
    }

    const totalWeight = validGrades.reduce((sum, g) => sum + g.weight, 0);
    const weightedSum = validGrades.reduce(
      (sum, g) => sum + (g.grade as number) * g.weight,
      0
    );
    const average = weightedSum / totalWeight;

    setResult({
      average: Math.round(average * 100) / 100,
      totalWeight,
    });
  };

  // BUG-054 fix: Use cloned INITIAL_GRADES to avoid mutations
  const reset = () => {
    setGrades([...INITIAL_GRADES]);
    setResult(null);
  };

  const faqs = [
    {
      question: 'Come funziona il calcolo della media pesata?',
      answer:
        'La media pesata tiene conto del "peso" di ogni voto. Ogni voto viene moltiplicato per il suo peso, poi si sommano tutti i risultati e si divide per la somma totale dei pesi. Questo permette di dare più importanza ad alcune valutazioni rispetto ad altre.',
    },
    {
      question: 'Quando usare pesi diversi per i voti?',
      answer:
        'I pesi diversi sono utili quando alcune valutazioni hanno più importanza di altre. Ad esempio, un compito in classe potrebbe avere peso 2, mentre un\'interrogazione peso 1. Oppure le materie principali potrebbero avere peso maggiore.',
    },
    {
      question: 'Come si calcola la media semplice?',
      answer:
        'Per calcolare la media semplice, imposta tutti i pesi a 1. In questo caso, tutti i voti avranno la stessa importanza e il risultato sarà la classica media aritmetica.',
    },
    {
      question: 'Posso salvare i miei calcoli?',
      answer:
        'Questo strumento gratuito non salva i dati. Per tenere traccia di tutti i voti dei tuoi studenti con calcolo automatico delle medie, prova InsegnaMi.pro gratuitamente per 14 giorni.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-cyan-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="lg">
          <Stack gap="md">
            <Anchor component={Link} href={`/${locale}/tools`} c="white" size="sm">
              <Group gap={4}>
                <IconArrowLeft size={16} />
                Tutti gli strumenti
              </Group>
            </Anchor>
            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="blue">
                <IconCalculator size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Calcolatore Media Voti</Title>
                <Text size="lg" mt="xs">
                  Calcola la media pesata dei voti scolastici
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
                  Inserisci i voti
                </Title>

                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Materia/Descrizione</Table.Th>
                      <Table.Th style={{ width: 100 }}>Voto</Table.Th>
                      <Table.Th style={{ width: 100 }}>Peso</Table.Th>
                      <Table.Th style={{ width: 50 }}></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {grades.map((grade) => (
                      <Table.Tr key={grade.id}>
                        <Table.Td>
                          <TextInput
                            placeholder="Es. Matematica"
                            value={grade.subject}
                            onChange={(e) =>
                              updateGrade(grade.id, 'subject', e.target.value)
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            placeholder="7"
                            min={0}
                            max={10}
                            step={0.5}
                            decimalScale={2}
                            value={grade.grade}
                            onChange={(val) =>
                              updateGrade(grade.id, 'grade', val || '')
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <NumberInput
                            min={1}
                            max={10}
                            value={grade.weight}
                            onChange={(val) =>
                              updateGrade(grade.id, 'weight', val || 1)
                            }
                          />
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            color="red"
                            variant="subtle"
                            onClick={() => removeGrade(grade.id)}
                            disabled={grades.length === 1}
                          >
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Group>
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={18} />}
                    onClick={addGrade}
                  >
                    Aggiungi voto
                  </Button>
                </Group>

                <Group>
                  <Button onClick={calculateAverage} size="lg">
                    Calcola Media
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Reset
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Paper p="xl" radius="md" bg="blue.0">
                    <Stack align="center" gap="sm">
                      <Text size="sm" c="dimmed">
                        Media Pesata
                      </Text>
                      <Title order={1} c="blue" style={{ fontSize: '3rem' }}>
                        {result.average.toFixed(2)}
                      </Title>
                      <Text size="sm" c="dimmed">
                        Calcolata su {grades.filter((g) => g.grade !== '').length} voti
                        (peso totale: {result.totalWeight})
                      </Text>
                      <Badge
                        color={
                          result.average >= 6
                            ? 'green'
                            : result.average >= 5
                            ? 'yellow'
                            : 'red'
                        }
                        size="lg"
                      >
                        {result.average >= 6
                          ? 'Sufficiente'
                          : result.average >= 5
                          ? 'Quasi sufficiente'
                          : 'Insufficiente'}
                      </Badge>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Card>

            {/* How it works */}
            <Card withBorder shadow="sm" radius="md" p="xl" mt="xl">
              <Title order={2} size="h3" mb="md">
                Come Funziona
              </Title>
              <Text mb="md">
                Il calcolatore della media voti pesata ti permette di calcolare la media
                scolastica tenendo conto del diverso peso che possono avere le varie
                valutazioni.
              </Text>
              <Text mb="md">
                <strong>Formula della media pesata:</strong>
              </Text>
              <Paper p="md" bg="gray.0" radius="md" mb="md">
                <Text ta="center" ff="monospace">
                  Media = (Voto₁ × Peso₁ + Voto₂ × Peso₂ + ... + Votoₙ × Pesoₙ) / (Peso₁ + Peso₂ + ... + Pesoₙ)
                </Text>
              </Paper>
              <Text>
                Ad esempio, se hai un 7 con peso 2 e un 8 con peso 1:
                <br />
                Media = (7 × 2 + 8 × 1) / (2 + 1) = (14 + 8) / 3 = 22 / 3 = <strong>7.33</strong>
              </Text>
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
              <Card withBorder p="xl" radius="md" bg="blue.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Gestisci i Voti Automaticamente
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro registri i voti una volta sola e le medie si
                    calcolano automaticamente.
                  </Text>
                  <Anchor
                    component={Link}
                    href={`/${locale}/auth/register`}
                    style={{
                      backgroundColor: 'var(--mantine-color-blue-6)',
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

              {/* Tips Card */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Suggerimenti
                </Title>
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    • Usa peso 2 per i compiti in classe
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Usa peso 1 per le interrogazioni
                  </Text>
                  <Text size="sm" c="dimmed">
                    • Usa peso 0.5 per i compiti a casa
                  </Text>
                  <Text size="sm" c="dimmed">
                    • La scala voti italiana va da 0 a 10
                  </Text>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href={`/${locale}/tools/calcolatore-presenze`} size="sm">
                    Calcolatore Presenze
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/generatore-calendario-scolastico`} size="sm">
                    Generatore Calendario
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/calcolatore-costo-studente`} size="sm">
                    Calcolatore Costi
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
