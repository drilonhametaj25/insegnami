'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
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
  Select,
  Table,
  Badge,
  Divider,
} from '@mantine/core';
import { IconClock, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

interface CourseResult {
  totalHours: number;
  totalLessons: number;
  weeksNeeded: number;
  lessonsPerWeek: number;
  endDate: Date;
  schedule: { week: number; lessons: number; cumulativeHours: number }[];
}

export default function CalcolatoreOreCorsoPage() {
  const locale = useLocale();
  const [totalHours, setTotalHours] = useState<number | ''>(60);
  const [lessonDuration, setLessonDuration] = useState<number | ''>(2);
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number | ''>(2);
  const [startDateStr, setStartDateStr] = useState('2024-09-09');
  const [result, setResult] = useState<CourseResult | null>(null);

  const calculate = () => {
    if (!totalHours || !lessonDuration || !lessonsPerWeek) {
      setResult(null);
      return;
    }

    const totalLessons = Math.ceil(totalHours / lessonDuration);
    const weeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeksNeeded * 7);

    // Generate weekly schedule
    const schedule: { week: number; lessons: number; cumulativeHours: number }[] = [];
    let remainingLessons = totalLessons;
    let cumulativeHours = 0;

    for (let week = 1; week <= weeksNeeded; week++) {
      const lessonsThisWeek = Math.min(lessonsPerWeek, remainingLessons);
      cumulativeHours += lessonsThisWeek * lessonDuration;
      schedule.push({
        week,
        lessons: lessonsThisWeek,
        cumulativeHours: Math.min(cumulativeHours, totalHours),
      });
      remainingLessons -= lessonsThisWeek;
    }

    setResult({
      totalHours,
      totalLessons,
      weeksNeeded,
      lessonsPerWeek,
      endDate,
      schedule,
    });
  };

  const reset = () => {
    setTotalHours(60);
    setLessonDuration(2);
    setLessonsPerWeek(2);
    setStartDateStr('2024-09-09');
    setResult(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const faqs = [
    {
      question: 'Come calcolo le ore necessarie per un corso?',
      answer:
        'Le ore di un corso dipendono dagli obiettivi formativi. Per certificazioni linguistiche: A1=80-100h, A2=180-200h, B1=350-400h, B2=500-600h. Per corsi musicali: base 30-40h/anno, intermedio 40-60h/anno.',
    },
    {
      question: 'Qual è la durata ideale di una lezione?',
      answer:
        'Dipende dall\'età e dal tipo di corso. Per bambini: 30-45 minuti. Per ragazzi: 45-60 minuti. Per adulti: 60-120 minuti. Per corsi intensivi: fino a 3-4 ore con pause.',
    },
    {
      question: 'Quante lezioni a settimana sono consigliate?',
      answer:
        'Per corsi standard: 1-2 lezioni/settimana. Per corsi intensivi: 3-5 lezioni/settimana. Più di 5 lezioni può portare a sovraccarico e ridurre l\'efficacia dell\'apprendimento.',
    },
    {
      question: 'Come gestisco le assenze e i recuperi?',
      answer:
        'È consigliabile prevedere un 10-15% di ore extra per recuperi. InsegnaMi.pro gestisce automaticamente le assenze e pianifica le lezioni di recupero.',
    },
  ];

  const presets = [
    { name: 'Corso base lingua', hours: 40, duration: 1.5, perWeek: 2 },
    { name: 'Corso intensivo', hours: 80, duration: 3, perWeek: 5 },
    { name: 'Lezioni private', hours: 20, duration: 1, perWeek: 1 },
    { name: 'Corso annuale musica', hours: 60, duration: 1, perWeek: 1 },
  ];

  const applyPreset = (preset: typeof presets[0]) => {
    setTotalHours(preset.hours);
    setLessonDuration(preset.duration);
    setLessonsPerWeek(preset.perWeek);
  };

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-orange-6) 0%, var(--mantine-color-red-5) 100%)',
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
              <ThemeIcon size={60} radius="xl" variant="white" color="orange">
                <IconClock size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Calcolatore Ore Corso</Title>
                <Text size="lg" mt="xs">
                  Pianifica le lezioni e calcola la durata del corso
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
                  Configura il corso
                </Title>

                {/* Presets */}
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Preimpostazioni:
                  </Text>
                  {presets.map((preset) => (
                    <Badge
                      key={preset.name}
                      variant="light"
                      color="orange"
                      style={{ cursor: 'pointer' }}
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.name}
                    </Badge>
                  ))}
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <NumberInput
                    label="Ore totali del corso"
                    description="Monte ore complessivo"
                    placeholder="60"
                    min={1}
                    max={1000}
                    value={totalHours}
                    onChange={(val) => setTotalHours(val === '' ? '' : Number(val))}
                    suffix=" ore"
                  />
                  <NumberInput
                    label="Durata singola lezione"
                    description="Ore per lezione"
                    placeholder="2"
                    min={0.5}
                    max={8}
                    step={0.5}
                    decimalScale={1}
                    value={lessonDuration}
                    onChange={(val) => setLessonDuration(val === '' ? '' : Number(val))}
                    suffix=" ore"
                  />
                  <NumberInput
                    label="Lezioni a settimana"
                    description="Frequenza settimanale"
                    placeholder="2"
                    min={1}
                    max={7}
                    value={lessonsPerWeek}
                    onChange={(val) => setLessonsPerWeek(val === '' ? '' : Number(val))}
                  />
                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      Data inizio corso
                    </Text>
                    <input
                      type="date"
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--mantine-color-gray-4)',
                        borderRadius: 'var(--mantine-radius-sm)',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </SimpleGrid>

                <Group>
                  <Button onClick={calculate} size="lg" color="orange">
                    Calcola
                  </Button>
                  <Button variant="outline" onClick={reset} color="orange">
                    Reset
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Stack gap="lg">
                    <Paper p="xl" radius="md" bg="orange.0">
                      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Ore Totali
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.totalHours}h
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            N° Lezioni
                          </Text>
                          <Text size="xl" fw={700} c="orange">
                            {result.totalLessons}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Settimane
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.weeksNeeded}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Fine Corso
                          </Text>
                          <Text size="lg" fw={700}>
                            {formatDate(result.endDate)}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                    </Paper>

                    <Divider />

                    <Title order={3}>Pianificazione Settimanale</Title>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Settimana</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Lezioni</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Ore Settimana</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Ore Cumulative</Table.Th>
                          <Table.Th style={{ textAlign: 'center' }}>Progresso</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {result.schedule.slice(0, 12).map((week) => (
                          <Table.Tr key={week.week}>
                            <Table.Td>Settimana {week.week}</Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {week.lessons}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {week.lessons * (lessonDuration || 0)}h
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              {week.cumulativeHours}h
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge
                                color={
                                  week.cumulativeHours >= (totalHours || 0)
                                    ? 'green'
                                    : 'blue'
                                }
                              >
                                {Math.round(
                                  (week.cumulativeHours / (totalHours || 1)) * 100
                                )}
                                %
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                        {result.schedule.length > 12 && (
                          <Table.Tr>
                            <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                              <Text size="sm" c="dimmed">
                                ... e altre {result.schedule.length - 12} settimane
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
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
              <Card withBorder p="xl" radius="md" bg="orange.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Pianifica i Corsi con InsegnaMi.pro
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Gestisci corsi, lezioni e progressi degli studenti
                    in un&apos;unica piattaforma.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-orange-6)',
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

              {/* Reference */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Durate Tipiche Corsi
                </Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Lingua A1-A2:</Text>
                    <Badge color="blue">80-180h</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Lingua B1-B2:</Text>
                    <Badge color="blue">350-600h</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Musica base:</Text>
                    <Badge color="violet">30-40h</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Informatica:</Text>
                    <Badge color="green">20-60h</Badge>
                  </Group>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href={`/${locale}/tools/generatore-orario-settimanale`} size="sm">
                    Generatore Orario
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/generatore-calendario-scolastico`} size="sm">
                    Generatore Calendario
                  </Anchor>
                  <Anchor component={Link} href={`/${locale}/tools/calcolatore-presenze`} size="sm">
                    Calcolatore Presenze
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
