'use client';

import { useState } from 'react';
import {
  ActionIcon,
  Button,
  ColorInput,
  Group,
  List,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  VisuallyHidden,
  rem,
} from '@mantine/core';
import { IconCheck, IconPlus, IconTable, IconTrash } from '@tabler/icons-react';
import {
  RelatedToolsCard,
  ToolCtaCard,
  ToolFaq,
  ToolHero,
  ToolLayout,
  ToolSection,
  type FaqItem,
} from '@/components/public/ToolPageShell';

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
// Colori delle materie scelti dall'utente: dato funzionale, non brand.
const COLORS = [
  '#228be6', '#40c057', '#fab005', '#fa5252', '#7950f2',
  '#15aabf', '#fd7e14', '#e64980', '#12b886', '#be4bdb',
];

const relatedTools = [
  { slug: 'generatore-calendario-scolastico', title: 'Generatore Calendario Scolastico' },
  { slug: 'calcolatore-ore-corso', title: 'Calcolatore Ore Corso' },
];

export function GeneratoreOrarioClient({
  locale,
  faqs,
}: {
  locale: string;
  faqs: FaqItem[];
}) {
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

  // Matrice dell'orario per giorno
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

  return (
    <>
      <ToolHero
        locale={locale}
        icon={IconTable}
        title="Generatore Orario Settimanale"
        description="Crea l'orario delle lezioni settimanale"
      />

      <ToolLayout
        aside={
          <>
            <ToolCtaCard locale={locale} />
            <RelatedToolsCard locale={locale} tools={relatedTools} />
          </>
        }
      >
        {/* Configurazione */}
        <ToolSection>
          <Stack gap="lg">
            <Group justify="space-between">
              <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)">
                Configura le lezioni
              </Title>
              <TextInput
                placeholder="Nome classe"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                style={{ width: 200 }}
              />
            </Group>

            <Table.ScrollContainer minWidth={760}>
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
                    <Table.Th>
                      <VisuallyHidden>Azioni</VisuallyHidden>
                    </Table.Th>
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
                          aria-label="Elimina lezione"
                          onClick={() => removeSlot(slot.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Button
              variant="light"
              color="indigo"
              radius="xl"
              leftSection={<IconPlus size={18} />}
              onClick={addSlot}
            >
              Aggiungi lezione
            </Button>
          </Stack>
        </ToolSection>

        {/* Anteprima */}
        <ToolSection title={`Anteprima Orario - ${className}`}>
          <Table.ScrollContainer minWidth={820}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 100 }}>Orario</Table.Th>
                  {DAYS.map((day) => (
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
                      {DAYS.map((day) => {
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
                          return null; // Cella coperta dal rowSpan
                        }
                        return <Table.Td key={day}></Table.Td>;
                      })}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Group mt="lg" justify="center">
            <Text size="sm" c="dimmed">
              Totale ore settimanali: {slots.reduce((sum, s) => {
                const start = TIMES.indexOf(s.startTime);
                const end = TIMES.indexOf(s.endTime);
                return sum + (end - start) * 0.5;
              }, 0)} ore
            </Text>
          </Group>
        </ToolSection>

        {/* Cosa puoi fare con la piattaforma */}
        <ToolSection title="Gestisci gli Orari con InsegnaMi.pro">
          <Text c="dimmed" mb="md">
            Con InsegnaMi.pro puoi:
          </Text>
          <List
            spacing={8}
            size="sm"
            icon={
              <ThemeIcon size={20} radius="xl" variant="light" color="teal">
                <IconCheck size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>Creare orari per tutte le classi</List.Item>
            <List.Item>Verificare automaticamente i conflitti</List.Item>
            <List.Item>Esportare in PDF e sincronizzare con calendari</List.Item>
            <List.Item>Gestire sostituzioni e variazioni</List.Item>
            <List.Item>Notificare automaticamente docenti e studenti</List.Item>
          </List>
        </ToolSection>

        <ToolFaq items={faqs} />
      </ToolLayout>
    </>
  );
}
