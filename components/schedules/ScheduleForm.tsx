'use client';

import { useState } from 'react';
import {
  TextInput,
  Select,
  Button,
  Stack,
  Group,
  Text,
  Slider,
  Paper,
  Accordion,
  Switch,
  NumberInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconSettings, IconBrain } from '@tabler/icons-react';
import '@mantine/dates/styles.css';

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface ScheduleFormProps {
  academicYears: AcademicYear[];
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ScheduleForm({
  academicYears,
  initialData,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    academicYearId: initialData?.academicYearId || '',
    startDate: initialData?.startDate ? new Date(initialData.startDate) : null,
    endDate: initialData?.endDate ? new Date(initialData.endDate) : null,
    config: {
      hardConstraints: {
        noTeacherOverlap: initialData?.config?.hardConstraints?.noTeacherOverlap ?? true,
        noClassOverlap: initialData?.config?.hardConstraints?.noClassOverlap ?? true,
        noRoomOverlap: initialData?.config?.hardConstraints?.noRoomOverlap ?? true,
        respectWeeklyHours: initialData?.config?.hardConstraints?.respectWeeklyHours ?? true,
      },
      softConstraints: {
        difficultSubjectsInMorning: initialData?.config?.softConstraints?.difficultSubjectsInMorning ?? 8,
        noGaps: initialData?.config?.softConstraints?.noGaps ?? 7,
        balancedDistribution: initialData?.config?.softConstraints?.balancedDistribution ?? 6,
        maxConsecutiveSameSubject: initialData?.config?.softConstraints?.maxConsecutiveSameSubject ?? 5,
        lunchBreakPreference: initialData?.config?.softConstraints?.lunchBreakPreference ?? 4,
        teacherLoadBalance: initialData?.config?.softConstraints?.teacherLoadBalance ?? 3,
      },
      algorithmParams: {
        maxIterations: initialData?.config?.algorithmParams?.maxIterations ?? 100000,
        optimizationRounds: initialData?.config?.algorithmParams?.optimizationRounds ?? 1000,
        timeout: initialData?.config?.algorithmParams?.timeout ?? 30000,
      },
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        ...formData,
        startDate: formData.startDate?.toISOString(),
        endDate: formData.endDate?.toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSoftConstraint = (key: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        softConstraints: {
          ...prev.config.softConstraints,
          [key]: value,
        },
      },
    }));
  };

  const updateHardConstraint = (key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        hardConstraints: {
          ...prev.config.hardConstraints,
          [key]: value,
        },
      },
    }));
  };

  // Set dates based on academic year selection
  const handleAcademicYearChange = (value: string | null) => {
    setFormData((prev) => ({ ...prev, academicYearId: value || '' }));

    const year = academicYears.find((y) => y.id === value);
    if (year) {
      setFormData((prev) => ({
        ...prev,
        academicYearId: value || '',
        startDate: new Date(year.startDate),
        endDate: new Date(year.endDate),
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {/* Basic Info */}
        <TextInput
          label="Nome Orario"
          placeholder="es. Orario Primo Quadrimestre 2024/25"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />

        <Select
          label="Anno Accademico"
          placeholder="Seleziona anno accademico"
          data={academicYears.map((y) => ({
            value: y.id,
            label: y.name + (y.isCurrent ? ' (Corrente)' : ''),
          }))}
          value={formData.academicYearId}
          onChange={handleAcademicYearChange}
          required
        />

        <Group grow>
          <DatePickerInput
            label="Data Inizio"
            placeholder="Seleziona data"
            value={formData.startDate}
            onChange={(date) => setFormData((prev) => ({ ...prev, startDate: date }))}
            leftSection={<IconCalendar size={16} />}
            required
          />
          <DatePickerInput
            label="Data Fine"
            placeholder="Seleziona data"
            value={formData.endDate}
            onChange={(date) => setFormData((prev) => ({ ...prev, endDate: date }))}
            leftSection={<IconCalendar size={16} />}
            required
          />
        </Group>

        {/* Advanced Settings */}
        <Accordion variant="contained" radius="md">
          <Accordion.Item value="hard-constraints">
            <Accordion.Control icon={<IconSettings size={20} />}>
              Vincoli Obbligatori
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Questi vincoli devono essere sempre rispettati.
                  Un orario che li viola è considerato non valido.
                </Text>

                <Switch
                  label="Nessuna sovrapposizione insegnante"
                  description="Un insegnante non può essere in due posti contemporaneamente"
                  checked={formData.config.hardConstraints.noTeacherOverlap}
                  onChange={(e) => updateHardConstraint('noTeacherOverlap', e.target.checked)}
                />

                <Switch
                  label="Nessuna sovrapposizione classe"
                  description="Una classe non può avere due lezioni contemporaneamente"
                  checked={formData.config.hardConstraints.noClassOverlap}
                  onChange={(e) => updateHardConstraint('noClassOverlap', e.target.checked)}
                />

                <Switch
                  label="Nessuna sovrapposizione aula"
                  description="Un'aula non può ospitare due lezioni contemporaneamente"
                  checked={formData.config.hardConstraints.noRoomOverlap}
                  onChange={(e) => updateHardConstraint('noRoomOverlap', e.target.checked)}
                />

                <Switch
                  label="Rispetta ore settimanali"
                  description="Ogni materia deve avere esattamente le ore previste"
                  checked={formData.config.hardConstraints.respectWeeklyHours}
                  onChange={(e) => updateHardConstraint('respectWeeklyHours', e.target.checked)}
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="soft-constraints">
            <Accordion.Control icon={<IconBrain size={20} />}>
              Preferenze (Soft Constraints)
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="lg">
                <Text size="sm" c="dimmed">
                  Regola l'importanza di ogni preferenza (0 = disabilitato, 10 = massima priorità).
                  L'algoritmo cercherà di rispettare queste preferenze dove possibile.
                </Text>

                <Paper withBorder p="sm" radius="md">
                  <Text size="sm" fw={500} mb="xs">
                    Materie difficili al mattino
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Matematica, Fisica, Latino nelle prime 3 ore
                  </Text>
                  <Slider
                    value={formData.config.softConstraints.difficultSubjectsInMorning}
                    onChange={(v) => updateSoftConstraint('difficultSubjectsInMorning', v)}
                    min={0}
                    max={10}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                    ]}
                  />
                </Paper>

                <Paper withBorder p="sm" radius="md">
                  <Text size="sm" fw={500} mb="xs">
                    Evita buchi nell'orario
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Nessuna ora vuota tra le lezioni di una classe
                  </Text>
                  <Slider
                    value={formData.config.softConstraints.noGaps}
                    onChange={(v) => updateSoftConstraint('noGaps', v)}
                    min={0}
                    max={10}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                    ]}
                  />
                </Paper>

                <Paper withBorder p="sm" radius="md">
                  <Text size="sm" fw={500} mb="xs">
                    Distribuzione equilibrata
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Evita troppe ore della stessa materia nello stesso giorno
                  </Text>
                  <Slider
                    value={formData.config.softConstraints.balancedDistribution}
                    onChange={(v) => updateSoftConstraint('balancedDistribution', v)}
                    min={0}
                    max={10}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                    ]}
                  />
                </Paper>

                <Paper withBorder p="sm" radius="md">
                  <Text size="sm" fw={500} mb="xs">
                    Max ore consecutive stessa materia
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Evita 3+ ore consecutive della stessa materia
                  </Text>
                  <Slider
                    value={formData.config.softConstraints.maxConsecutiveSameSubject}
                    onChange={(v) => updateSoftConstraint('maxConsecutiveSameSubject', v)}
                    min={0}
                    max={10}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                    ]}
                  />
                </Paper>

                <Paper withBorder p="sm" radius="md">
                  <Text size="sm" fw={500} mb="xs">
                    Bilanciamento carico insegnante
                  </Text>
                  <Text size="xs" c="dimmed" mb="sm">
                    Distribuisci equamente le ore dell'insegnante nella settimana
                  </Text>
                  <Slider
                    value={formData.config.softConstraints.teacherLoadBalance}
                    onChange={(v) => updateSoftConstraint('teacherLoadBalance', v)}
                    min={0}
                    max={10}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                    ]}
                  />
                </Paper>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" loading={loading}>
            {initialData ? 'Salva Modifiche' : 'Crea Orario'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
