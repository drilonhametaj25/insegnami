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
  Badge,
  Table,
  Select,
  Checkbox,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCalendar, IconArrowLeft, IconDownload } from '@tabler/icons-react';
import Link from 'next/link';

interface Holiday {
  date: Date;
  name: string;
  type: 'national' | 'school' | 'regional';
}

interface CalendarResult {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  schoolDays: number;
  holidays: Holiday[];
  weekends: number;
}

// Italian national holidays (fixed dates)
const nationalHolidays = [
  { month: 0, day: 1, name: 'Capodanno' },
  { month: 0, day: 6, name: 'Epifania' },
  { month: 3, day: 25, name: 'Festa della Liberazione' },
  { month: 4, day: 1, name: 'Festa dei Lavoratori' },
  { month: 5, day: 2, name: 'Festa della Repubblica' },
  { month: 7, day: 15, name: 'Ferragosto' },
  { month: 10, day: 1, name: 'Tutti i Santi' },
  { month: 11, day: 8, name: 'Immacolata Concezione' },
  { month: 11, day: 25, name: 'Natale' },
  { month: 11, day: 26, name: 'Santo Stefano' },
];

// Calculate Easter (Computus algorithm)
function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function getHolidaysForYear(year: number, includeChristmasBreak: boolean, includeEasterBreak: boolean): Holiday[] {
  const holidays: Holiday[] = [];

  // National holidays
  nationalHolidays.forEach((h) => {
    const date = new Date(year, h.month, h.day);
    holidays.push({ date, name: h.name, type: 'national' });
  });

  // Easter and Easter Monday
  const easter = getEaster(year);
  holidays.push({ date: easter, name: 'Pasqua', type: 'national' });
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({ date: easterMonday, name: 'Lunedì dell\'Angelo', type: 'national' });

  // Christmas break (Dec 23 - Jan 6)
  if (includeChristmasBreak) {
    for (let d = 23; d <= 31; d++) {
      const date = new Date(year, 11, d);
      if (!holidays.find((h) => h.date.getTime() === date.getTime())) {
        holidays.push({ date, name: 'Vacanze di Natale', type: 'school' });
      }
    }
    for (let d = 2; d <= 5; d++) {
      const date = new Date(year + 1, 0, d);
      if (!holidays.find((h) => h.date.getTime() === date.getTime())) {
        holidays.push({ date, name: 'Vacanze di Natale', type: 'school' });
      }
    }
  }

  // Easter break (3 days before Easter to Tuesday after)
  if (includeEasterBreak) {
    const easterBreakStart = new Date(easter);
    easterBreakStart.setDate(easter.getDate() - 3);
    const easterBreakEnd = new Date(easter);
    easterBreakEnd.setDate(easter.getDate() + 2);

    for (let d = new Date(easterBreakStart); d <= easterBreakEnd; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      if (!holidays.find((h) => h.date.getTime() === date.getTime())) {
        holidays.push({ date, name: 'Vacanze di Pasqua', type: 'school' });
      }
    }
  }

  return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export default function GeneratoreCalendarioPage() {
  const [startDate, setStartDate] = useState<Date | null>(new Date(2024, 8, 9)); // Sept 9
  const [endDate, setEndDate] = useState<Date | null>(new Date(2025, 5, 10)); // June 10
  const [includeChristmas, setIncludeChristmas] = useState(true);
  const [includeEaster, setIncludeEaster] = useState(true);
  const [result, setResult] = useState<CalendarResult | null>(null);

  const generate = () => {
    if (!startDate || !endDate) {
      setResult(null);
      return;
    }

    const holidays: Holiday[] = [];
    let weekends = 0;
    let schoolDays = 0;

    // Get holidays for both years
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      holidays.push(...getHolidaysForYear(year, includeChristmas, includeEaster));
    }

    // Filter holidays within date range
    const filteredHolidays = holidays.filter(
      (h) => h.date >= startDate && h.date <= endDate
    );

    // Count days
    let totalDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      totalDays++;
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = filteredHolidays.some(
        (h) => h.date.toDateString() === d.toDateString()
      );

      if (isWeekend) {
        weekends++;
      } else if (!isHoliday) {
        schoolDays++;
      }
    }

    setResult({
      startDate,
      endDate,
      totalDays,
      schoolDays,
      holidays: filteredHolidays.filter((h) => {
        const dayOfWeek = h.date.getDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude holidays on weekends
      }),
      weekends,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const faqs = [
    {
      question: 'Quando inizia l\'anno scolastico in Italia?',
      answer:
        'L\'inizio dell\'anno scolastico varia per regione, generalmente tra il 5 e il 15 settembre. Ogni regione pubblica il proprio calendario scolastico con le date precise.',
    },
    {
      question: 'Quanti giorni di scuola ci sono in un anno?',
      answer:
        'La legge italiana prevede un minimo di 200 giorni di lezione per l\'anno scolastico. Alcune regioni possono prevedere qualche giorno in più per permettere maggiore flessibilità.',
    },
    {
      question: 'Quali sono le festività nazionali obbligatorie?',
      answer:
        'Le festività nazionali sempre incluse sono: Capodanno, Epifania, Pasqua e Lunedì dell\'Angelo, 25 Aprile, 1 Maggio, 2 Giugno, 15 Agosto, 1 Novembre, 8 Dicembre, Natale e Santo Stefano.',
    },
    {
      question: 'Posso personalizzare le festività regionali?',
      answer:
        'Questo generatore include le festività nazionali e le vacanze standard. Per personalizzazioni specifiche della tua regione o istituto, usa InsegnaMi.pro che permette di configurare un calendario completamente personalizzato.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-grape-5) 100%)',
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
              <ThemeIcon size={60} radius="xl" variant="white" color="violet">
                <IconCalendar size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Generatore Calendario Scolastico</Title>
                <Text size="lg" mt="xs">
                  Genera un calendario con festività e giorni di scuola
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
                  Configura il calendario
                </Title>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <DateInput
                    label="Inizio anno scolastico"
                    placeholder="Seleziona data"
                    value={startDate}
                    onChange={setStartDate}
                    locale="it"
                  />
                  <DateInput
                    label="Fine anno scolastico"
                    placeholder="Seleziona data"
                    value={endDate}
                    onChange={setEndDate}
                    locale="it"
                  />
                </SimpleGrid>

                <Stack gap="xs">
                  <Checkbox
                    label="Includi vacanze di Natale (23 dic - 6 gen)"
                    checked={includeChristmas}
                    onChange={(e) => setIncludeChristmas(e.currentTarget.checked)}
                  />
                  <Checkbox
                    label="Includi vacanze di Pasqua (giovedì - martedì)"
                    checked={includeEaster}
                    onChange={(e) => setIncludeEaster(e.currentTarget.checked)}
                  />
                </Stack>

                <Group>
                  <Button onClick={generate} size="lg" color="violet">
                    Genera Calendario
                  </Button>
                </Group>

                {/* Result */}
                {result && (
                  <Stack gap="lg">
                    <Paper p="xl" radius="md" bg="violet.0">
                      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Giorni Totali
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.totalDays}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Giorni di Scuola
                          </Text>
                          <Text size="xl" fw={700} c="violet">
                            {result.schoolDays}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Weekend
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.weekends}
                          </Text>
                        </Stack>
                        <Stack align="center" gap={4}>
                          <Text size="sm" c="dimmed">
                            Festività
                          </Text>
                          <Text size="xl" fw={700}>
                            {result.holidays.length}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                    </Paper>

                    <Divider />

                    <Title order={3}>Festività e Vacanze</Title>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Data</Table.Th>
                          <Table.Th>Festività</Table.Th>
                          <Table.Th>Tipo</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {result.holidays.map((holiday, index) => (
                          <Table.Tr key={index}>
                            <Table.Td>{formatDate(holiday.date)}</Table.Td>
                            <Table.Td>{holiday.name}</Table.Td>
                            <Table.Td>
                              <Badge
                                color={
                                  holiday.type === 'national'
                                    ? 'red'
                                    : holiday.type === 'school'
                                    ? 'blue'
                                    : 'green'
                                }
                                size="sm"
                              >
                                {holiday.type === 'national'
                                  ? 'Nazionale'
                                  : holiday.type === 'school'
                                  ? 'Scolastica'
                                  : 'Regionale'}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>

                    <Badge
                      color={result.schoolDays >= 200 ? 'green' : 'yellow'}
                      size="lg"
                    >
                      {result.schoolDays >= 200
                        ? `✓ Requisito 200 giorni raggiunto (${result.schoolDays} giorni)`
                        : `⚠ Sotto il minimo di 200 giorni (${result.schoolDays} giorni)`}
                    </Badge>
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
              <Card withBorder p="xl" radius="md" bg="violet.0">
                <Stack gap="md">
                  <Title order={3} ta="center">
                    Calendario Integrato
                  </Title>
                  <Text ta="center" size="sm" c="dimmed">
                    Con InsegnaMi.pro hai un calendario completamente integrato
                    con lezioni, presenze e comunicazioni automatiche.
                  </Text>
                  <Anchor
                    component={Link}
                    href="/auth/register"
                    style={{
                      backgroundColor: 'var(--mantine-color-violet-6)',
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

              {/* Quick Info */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Info Rapide
                </Title>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm">Min. giorni richiesti:</Text>
                    <Badge color="violet">200</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Settimane tipo:</Text>
                    <Badge color="gray">33-35</Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm">Festività nazionali:</Text>
                    <Badge color="red">12</Badge>
                  </Group>
                </Stack>
              </Card>

              {/* Related Tools */}
              <Card withBorder p="md">
                <Title order={4} mb="sm">
                  Strumenti Correlati
                </Title>
                <Stack gap="xs">
                  <Anchor component={Link} href="/it/tools/generatore-orario-settimanale" size="sm">
                    Generatore Orario
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/calcolatore-presenze" size="sm">
                    Calcolatore Presenze
                  </Anchor>
                  <Anchor component={Link} href="/it/tools/calcolatore-ore-corso" size="sm">
                    Calcolatore Ore Corso
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
