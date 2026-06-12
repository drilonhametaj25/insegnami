'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import 'dayjs/locale/it';
import { IconAlertTriangle, IconCalendar, IconCheck } from '@tabler/icons-react';
import { PUB_GRADIENT } from '@/components/public/PublicUI';
import {
  RelatedToolsCard,
  ToolCtaCard,
  ToolFaq,
  ToolHero,
  ToolInfoCard,
  ToolLayout,
  ToolSection,
  getDefaultSchoolYear,
  type FaqItem,
} from '@/components/public/ToolPageShell';

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

// Festività nazionali italiane (date fisse)
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

// Calcolo della Pasqua (algoritmo Computus)
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

  // Festività nazionali
  nationalHolidays.forEach((h) => {
    const date = new Date(year, h.month, h.day);
    holidays.push({ date, name: h.name, type: 'national' });
  });

  // Pasqua e Lunedì dell'Angelo
  const easter = getEaster(year);
  holidays.push({ date: easter, name: 'Pasqua', type: 'national' });
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidays.push({ date: easterMonday, name: 'Lunedì dell\'Angelo', type: 'national' });

  // Vacanze di Natale (23 dic - 6 gen)
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

  // Vacanze di Pasqua (da 3 giorni prima al martedì successivo)
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

// Anno scolastico proposto di default (niente date hardcoded che invecchiano)
const DEFAULT_YEAR = getDefaultSchoolYear();

export function GeneratoreCalendarioClient({
  locale,
  faqs,
}: {
  locale?: string;
  faqs: FaqItem[];
}) {
  // Fallback sicuro su 'it' se il locale non arriva dal server
  const safeLocale = locale || 'it';

  const [startDate, setStartDate] = useState<Date | null>(() => new Date(DEFAULT_YEAR.start));
  const [endDate, setEndDate] = useState<Date | null>(() => new Date(DEFAULT_YEAR.end));
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

    // Festività di entrambi gli anni a cavallo
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      holidays.push(...getHolidaysForYear(year, includeChristmas, includeEaster));
    }

    // Solo festività comprese nel periodo
    const filteredHolidays = holidays.filter(
      (h) => h.date >= startDate && h.date <= endDate
    );

    // Conteggio dei giorni
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
        return dayOfWeek !== 0 && dayOfWeek !== 6; // Esclude festività nei weekend
      }),
      weekends,
    });
  };

  const reset = () => {
    setStartDate(new Date(DEFAULT_YEAR.start));
    setEndDate(new Date(DEFAULT_YEAR.end));
    setIncludeChristmas(true);
    setIncludeEaster(true);
    setResult(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <>
      <ToolHero
        locale={safeLocale}
        icon={IconCalendar}
        title="Generatore Calendario Scolastico"
        description="Genera un calendario con festività e giorni di scuola"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={safeLocale} />

            <ToolInfoCard title="Info Rapide">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Min. giorni richiesti:</Text>
                  <Badge variant="light" color="indigo">200</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Settimane tipo:</Text>
                  <Badge variant="light" color="indigo">33-35</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Festività nazionali:</Text>
                  <Badge variant="light" color="indigo">12</Badge>
                </Group>
              </Stack>
            </ToolInfoCard>

            <RelatedToolsCard
              locale={safeLocale}
              tools={[
                { slug: 'generatore-orario-settimanale', title: 'Generatore Orario' },
                { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
                { slug: 'calcolatore-ore-corso', title: 'Calcolatore Ore Corso' },
              ]}
            />
          </>
        }
      >
        <ToolSection title="Configura il calendario">
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <DateInput
                valueFormat="D MMMM YYYY"
                label="Inizio anno scolastico"
                placeholder="Seleziona data"
                value={startDate}
                onChange={setStartDate}
                locale="it"
              />
              <DateInput
                valueFormat="D MMMM YYYY"
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
              <Button
                onClick={generate}
                size="lg"
                radius="xl"
                variant="gradient"
                gradient={PUB_GRADIENT}
                fw={700}
              >
                Genera Calendario
              </Button>
              <Button variant="default" radius="xl" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato */}
            {result && (
              <Stack gap="lg">
                <Paper p="xl" radius="lg" withBorder bg="var(--pub-surface)">
                  <Stack align="center" gap={4} mb="lg">
                    <Text size="sm" c="dimmed">
                      Giorni di Scuola
                    </Text>
                    <Text fz={rem(48)} fw={900} lh={1} c="var(--pub-ink)">
                      {result.schoolDays}
                    </Text>
                  </Stack>
                  <SimpleGrid cols={3} spacing="md">
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Giorni Totali
                      </Text>
                      <Text fz={rem(22)} fw={700} c="var(--pub-ink)">
                        {result.totalDays}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Weekend
                      </Text>
                      <Text fz={rem(22)} fw={700} c="var(--pub-ink)">
                        {result.weekends}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed" ta="center">
                        Festività
                      </Text>
                      <Text fz={rem(22)} fw={700} c="var(--pub-ink)">
                        {result.holidays.length}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </Paper>

                <Badge
                  variant="light"
                  color={result.schoolDays >= 200 ? 'teal' : 'red'}
                  size="lg"
                  leftSection={
                    result.schoolDays >= 200 ? (
                      <IconCheck size={14} />
                    ) : (
                      <IconAlertTriangle size={14} />
                    )
                  }
                >
                  {result.schoolDays >= 200
                    ? `Requisito 200 giorni raggiunto (${result.schoolDays} giorni)`
                    : `Sotto il minimo di 200 giorni (${result.schoolDays} giorni)`}
                </Badge>

                <Divider />

                <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                  Festività e Vacanze
                </Title>
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
                            variant="light"
                            color={holiday.type === 'national' ? 'indigo' : 'violet'}
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
              </Stack>
            )}
          </Stack>
        </ToolSection>

        <ToolSection title="Come Funziona">
          <Text mb="md">
            Il generatore conta tutti i giorni compresi tra l&apos;inizio e la fine
            dell&apos;anno scolastico e sottrae i weekend e le festività nazionali, più le
            vacanze di Natale e Pasqua se selezionate.
          </Text>
          <Text>
            Il risultato è il numero di giorni di lezione effettivi: la normativa italiana
            prevede un minimo di 200 giorni di scuola per la validità dell&apos;anno
            scolastico.
          </Text>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
