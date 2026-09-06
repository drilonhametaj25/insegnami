'use client';

import {
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  useCreateMessageTemplate,
  useUpdateMessageTemplate,
  type MessageTemplate,
} from '@/lib/hooks/useMessages';

export interface MessageTemplateFormValues {
  name: string;
  description: string;
  subject: string;
  content: string;
  type: string;
}

// Tipi supportati dallo schema dell'API (app/api/messages/templates/route.ts)
const TEMPLATE_TYPES = [
  { value: 'MESSAGE', label: 'Messaggio' },
  { value: 'ANNOUNCEMENT', label: 'Annuncio' },
  { value: 'EVENT', label: 'Evento' },
  { value: 'REMINDER', label: 'Promemoria' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'NEWSLETTER', label: 'Newsletter' },
];

interface MessageTemplateFormProps {
  /** Template esistente → modalità modifica (PUT) */
  template?: MessageTemplate;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MessageTemplateForm({ template, onSuccess, onCancel }: MessageTemplateFormProps) {
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const isPending = createTemplate.isPending || updateTemplate.isPending;

  const form = useForm<MessageTemplateFormValues>({
    initialValues: {
      name: template?.name || '',
      description: template?.description || '',
      subject: template?.subject || '',
      content: template?.content || '',
      type: template?.type || 'MESSAGE',
    },
    validate: {
      name: (value) => (!value.trim() ? 'Nome richiesto' : null),
      subject: (value) => (!value.trim() ? 'Oggetto richiesto' : null),
      content: (value) => (!value.trim() ? 'Contenuto richiesto' : null),
    },
  });

  const handleSubmit = async (values: MessageTemplateFormValues) => {
    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        subject: values.subject.trim(),
        content: values.content,
        type: values.type,
      };

      if (template) {
        await updateTemplate.mutateAsync({ id: template.id, ...payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }
      notifications.show({
        title: template ? 'Template aggiornato' : 'Template creato',
        message: `Il template "${values.name.trim()}" è stato ${template ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onSuccess?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Impossibile salvare il template',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Nome"
          placeholder="Es. Promemoria lezione"
          withAsterisk
          {...form.getInputProps('name')}
        />

        <TextInput
          label="Descrizione"
          placeholder="Breve descrizione del template (opzionale)"
          {...form.getInputProps('description')}
        />

        <Select
          label="Tipo"
          data={TEMPLATE_TYPES}
          allowDeselect={false}
          {...form.getInputProps('type')}
        />

        <TextInput
          label="Oggetto"
          placeholder="Oggetto del messaggio"
          withAsterisk
          {...form.getInputProps('subject')}
        />

        <Textarea
          label="Contenuto"
          placeholder="Testo del messaggio..."
          description={'Puoi usare segnaposto come {{nome}} o {{lessonTitle}}: verranno sostituiti al momento dell\'invio'}
          minRows={5}
          withAsterisk
          {...form.getInputProps('content')}
        />

        <Group justify="flex-end" mt="md">
          {onCancel && (
            <Button variant="default" onClick={onCancel} disabled={isPending}>
              Annulla
            </Button>
          )}
          <Button type="submit" loading={isPending} data-testid="comunicazione-template-salva">
            {template ? 'Aggiorna Template' : 'Crea Template'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
