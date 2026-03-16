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
  TextInput,
  Button,
  Paper,
  ThemeIcon,
  Box,
  Anchor,
  Accordion,
  SimpleGrid,
  Select,
  Table,
  ActionIcon,
  ColorInput,
} from '@mantine/core';
import { IconTable, IconArrowLeft, IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';

interface ScheduleSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  color: string;
}

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const TIMES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];
const COLORS = [
  '#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2',
  '#15aabf', '#fd7e14', '#e64980', '#12b886', '#be4bdb',
];

export default function GeneratoreOrarioPage() {
  const locale = useLocale();
  const [slots, setSlots] = useState<ScheduleSlot[]>([
    { id: '1', day: 'Lunedì', startTime: '09:00', endTime: '10:00', subject: 'Matematica', teacher: '', room: 'Aula 1', color: COLORS[0] },
    { id: '2', day: 'Lunedì', startTime: '10:00', endTime: '11:00', subject: 'Italiano', teacher: '', room: 'Aula 1', color: COLORS[1] },
    { id: '3', day: 'Martedì', startTime: '09:00', endTime: '10:00', subject: 'Inglese', teacher: '', room: 'Aula 1', color: COLORS[2] },
  ]);
  const [className, setClassName] = useState('Classe 1A');

  const addSlot = () => {
    setSlots([
      ...slots,
      {
        id: Date.now().toString(),
        day: 'Lunedì',
        startTime: '09:00',
        endTime: '10:00',
        subject: '',
        teacher: '',
        room: '',
        color: COLORS[slots.length % COLORS.length],
      },
    ]);
  };

  const removeSlot = (id: string) => {
    setSlots(slots.filter((s) => s.id !== id));
  };

  const updateSlot = (id: string, field: keyof ScheduleSlot, value: string) => {
    setSlots(
      slots.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  // Get schedule matrix
  const getScheduleMatrix = () => {
    const matrix: { [day: string]: ScheduleSlot[] } = {};
    DAYS.forEach((day) => {
      matrix[day] = slots
        .filter((s) => s.day === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return matrix;
  };

  const matrix = getScheduleMatrix();

  const faqs = [
    {
      question: 'Come creo un orario efficace?',
      answer:
        'Per un orario efficace, alterna materie teoriche e pratiche, evita di mettere le materie più impegnative dopo pranzo, considera le esigenze dei docenti e degli spazi. Prevedi pause adeguate tra le lezioni.',
    },
    {
      question: 'Posso esportare l\'orario?',
      answer:
        'Questo strumento gratuito genera una visualizzazione dell\'orario. Per funzionalità avanzate come esportazione PDF, sincronizzazione con calendari e notifiche automatiche, usa InsegnaMi.pro.',
    },
    {
      question: 'Come gestisco i conflitti di orario?',
      answer:
        'Un conflitto si verifica quando lo stesso docente o aula è assegnato a più lezioni nello stesso orario. Questo strumento non verifica automaticamente i conflitti - InsegnaMi.pro include la verifica automatica.',
    },
    {
      question: 'Quante ore settimanali sono tipiche?',
      answer:
        'Nella scuola italiana: primaria 24-27 ore, secondaria I grado 30 ore, secondaria II grado 27-35 ore. Le scuole private possono avere orari personalizzati in base al programma.',
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-cyan-6) 0%, var(--mantine-color-teal-5) 100%)',
          color: 'white',
          padding: '3rem 0',
        }}
      >
        <Container size="xl">
          <Stack gap="md">
            <Anchor component={Link} href={`/${locale}/tools`} c="white" size="sm">
              <Group gap={4}>
                <IconArrowLeft size={16} />
                Tutti gli strumenti
              </Group>
            </Anchor>
            <Group gap="lg" align="center">
              <ThemeIcon size={60} radius="xl" variant="white" color="cyan">
                <IconTable size={30} />
              </ThemeIcon>
              <div>
                <Title order={1}>Generatore Orario Settimanale</Title>
                <Text size="lg" mt="xs">
                  Crea l&apos;orario delle lezioni settimanale
                </Text>
              </div>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Configuration */}
          <Card withBorder shadow="sm" radius="md" p="xl">
            <Stack gap="lg">
              <Group justify="space-between">
                <Title order={2} size="h3">
                  Configura le lezioni
                </Title>
                <TextInput
                  placeholder="Nome classe"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  style={{ width: 200 }}
                />
              </Group>

              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Giorno</Table.Th>
                    <Table.Th>Inizio</Table.Th>
                    <Table.Th>Fine</Table.Th>
                    <Table.Th>Materia</Table.Th>
                    <Table.Th>Docente</Table.Th>
                    <Table.Th>Aula</Table.Th>
                    <Table.Th>Colore</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {slots.map((slot) => (
                    <Table.Tr key={slot.id}>
                      <Table.Td>
                        <Select
                          data={DAYS}
                          value={slot.day}
                          onChange={(val) => updateSlot(slot.id, 'day', val || 'Lunedì')}
                          size="xs"
                          style={{ width: 110 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          data={TIMES}
                          value={slot.startTime}
                          onChange={(val) => updateSlot(slot.id, 'startTime', val || '09:00')}
                          size="xs"
                          style={{ width: 80 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Select
                          data={TIMES}
                          value={slot.endTime}
                          onChange={(val) => updateSlot(slot.id, 'endTime', val || '10:00')}
                          size="xs"
                          style={{ width: 80 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Materia"
                          value={slot.subject}
                          onChange={(e) => updateSlot(slot.id, 'subject', e.target.value)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Docente"
                          value={slot.teacher}
                          onChange={(e) => updateSlot(slot.id, 'teacher', e.target.value)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          placeholder="Aula"
                          value={slot.room}
                          onChange={(e) => updateSlot(slot.id, 'room', e.target.value)}
                          size="xs"
                          style={{ width: 80 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ColorInput
                          value={slot.color}
                          onChange={(val) => updateSlot(slot.id, 'color', val)}
                          size="xs"
                          swatches={COLORS}
                          style={{ width: 80 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => removeSlot(slot.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Button
                variant="light"
                leftSection={<IconPlus size={18} />}
                onClick={addSlot}
                color="cyan"
              >
                Aggiungi lezione
              </Button>
            </Stack>
          </Card>

          {/* Schedule Preview */}
          <Card withBorder shadow="sm" radius="md" p="xl">
            <Title order={2} size="h3" mb="lg">
              Anteprima Orario - {className}
            </Title>

            <Box style={{ overflowX: 'auto' }}>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 100 }}>Orario</Table.Th>
                    {DAYS.slice(0, 6).map((day) => (
                      <Table.Th key={day} style={{ textAlign: 'center', minWidth: 120 }}>
                        {day}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {TIMES.slice(0, -1).map((time, idx) => {
                    const nextTime = TIMES[idx + 1];
                    return (
                      <Table.Tr key={time}>
                        <Table.Td style={{ fontWeight: 500, fontSize: '12px' }}>
                          {time} - {nextTime}
                        </Table.Td>
                        {DAYS.slice(0, 6).map((day) => {
                          const slot = matrix[day]?.find(
                            (s) => s.startTime <= time && s.endTime > time
                          );
                          if (slot && slot.startTime === time) {
                            const duration =
                              TIMES.indexOf(slot.endTime) - TIMES.indexOf(slot.startTime);
                            return (
                              <Table.Td
                                key={day}
                                rowSpan={duration}
                                style={{
                                  backgroundColor: slot.color + '20',
                                  borderLeft: `4px solid ${slot.color}`,
                                  verticalAlign: 'top',
                                  padding: '8px',
                                }}
                              >
                                <Text size="sm" fw={600}>
                                  {slot.subject}
                                </Text>
                                {slot.teacher && (
                                  <Text size="xs" c="dimmed">
                                    {slot.teacher}
                                  </Text>
                                )}
                                {slot.room && (
                                  <Text size="xs" c="dimmed">
                                    {slot.room}
                                  </Text>
                                )}
                              </Table.Td>
                            );
                          } else if (
                            slot &&
                            slot.startTime < time &&
                            slot.endTime > time
                          ) {
                            return null; // Cell is covered by rowSpan
                          }
                          return <Table.Td key={day}></Table.Td>;
                        })}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>

            <Group mt="lg" justify="center">
              <Text size="sm" c="dimmed">
                Totale ore settimanali: {slots.reduce((sum, s) => {
                  const start = TIMES.indexOf(s.startTime);
                  const end = TIMES.indexOf(s.endTime);
                  return sum + (end - start) * 0.5;
                }, 0)} ore
              </Text>
            </Group>
          </Card>

          {/* CTA */}
          <Card withBorder p="xl" radius="md" bg="cyan.0">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
              <Stack gap="md">
                <Title order={3}>
                  Gestisci gli Orari con InsegnaMi.pro
                </Title>
                <Text c="dimmed">
                  Con InsegnaMi.pro puoi:
                </Text>
                <Stack gap="xs">
                  <Text size="sm">✓ Creare orari per tutte le classi</Text>
                  <Text size="sm">✓ Verificare automaticamente i conflitti</Text>
                  <Text size="sm">✓ Esportare in PDF e sincronizzare con calendari</Text>
                  <Text size="sm">✓ Gestire sostituzioni e variazioni</Text>
                  <Text size="sm">✓ Notificare automaticamente docenti e studenti</Text>
                </Stack>
              </Stack>
              <Stack align="center" justify="center" gap="md">
                <Anchor
                  component={Link}
                  href="/auth/register"
                  style={{
                    backgroundColor: 'var(--mantine-color-cyan-6)',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Prova Gratis 14 Giorni
                </Anchor>
                <Text size="xs" c="dimmed">
                  Nessuna carta di credito richiesta
                </Text>
              </Stack>
            </SimpleGrid>
          </Card>

          {/* FAQ */}
          <Card withBorder shadow="sm" radius="md" p="xl">
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
        </Stack>
      </Container>
    </>
  );
}
