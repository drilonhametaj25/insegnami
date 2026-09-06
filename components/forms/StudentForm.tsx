'use client';

import { useEffect, useState } from 'react';
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
  Switch,
  ActionIcon,
  Badge,
  Text,
  Paper,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconUserPlus } from '@tabler/icons-react';

interface GuardianEntry {
  userId: string;
  relationship?: string | null;
  isPrimary: boolean;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface Student {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
  address?: string;
  studentCode?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  guardians?: GuardianEntry[];
}

interface StudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student;
  onSave: (student: Student & { guardians?: GuardianEntry[] }) => Promise<void>;
  loading?: boolean;
}

export function StudentForm({
  opened,
  onClose,
  student,
  onSave,
  loading = false,
}: StudentFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [guardians, setGuardians] = useState<GuardianEntry[]>([]);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianLookupLoading, setGuardianLookupLoading] = useState(false);

  const isEdit = Boolean(student?.id);

  // Riallinea la lista tutori a ogni apertura del modal
  useEffect(() => {
    if (opened) {
      setGuardians(
        (student?.guardians || []).map((g) => ({
          userId: g.userId,
          relationship: g.relationship ?? '',
          isPrimary: g.isPrimary,
          user: g.user,
        }))
      );
      setGuardianEmail('');
    }
  }, [opened, student]);

  const form = useForm<Student>({
    initialValues: {
      firstName: student?.firstName || '',
      lastName: student?.lastName || '',
      dateOfBirth: student?.dateOfBirth || new Date(),
      email: student?.email || '',
      phone: student?.phone || '',
      address: student?.address || '',
      parentName: student?.parentName || '',
      parentEmail: student?.parentEmail || '',
      parentPhone: student?.parentPhone || '',
      emergencyContact: student?.emergencyContact || '',
      medicalNotes: student?.medicalNotes || '',
      specialNeeds: student?.specialNeeds || '',
      status: student?.status || 'ACTIVE',
    },
    validate: {
      firstName: (value) => (value.length < 2 ? 'Nome troppo corto' : null),
      lastName: (value) => (value.length < 2 ? 'Cognome troppo corto' : null),
      email: (value) => {
        if (value && !/^\S+@\S+$/.test(value)) {
          return 'Email non valida';
        }
        return null;
      },
      parentEmail: (value) => {
        if (value && !/^\S+@\S+$/.test(value)) {
          return 'Email genitore non valida';
        }
        return null;
      },
    },
  });

  // Cerca un utente PARENT esistente per email e lo aggiunge come tutore
  const handleAddGuardian = async () => {
    const email = guardianEmail.trim().toLowerCase();
    if (!email || !/^\S+@\S+$/.test(email)) {
      notifications.show({
        title: 'Errore',
        message: 'Inserisci una email valida',
        color: 'red',
      });
      return;
    }

    if (guardians.some((g) => g.user?.email?.toLowerCase() === email)) {
      notifications.show({
        title: 'Attenzione',
        message: 'Questo tutore è già presente nella lista',
        color: 'yellow',
      });
      return;
    }

    setGuardianLookupLoading(true);
    try {
      const response = await fetch(
        `/api/users?search=${encodeURIComponent(email)}&role=PARENT&limit=5`
      );
      if (!response.ok) throw new Error('Ricerca non riuscita');
      const data = await response.json();
      const match = (data.users || []).find(
        (u: any) => u.email?.toLowerCase() === email
      );

      if (!match) {
        notifications.show({
          title: 'Non trovato',
          message: 'Nessun utente con ruolo genitore trovato con questa email',
          color: 'red',
        });
        return;
      }

      setGuardians((current) => [
        ...current,
        {
          userId: match.id,
          relationship: '',
          isPrimary: current.length === 0,
          user: {
            firstName: match.firstName,
            lastName: match.lastName,
            email: match.email,
          },
        },
      ]);
      setGuardianEmail('');
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Errore durante la ricerca del tutore',
        color: 'red',
      });
    } finally {
      setGuardianLookupLoading(false);
    }
  };

  const handleRemoveGuardian = (userId: string) => {
    setGuardians((current) => {
      const next = current.filter((g) => g.userId !== userId);
      // Se rimuovo il primario, promuovo il primo rimasto
      if (next.length > 0 && !next.some((g) => g.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const handleSetPrimary = (userId: string, value: boolean) => {
    setGuardians((current) =>
      current.map((g) =>
        value
          ? { ...g, isPrimary: g.userId === userId }
          : g.userId === userId
            ? { ...g, isPrimary: false }
            : g
      )
    );
  };

  const handleRelationshipChange = (userId: string, relationship: string) => {
    setGuardians((current) =>
      current.map((g) => (g.userId === userId ? { ...g, relationship } : g))
    );
  };

  const handleSubmit = async (values: Student) => {
    setSubmitLoading(true);
    try {
      const payload: Student & { guardians?: GuardianEntry[] } = { ...values };
      // Solo in modifica: la creazione passa dal flusso genitore del POST
      if (isEdit) {
        payload.guardians = guardians.map((g) => ({
          userId: g.userId,
          relationship: g.relationship || null,
          isPrimary: g.isPrimary,
        }));
      }
      await onSave(payload);
      notifications.show({
        title: 'Successo',
        message: `Studente ${student ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${student ? 'l\'aggiornamento' : 'la creazione'} dello studente`,
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={student ? 'Modifica Studente' : 'Nuovo Studente'}
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
          background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
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
          {/* Informazioni Personali */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Nome"
                placeholder="Nome dello studente"
                required
                {...form.getInputProps('firstName')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Cognome"
                placeholder="Cognome dello studente"
                required
                {...form.getInputProps('lastName')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Data di Nascita"
                placeholder="Seleziona data"
                required
                maxDate={new Date()}
                {...form.getInputProps('dateOfBirth')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Status"
                placeholder="Seleziona status"
                data={[
                  { value: 'ACTIVE', label: 'Attivo' },
                  { value: 'INACTIVE', label: 'Inattivo' },
                  { value: 'SUSPENDED', label: 'Sospeso' },
                ]}
                {...form.getInputProps('status')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Email"
                placeholder="email@esempio.com"
                {...form.getInputProps('email')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Telefono"
                placeholder="Numero di telefono"
                {...form.getInputProps('phone')}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Indirizzo"
            placeholder="Indirizzo completo"
            minRows={2}
            {...form.getInputProps('address')}
          />

          {/* Tutori (StudentGuardian) — solo in modifica */}
          {isEdit && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Tutori
              </h4>

              <Stack gap="sm">
                {guardians.length === 0 && (
                  <Text size="sm" c="dimmed">
                    Nessun tutore collegato. Aggiungi un genitore esistente tramite email.
                  </Text>
                )}

                {guardians.map((guardian) => (
                  <Paper key={guardian.userId} p="sm" withBorder radius="md">
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Text size="sm" fw={500}>
                            {guardian.user
                              ? `${guardian.user.firstName} ${guardian.user.lastName}`
                              : guardian.userId}
                          </Text>
                          {guardian.isPrimary && (
                            <Badge size="xs" color="blue">Primario</Badge>
                          )}
                        </Group>
                        {guardian.user?.email && (
                          <Text size="xs" c="dimmed">{guardian.user.email}</Text>
                        )}
                      </div>
                      <TextInput
                        placeholder="Relazione (es. madre)"
                        size="xs"
                        w={150}
                        value={guardian.relationship || ''}
                        onChange={(e) =>
                          handleRelationshipChange(guardian.userId, e.currentTarget.value)
                        }
                      />
                      <Switch
                        label="Primario"
                        size="xs"
                        checked={guardian.isPrimary}
                        onChange={(e) =>
                          handleSetPrimary(guardian.userId, e.currentTarget.checked)
                        }
                        data-testid="studenti-tutore-primario"
                      />
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => handleRemoveGuardian(guardian.userId)}
                        data-testid="studenti-tutore-rimuovi"
                        aria-label="Rimuovi tutore"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}

                <Group align="flex-end" gap="sm">
                  <TextInput
                    label="Email genitore esistente"
                    placeholder="genitore@esempio.com"
                    style={{ flex: 1 }}
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.currentTarget.value)}
                  />
                  <Button
                    variant="light"
                    leftSection={<IconUserPlus size={16} />}
                    loading={guardianLookupLoading}
                    onClick={handleAddGuardian}
                    data-testid="studenti-tutore-aggiungi"
                  >
                    Aggiungi Tutore
                  </Button>
                </Group>
              </Stack>
            </div>
          )}

          {/* Informazioni Genitore/Tutore (contatti di riferimento) */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Informazioni Genitore/Tutore
            </h4>
            <Grid>
              <Grid.Col span={4}>
                <TextInput
                  label="Nome Genitore"
                  placeholder="Nome del genitore"
                  {...form.getInputProps('parentName')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Email Genitore"
                  placeholder="email@genitore.com"
                  {...form.getInputProps('parentEmail')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Telefono Genitore"
                  placeholder="Numero genitore"
                  {...form.getInputProps('parentPhone')}
                />
              </Grid.Col>
            </Grid>

            <TextInput
              label="Contatto di Emergenza"
              placeholder="Nome e numero per emergenze"
              mt="md"
              {...form.getInputProps('emergencyContact')}
            />
          </div>

          {/* Note Mediche e Speciali */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Note Aggiuntive
            </h4>
            <Textarea
              label="Note Mediche"
              placeholder="Allergie, condizioni mediche, farmaci..."
              minRows={2}
              {...form.getInputProps('medicalNotes')}
            />

            <Textarea
              label="Bisogni Speciali"
              placeholder="Esigenze particolari, supporto necessario..."
              minRows={2}
              mt="md"
              {...form.getInputProps('specialNeeds')}
            />
          </div>

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
              data-testid="studenti-salva"
            >
              {student ? 'Aggiorna' : 'Crea'} Studente
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
