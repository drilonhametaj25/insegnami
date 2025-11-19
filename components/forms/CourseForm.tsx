'use client';

import { useState } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  NumberInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface Course {
  id?: string;
  name: string;
  code?: string;
  description?: string;
  category: string;
  level: string;
  duration?: number;
  maxStudents?: number;
  minStudents?: number;
  price?: number;
  isActive: boolean;
}

interface CourseFormProps {
  opened: boolean;
  onClose: () => void;
  courseData?: Course;
  onSave: (courseData: Course) => Promise<void>;
  loading?: boolean;
}

export function CourseForm({
  opened,
  onClose,
  courseData,
  onSave,
  loading = false,
}: CourseFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Course>({
    initialValues: {
      name: courseData?.name || '',
      code: courseData?.code || '',
      description: courseData?.description || '',
      category: courseData?.category || 'General',
      level: courseData?.level || 'A1',
      duration: courseData?.duration || 60,
      maxStudents: courseData?.maxStudents || 20,
      minStudents: courseData?.minStudents || 5,
      price: courseData?.price || 0,
      isActive: courseData?.isActive ?? true,
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome corso troppo corto' : null),
      code: (value) => {
        if (!value) return null; // Il codice è opzionale, verrà generato dal server
        if (value.length < 2) return 'Codice troppo corto';
        if (!/^[A-Z0-9-]+$/i.test(value)) return 'Usa solo lettere, numeri e trattini';
        return null;
      },
      category: (value) => (!value ? 'Seleziona una categoria' : null),
      level: (value) => (!value ? 'Seleziona un livello' : null),
      duration: (value) => {
        if (!value) return null;
        if (value < 30) return 'Durata minima: 30 minuti';
        if (value > 480) return 'Durata massima: 8 ore';
        return null;
      },
      maxStudents: (value) => {
        if (!value) return null;
        if (value < 1) return 'Minimo 1 studente';
        if (value > 100) return 'Massimo 100 studenti';
        return null;
      },
      minStudents: (value) => {
        if (!value) return null;
        if (value < 1) return 'Minimo 1 studente';
        return null;
      },
      price: (value) => {
        if (value !== undefined && value < 0) return 'Il prezzo non può essere negativo';
        return null;
      },
    },
  });

  const handleSubmit = async (values: Course) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
      notifications.show({
        title: 'Successo',
        message: `Corso ${courseData ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${courseData ? 'l\'aggiornamento' : 'la creazione'} del corso`,
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const categoryOptions = [
    { value: 'General', label: 'Generale' },
    { value: 'Business', label: 'Business' },
    { value: 'Academic', label: 'Accademico' },
    { value: 'Kids', label: 'Bambini' },
    { value: 'Teens', label: 'Adolescenti' },
    { value: 'Adults', label: 'Adulti' },
    { value: 'Exam Preparation', label: 'Preparazione Esami' },
    { value: 'Conversation', label: 'Conversazione' },
    { value: 'Grammar', label: 'Grammatica' },
    { value: 'Other', label: 'Altro' },
  ];

  const levelOptions = [
    { value: 'A1', label: 'A1 - Principiante' },
    { value: 'A2', label: 'A2 - Elementare' },
    { value: 'B1', label: 'B1 - Intermedio' },
    { value: 'B2', label: 'B2 - Intermedio Superiore' },
    { value: 'C1', label: 'C1 - Avanzato' },
    { value: 'C2', label: 'C2 - Padronanza' },
    { value: 'Mixed', label: 'Livello Misto' },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={courseData ? 'Modifica Corso' : 'Nuovo Corso'}
      size="xl"
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      styles={{
        content: {
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '20px',
        },
        header: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px 20px 0 0',
          color: 'white',
          borderBottom: 'none',
        },
        title: {
          color: 'white',
          fontWeight: 600,
        },
        close: {
          color: 'white',
        },
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Informazioni Base */}
          <TextInput
            label="Nome Corso"
            placeholder="Es. English for Beginners"
            required
            {...form.getInputProps('name')}
          />

          <TextInput
            label="Codice Corso (Opzionale)"
            placeholder="Es. ENG-A1-01"
            description="Se lasciato vuoto, verrà generato automaticamente"
            {...form.getInputProps('code')}
          />

          <Textarea
            label="Descrizione"
            placeholder="Descrizione dettagliata del corso..."
            minRows={3}
            {...form.getInputProps('description')}
          />

          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Categoria"
                placeholder="Seleziona categoria"
                required
                searchable
                data={categoryOptions}
                {...form.getInputProps('category')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Livello"
                placeholder="Seleziona livello"
                required
                data={levelOptions}
                {...form.getInputProps('level')}
              />
            </Grid.Col>
          </Grid>

          {/* Dettagli Corso */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Dettagli Corso
            </h4>
            <Grid>
              <Grid.Col span={4}>
                <NumberInput
                  label="Durata (minuti)"
                  placeholder="60"
                  min={30}
                  max={480}
                  step={15}
                  {...form.getInputProps('duration')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Min Studenti"
                  placeholder="5"
                  min={1}
                  max={100}
                  {...form.getInputProps('minStudents')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Max Studenti"
                  placeholder="20"
                  min={1}
                  max={100}
                  {...form.getInputProps('maxStudents')}
                />
              </Grid.Col>
            </Grid>

            <NumberInput
              label="Prezzo Mensile (€)"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              mt="md"
              {...form.getInputProps('price')}
            />
          </div>

          {/* Status */}
          <Select
            label="Stato"
            placeholder="Seleziona stato"
            data={[
              { value: 'true', label: 'Attivo' },
              { value: 'false', label: 'Inattivo' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

          <Group justify="flex-end" mt="xl">
            <Button 
              variant="light" 
              onClick={onClose}
              radius="lg"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              disabled={!form.isValid()}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
              radius="lg"
            >
              {courseData ? 'Aggiorna' : 'Crea'} Corso
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
