'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
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
import { IconClock } from '@tabler/icons-react';
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

interface CourseResult {
  totalHours: number;
  totalLessons: number;
  weeksNeeded: number;
  lessonsPerWeek: number;
  endDate: Date;
  schedule: { week: number; lessons: number; cumulativeHours: number }[];
}

const presets = [
  { name: 'Corso base lingua', hours: 40, duration: 1.5, perWeek: 2 },
  { name: 'Corso intensivo', hours: 80, duration: 3, perWeek: 5 },
  { name: 'Lezioni private', hours: 20, duration: 1, perWeek: 1 },
  { name: 'Corso annuale musica', hours: 60, duration: 1, perWeek: 1 },
];

const relatedTools = [
  { slug: 'generatore-orario-settimanale', title: 'Generatore Orario' },
  { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario' },
  { slug: 'calcolatore-presenze', title: 'Calcolatore Presenze' },
];

export function CalcolatoreOreCorsoClient({
  locale,
  faqs,
}: {
  locale: string;
  faqs: FaqItem[];
}) {
  const [totalHours, setTotalHours] = useState<number | ''>(60);
  const [lessonDuration, setLessonDuration] = useState<number | ''>(2);
  const [lessonsPerWeek, setLessonsPerWeek] = useState<number | ''>(2);
  const [startDate, setStartDate] = useState<Date | null>(getDefaultSchoolYear().start);
  const [result, setResult] = useState<CourseResult | null>(null);

  const calculate = () => {
    if (!totalHours || !lessonDuration || !lessonsPerWeek || !startDate) {
      setResult(null);
      return;
    }

    const totalLessons = Math.ceil(totalHours / lessonDuration);
    const weeksNeeded = Math.ceil(totalLessons / lessonsPerWeek);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeksNeeded * 7);

    // Pianificazione settimanale
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
    setStartDate(getDefaultSchoolYear().start);
    setResult(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const applyPreset = (preset: (typeof presets)[0]) => {
    setTotalHours(preset.hours);
    setLessonDuration(preset.duration);
    setLessonsPerWeek(preset.perWeek);
  };

  return (
    <>
      <ToolHero
        locale={locale}
        icon={IconClock}
        title="Calcolatore Ore Corso"
        description="Pianifica le lezioni e calcola la durata del corso"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={locale} />

            <ToolInfoCard title="Durate Tipiche Corsi">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Lingua A1-A2:</Text>
                  <Badge variant="light" color="indigo">80-180h</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Lingua B1-B2:</Text>
                  <Badge variant="light" color="indigo">350-600h</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Musica base:</Text>
                  <Badge variant="light" color="indigo">30-40h</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Informatica:</Text>
                  <Badge variant="light" color="indigo">20-60h</Badge>
                </Group>
              </Stack>
            </ToolInfoCard>

            <RelatedToolsCard locale={locale} tools={relatedTools} />
          </>
        }
      >
        <ToolSection title="Configura il corso">
          <Stack gap="lg">
            {/* Preimpostazioni */}
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Preimpostazioni:
              </Text>
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="light"
                  color="indigo"
                  size="xs"
                  radius="xl"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </Button>
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
              <DateInput
                valueFormat="D MMMM YYYY"
                label="Data inizio corso"
                description="Prima lezione del corso"
                placeholder="Seleziona data"
                value={startDate}
                onChange={setStartDate}
                locale="it"
              />
            </SimpleGrid>

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
              <Button variant="default" radius="xl" size="lg" onClick={reset}>
                Reset
              </Button>
            </Group>

            {/* Risultato */}
            {result && (
              <Stack gap="lg">
                <Paper p="xl" radius="lg" bg="var(--pub-surface)">
                  <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed">
                        Ore Totali
                      </Text>
                      <Text size="xl" fw={700} c="var(--pub-ink)">
                        {result.totalHours}h
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed">
                        N° Lezioni
                      </Text>
                      <Text size="xl" fw={700} c="indigo.6">
                        {result.totalLessons}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed">
                        Settimane
                      </Text>
                      <Text size="xl" fw={700} c="var(--pub-ink)">
                        {result.weeksNeeded}
                      </Text>
                    </Stack>
                    <Stack align="center" gap={4}>
                      <Text size="sm" c="dimmed">
                        Fine Corso
                      </Text>
                      <Text size="xl" fw={700} c="var(--pub-ink)">
                        {formatDate(result.endDate)}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </Paper>

                <Divider />

                <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                  Pianificazione Settimanale
                </Title>
                <Table.ScrollContainer minWidth={560}>
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
                              variant="light"
                              color={
                                week.cumulativeHours >= (totalHours || 0)
                                  ? 'teal'
                                  : 'indigo'
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
                </Table.ScrollContainer>
              </Stack>
            )}
          </Stack>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
