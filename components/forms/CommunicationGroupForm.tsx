'use client';

import { useEffect, useState } from 'react';
import {
  TextInput,
  Textarea,
  MultiSelect,
  Button,
  Group,
  Stack,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  useCreateCommunicationGroup,
  useUpdateCommunicationGroup,
} from '@/lib/hooks/useMessages';

export interface GroupMemberOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CommunicationGroupFormValues {
  name: string;
  description: string;
  memberIds: string[];
}

interface CommunicationGroupFormProps {
  /** Utenti del tenant selezionabili come membri del gruppo */
  users: GroupMemberOption[];
  /** Gruppo custom esistente → modalità modifica (PUT) */
  groupId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CommunicationGroupForm({ users, groupId, onSuccess, onCancel }: CommunicationGroupFormProps) {
  const createGroup = useCreateCommunicationGroup();
  const updateGroup = useUpdateCommunicationGroup();
  const isPending = createGroup.isPending || updateGroup.isPending;
  const [loadingGroup, setLoadingGroup] = useState(false);

  const form = useForm<CommunicationGroupFormValues>({
    initialValues: {
      name: '',
      description: '',
      memberIds: [],
    },
    validate: {
      // Allineato allo zod schema dell'API (name min 2, memberIds min 1)
      name: (value) => (value.trim().length < 2 ? 'Il nome deve avere almeno 2 caratteri' : null),
      memberIds: (value) => (value.length === 0 ? 'Seleziona almeno un membro' : null),
    },
  });

  // In modifica: prefill da GET /api/messages/groups/[id]
  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;
    setLoadingGroup(true);
    (async () => {
      try {
        const response = await fetch(`/api/messages/groups/${groupId}`);
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.group) {
            form.setValues({
              name: data.group.name || '',
              description: data.group.description || '',
              memberIds: data.group.memberIds || [],
            });
          }
        }
      } catch (error) {
        console.error('Error fetching group:', error);
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const memberOptions = users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
  }));

  const handleSubmit = async (values: CommunicationGroupFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        memberIds: values.memberIds,
      };

      if (groupId) {
        await updateGroup.mutateAsync({ id: groupId, ...payload });
      } else {
        await createGroup.mutateAsync(payload);
      }
      notifications.show({
        title: groupId ? 'Gruppo aggiornato' : 'Gruppo creato',
        message: `Il gruppo "${values.name.trim()}" è stato ${groupId ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Impossibile salvare il gruppo',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} style={{ position: 'relative' }}>
      <LoadingOverlay visible={loadingGroup} />
      <Stack gap="md">
        <TextInput
          label="Nome"
          placeholder="Es. Genitori gita scolastica"
          withAsterisk
          {...form.getInputProps('name')}
        />

        <Textarea
          label="Descrizione"
          placeholder="Descrizione del gruppo (opzionale)"
          minRows={2}
          {...form.getInputProps('description')}
        />

        <MultiSelect
          label="Membri"
          placeholder="Seleziona i membri del gruppo"
          data={memberOptions}
          searchable
          clearable
          withAsterisk
          {...form.getInputProps('memberIds')}
        />

        <Group justify="flex-end" mt="md">
          {onCancel && (
            <Button variant="default" onClick={onCancel} disabled={isPending}>
              Annulla
            </Button>
          )}
          <Button type="submit" loading={isPending} data-testid="comunicazione-gruppo-salva">
            {groupId ? 'Aggiorna Gruppo' : 'Crea Gruppo'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
