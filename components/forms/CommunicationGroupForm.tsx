'use client';

import {
  TextInput,
  Textarea,
  MultiSelect,
  Button,
  Group,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useCreateCommunicationGroup } from '@/lib/hooks/useMessages';

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
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CommunicationGroupForm({ users, onSuccess, onCancel }: CommunicationGroupFormProps) {
  const createGroup = useCreateCommunicationGroup();

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

  const memberOptions = users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
  }));

  const handleSubmit = async (values: CommunicationGroupFormValues) => {
    try {
      await createGroup.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        memberIds: values.memberIds,
      });
      notifications.show({
        title: 'Gruppo creato',
        message: `Il gruppo "${values.name.trim()}" è stato creato con successo`,
        color: 'green',
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Impossibile creare il gruppo',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
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
            <Button variant="default" onClick={onCancel} disabled={createGroup.isPending}>
              Annulla
            </Button>
          )}
          <Button type="submit" loading={createGroup.isPending}>
            Crea Gruppo
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
