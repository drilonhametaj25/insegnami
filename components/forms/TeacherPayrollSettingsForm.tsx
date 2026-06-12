'use client';

import { useEffect } from 'react';
import {
  Card,
  Title,
  Text,
  Stack,
  Group,
  Button,
  Select,
  TextInput,
  NumberInput,
  Switch,
  Textarea,
  ActionIcon,
  Divider,
  Alert,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconAlertTriangle, IconDeviceFloppy } from '@tabler/icons-react';
import {
  useTeacherPayrollSettings,
  useSaveTeacherPayrollSettings,
  type TeacherPayrollSettings,
  type WithholdingType,
} from '@/lib/hooks/usePayroll';

type TaxRegime = TeacherPayrollSettings['taxRegime'];

const TAX_REGIME_OPTIONS: Array<{ value: TaxRegime; label: string }> = [
  { value: 'FORFETTARIO', label: 'Forfettario' },
  { value: 'ORDINARIO', label: 'Ordinario' },
  { value: 'DIPENDENTE', label: 'Dipendente' },
  { value: 'COCOCO', label: 'Co.co.co' },
  { value: 'OTHER', label: 'Altro' },
];

const WITHHOLDING_TYPE_OPTIONS: Array<{ value: WithholdingType; label: string }> = [
  { value: 'RITENUTA_ACCONTO', label: "Ritenuta d'acconto" },
  { value: 'INPS', label: 'INPS' },
  { value: 'INAIL', label: 'INAIL' },
  { value: 'OTHER', label: 'Altro' },
];

interface WithholdingRow {
  type: WithholdingType;
  rate: number | '';
  label: string;
  reducesBase: boolean;
}

interface SettingsFormData {
  taxRegime: TaxRegime;
  iban: string;
  defaultWithholdings: WithholdingRow[];
  notes: string;
}

interface TeacherPayrollSettingsFormProps {
  teacherId: string;
  /** Sola lettura (es. ruoli senza update payroll) */
  readOnly?: boolean;
}

/**
 * Tab "Compensi" del dettaglio docente: regime fiscale, IBAN e ritenute
 * di default applicate alla generazione dei cedolini (C3).
 */
export function TeacherPayrollSettingsForm({ teacherId, readOnly = false }: TeacherPayrollSettingsFormProps) {
  const { data, isLoading, error } = useTeacherPayrollSettings(teacherId);
  const saveSettings = useSaveTeacherPayrollSettings();

  const form = useForm<SettingsFormData>({
    initialValues: {
      taxRegime: 'ORDINARIO',
      iban: '',
      defaultWithholdings: [],
      notes: '',
    },
    validate: {
      iban: (value) => (value && value.length > 34 ? 'IBAN troppo lungo (max 34)' : null),
      defaultWithholdings: {
        label: (value) => (!value ? 'Etichetta richiesta' : null),
        rate: (value) =>
          value === '' || Number(value) < 0 || Number(value) > 100 ? 'Aliquota 0-100' : null,
      },
    },
  });

  // Popola il form quando le impostazioni arrivano dal server
  useEffect(() => {
    const settings = data?.settings;
    if (!settings) return;
    form.setValues({
      taxRegime: settings.taxRegime || 'ORDINARIO',
      iban: settings.iban || '',
      defaultWithholdings: (settings.defaultWithholdings || []).map((w) => ({
        type: w.type,
        rate: Number(w.rate ?? 0),
        label: w.label,
        reducesBase: !!w.reducesBase,
      })),
      notes: settings.notes || '',
    });
    form.resetDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.settings]);

  const handleSubmit = (values: SettingsFormData) => {
    saveSettings.mutate(
      {
        teacherId,
        data: {
          taxRegime: values.taxRegime,
          iban: values.iban || null,
          defaultWithholdings: values.defaultWithholdings.map((w) => ({
            type: w.type,
            rate: Number(w.rate || 0),
            label: w.label,
            reducesBase: w.reducesBase,
          })),
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Impostazioni compensi salvate',
            color: 'green',
          });
        },
        onError: (err: Error) => {
          notifications.show({
            title: 'Errore',
            message: err.message || 'Errore nel salvataggio delle impostazioni',
            color: 'red',
          });
        },
      },
    );
  };

  return (
    <Card withBorder radius="md" p="lg" pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={4} mb="xs">
        Impostazioni Compensi
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Regime fiscale, IBAN e ritenute applicate di default ai cedolini del docente.
      </Text>

      {error && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" mb="md">
          Errore nel caricamento delle impostazioni compensi
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Group grow align="flex-start">
            <Select
              label="Regime fiscale"
              data={TAX_REGIME_OPTIONS}
              disabled={readOnly}
              {...form.getInputProps('taxRegime')}
            />
            <TextInput
              label="IBAN"
              placeholder="IT60X0542811101000000123456"
              maxLength={34}
              disabled={readOnly}
              {...form.getInputProps('iban')}
            />
          </Group>

          <Divider />

          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm">
                Ritenute di default
              </Text>
              <Text size="xs" c="dimmed">
                Applicate automaticamente alla generazione dei cedolini
              </Text>
            </div>
            {!readOnly && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  form.insertListItem('defaultWithholdings', {
                    type: 'RITENUTA_ACCONTO',
                    rate: 20,
                    label: "Ritenuta d'acconto",
                    reducesBase: false,
                  } satisfies WithholdingRow)
                }
              >
                Aggiungi ritenuta
              </Button>
            )}
          </Group>

          {form.values.defaultWithholdings.length === 0 && (
            <Text size="sm" c="dimmed">
              Nessuna ritenuta di default configurata
            </Text>
          )}

          {form.values.defaultWithholdings.map((_, index) => (
            <Group key={index} align="flex-end" gap="xs" wrap="nowrap">
              <Select
                label="Tipo"
                data={WITHHOLDING_TYPE_OPTIONS}
                w={180}
                disabled={readOnly}
                {...form.getInputProps(`defaultWithholdings.${index}.type`)}
              />
              <NumberInput
                label="Aliquota %"
                w={110}
                min={0}
                max={100}
                step={0.5}
                disabled={readOnly}
                {...form.getInputProps(`defaultWithholdings.${index}.rate`)}
              />
              <TextInput
                label="Etichetta"
                placeholder="Es: Ritenuta d'acconto 20%"
                style={{ flex: 1 }}
                disabled={readOnly}
                {...form.getInputProps(`defaultWithholdings.${index}.label`)}
              />
              <Switch
                label="Riduce la base"
                mb={8}
                disabled={readOnly}
                {...form.getInputProps(`defaultWithholdings.${index}.reducesBase`, { type: 'checkbox' })}
              />
              {!readOnly && (
                <ActionIcon
                  color="red"
                  variant="light"
                  mb={4}
                  aria-label="Rimuovi ritenuta"
                  onClick={() => form.removeListItem('defaultWithholdings', index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              )}
            </Group>
          ))}

          <Textarea
            label="Note"
            placeholder="Note interne sui compensi del docente"
            autosize
            minRows={2}
            disabled={readOnly}
            {...form.getInputProps('notes')}
          />

          {!readOnly && (
            <Group justify="flex-end">
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saveSettings.isPending}
              >
                Salva impostazioni
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Card>
  );
}
