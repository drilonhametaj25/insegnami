'use client';

import { useState } from 'react';
import { Modal, Radio, Stack, Group, Button, Text } from '@mantine/core';

export type RecurringScope = 'single' | 'series' | 'future';

interface RecurringScopeModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurringScope) => void;
  loading?: boolean;
  title?: string;
}

/**
 * Modal per scegliere lo scope di modifica di una lezione ricorrente:
 * solo questa occorrenza, tutta la serie o da questa occorrenza in avanti.
 */
export function RecurringScopeModal({
  opened,
  onClose,
  onConfirm,
  loading = false,
  title = 'Modifica lezione ricorrente',
}: RecurringScopeModalProps) {
  const [scope, setScope] = useState<RecurringScope>('single');

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Questa lezione fa parte di una serie ricorrente. A quali lezioni vuoi
          applicare le modifiche?
        </Text>

        <Radio.Group
          value={scope}
          onChange={(value) => setScope(value as RecurringScope)}
        >
          <Stack gap="sm">
            <Radio
              value="single"
              label="Solo questa lezione"
              description="Le altre lezioni della serie non vengono modificate"
            />
            <Radio
              value="series"
              label="Tutta la serie"
              description="Tutte le lezioni della serie (escluse completate e annullate)"
            />
            <Radio
              value="future"
              label="Da qui in avanti"
              description="Questa lezione e tutte le successive della serie"
            />
          </Stack>
        </Radio.Group>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={loading}>
            Annulla
          </Button>
          <Button loading={loading} onClick={() => onConfirm(scope)}>
            Conferma
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
