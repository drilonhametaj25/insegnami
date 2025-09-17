'use client';

import { useState, useEffect } from 'react';
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
  Divider,
  Accordion,
  Checkbox,
  Alert,
  Loader,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconSearch, IconUser, IconUserPlus } from '@tabler/icons-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface StudentFormData {
  // Dati studente
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  email?: string;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  
  // Gestione password studente
  createStudentAccount: boolean;
  studentPassword?: string;
  
  // Gestione genitore
  hasParent: boolean;
  parentType: 'new' | 'existing' | 'search';
  
  // Nuovo genitore
  parentFirstName?: string;
  parentLastName?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentPassword?: string;
  
  // Genitore esistente
  existingParentId?: string;
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
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  user?: User;
  parentUser?: User;
}

interface AdvancedStudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student;
  onSave: (data: StudentFormData) => Promise<void>;
  loading?: boolean;
}

export function AdvancedStudentForm({
  opened,
  onClose,
  student,
  onSave,
  loading = false,
}: AdvancedStudentFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchingParents, setSearchingParents] = useState(false);
  const [availableParents, setAvailableParents] = useState<User[]>([]);
  const [parentSearchTerm, setParentSearchTerm] = useState('');

  const isEditing = !!student;

  const form = useForm<StudentFormData>({
    initialValues: {
      // Dati studente
      firstName: student?.firstName || '',
      lastName: student?.lastName || '',
      dateOfBirth: student?.dateOfBirth || new Date(),
      email: student?.email || '',
      phone: student?.phone || '',
      address: student?.address || '',
      emergencyContact: student?.emergencyContact || '',
      medicalNotes: student?.medicalNotes || '',
      specialNeeds: student?.specialNeeds || '',
      status: student?.status || 'ACTIVE',
      
      // Gestione account studente
      createStudentAccount: !!student?.user || false,
      studentPassword: '',
      
      // Gestione genitore
      hasParent: !!student?.parentUser || false,
      parentType: student?.parentUser ? 'existing' : 'new',
      
      // Dati genitore nuovo
      parentFirstName: student?.parentUser?.firstName || '',
      parentLastName: student?.parentUser?.lastName || '',
      parentEmail: student?.parentUser?.email || '',
      parentPhone: student?.parentUser?.phone || '',
      parentPassword: '',
      
      // Genitore esistente
      existingParentId: student?.parentUser?.id || '',
    },
    validate: {
      firstName: (value) => (value.length < 2 ? 'Nome troppo corto' : null),
      lastName: (value) => (value.length < 2 ? 'Cognome troppo corto' : null),
      email: (value) => {
        const hasAccount = form.values.createStudentAccount;
        if (hasAccount && (!value || value.trim() === '')) {
          return 'Email richiesta per account studente';
        }
        if (value && !/^\S+@\S+$/.test(value)) {
          return 'Email non valida';
        }
        return null;
      },
      studentPassword: (value) => {
        const hasAccount = form.values.createStudentAccount;
        const isEditing = !!student;
        if (hasAccount && !isEditing && (!value || value.length < 6)) {
          return 'Password di almeno 6 caratteri';
        }
        if (hasAccount && isEditing && value && value.length < 6) {
          return 'Password di almeno 6 caratteri';
        }
        return null;
      },
      parentFirstName: (value) => {
        const hasParent = form.values.hasParent;
        const isNew = form.values.parentType === 'new';
        if (hasParent && isNew && (!value || value.length < 2)) {
          return 'Nome genitore richiesto';
        }
        return null;
      },
      parentLastName: (value) => {
        const hasParent = form.values.hasParent;
        const isNew = form.values.parentType === 'new';
        if (hasParent && isNew && (!value || value.length < 2)) {
          return 'Cognome genitore richiesto';
        }
        return null;
      },
      parentEmail: (value) => {
        const hasParent = form.values.hasParent;
        const isNew = form.values.parentType === 'new';
        if (hasParent && isNew && (!value || value.trim() === '')) {
          return 'Email genitore richiesta';
        }
        if (hasParent && isNew && value && !/^\S+@\S+$/.test(value)) {
          return 'Email genitore non valida';
        }
        return null;
      },
      parentPassword: (value) => {
        const hasParent = form.values.hasParent;
        const isNew = form.values.parentType === 'new';
        const isEditing = !!student;
        if (hasParent && isNew && !isEditing && (!value || value.length < 6)) {
          return 'Password genitore di almeno 6 caratteri';
        }
        if (hasParent && isNew && isEditing && value && value.length < 6) {
          return 'Password genitore di almeno 6 caratteri';
        }
        return null;
      },
      existingParentId: (value) => {
        const hasParent = form.values.hasParent;
        const isExisting = form.values.parentType === 'existing';
        if (hasParent && isExisting && (!value || value.trim() === '')) {
          return 'Seleziona un genitore esistente';
        }
        return null;
      },
    },
  });

  // Genera password casuali
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Cerca genitori esistenti
  const searchParents = async (term: string) => {
    if (term.length < 2) {
      setAvailableParents([]);
      return;
    }

    setSearchingParents(true);
    try {
      const response = await fetch(`/api/users?role=PARENT&search=${encodeURIComponent(term)}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setAvailableParents(data.users || []);
      }
    } catch (error) {
      console.error('Error searching parents:', error);
    } finally {
      setSearchingParents(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (form.values.parentType === 'search') {
        searchParents(parentSearchTerm);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [parentSearchTerm, form.values.parentType]);

  const handleSubmit = async (values: StudentFormData) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
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
        <Accordion defaultValue={['student', 'account', 'parent']} multiple>
          {/* Informazioni Studente */}
          <Accordion.Item value="student">
            <Accordion.Control icon={<IconUser size={16} />}>
              Informazioni Studente
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
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
                      label="Email (opzionale)"
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

                <TextInput
                  label="Contatto di Emergenza"
                  placeholder="Nome e numero per emergenze"
                  {...form.getInputProps('emergencyContact')}
                />

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
                  {...form.getInputProps('specialNeeds')}
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Gestione Account Studente */}
          <Accordion.Item value="account">
            <Accordion.Control icon={<IconUserPlus size={16} />}>
              Account di Accesso Studente
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Checkbox
                  label="Crea account di accesso per lo studente"
                  description="Lo studente potrà accedere al portale per vedere le sue informazioni"
                  {...form.getInputProps('createStudentAccount', { type: 'checkbox' })}
                />

                {form.values.createStudentAccount && (
                  <>
                    <Alert icon={<IconInfoCircle size={16} />} color="blue">
                      {isEditing 
                        ? "L'email è già configurata. Lascia vuota la password per non cambiarla."
                        : "L'email inserita sopra verrà usata per l'accesso. È obbligatoria se attivi l'account."
                      }
                    </Alert>

                    <Group>
                      <TextInput
                        label="Password"
                        type="password"
                        placeholder={isEditing ? "Lascia vuoto per non cambiare" : "Inserisci password"}
                        required={!isEditing}
                        style={{ flex: 1 }}
                        {...form.getInputProps('studentPassword')}
                      />
                      <Button
                        variant="light"
                        size="sm"
                        mt={24}
                        onClick={() => form.setFieldValue('studentPassword', generatePassword())}
                      >
                        Genera
                      </Button>
                    </Group>
                  </>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Gestione Genitore */}
          <Accordion.Item value="parent">
            <Accordion.Control icon={<IconUser size={16} />}>
              Genitore/Tutore (Opzionale)
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Checkbox
                  label="Questo studente ha un genitore/tutore"
                  description="Il genitore potrà accedere al portale per vedere le informazioni del figlio"
                  {...form.getInputProps('hasParent', { type: 'checkbox' })}
                />

                {form.values.hasParent && (
                  <>
                    <Select
                      label="Tipo di Genitore"
                      placeholder="Seleziona opzione"
                      data={[
                        { value: 'new', label: 'Nuovo genitore - crea account' },
                        { value: 'existing', label: 'Genitore esistente - seleziona' },
                        { value: 'search', label: 'Cerca genitore per nome/email' },
                      ]}
                      {...form.getInputProps('parentType')}
                    />

                    {form.values.parentType === 'new' && (
                      <Stack gap="md">
                        <Alert icon={<IconInfoCircle size={16} />} color="green">
                          Verrà creato un nuovo account genitore con accesso al portale.
                        </Alert>

                        <Grid>
                          <Grid.Col span={6}>
                            <TextInput
                              label="Nome Genitore"
                              placeholder="Nome del genitore"
                              required
                              {...form.getInputProps('parentFirstName')}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <TextInput
                              label="Cognome Genitore"
                              placeholder="Cognome del genitore"
                              required
                              {...form.getInputProps('parentLastName')}
                            />
                          </Grid.Col>
                        </Grid>

                        <Grid>
                          <Grid.Col span={6}>
                            <TextInput
                              label="Email Genitore"
                              placeholder="email@genitore.com"
                              required
                              {...form.getInputProps('parentEmail')}
                            />
                          </Grid.Col>
                          <Grid.Col span={6}>
                            <TextInput
                              label="Telefono Genitore"
                              placeholder="Numero genitore"
                              {...form.getInputProps('parentPhone')}
                            />
                          </Grid.Col>
                        </Grid>

                        <Group>
                          <TextInput
                            label="Password Genitore"
                            type="password"
                            placeholder={isEditing ? "Lascia vuoto per non cambiare" : "Password per accesso"}
                            required={!isEditing}
                            style={{ flex: 1 }}
                            {...form.getInputProps('parentPassword')}
                          />
                          <Button
                            variant="light"
                            size="sm"
                            mt={24}
                            onClick={() => form.setFieldValue('parentPassword', generatePassword())}
                          >
                            Genera
                          </Button>
                        </Group>
                      </Stack>
                    )}

                    {form.values.parentType === 'existing' && (
                      <Stack gap="md">
                        <Alert icon={<IconInfoCircle size={16} />} color="blue">
                          Seleziona un genitore già registrato nel sistema. Il genitore potrà vedere tutti i suoi figli nella dashboard.
                        </Alert>

                        <Select
                          label="Seleziona Genitore Esistente"
                          placeholder="Scegli dall'elenco"
                          searchable
                          data={availableParents.map(parent => ({
                            value: parent.id,
                            label: `${parent.firstName} ${parent.lastName} - ${parent.email}`
                          }))}
                          {...form.getInputProps('existingParentId')}
                        />
                      </Stack>
                    )}

                    {form.values.parentType === 'search' && (
                      <Stack gap="md">
                        <Alert icon={<IconInfoCircle size={16} />} color="orange">
                          Cerca per nome o email un genitore esistente. Se non lo trovi, creane uno nuovo.
                        </Alert>

                        <TextInput
                          label="Cerca Genitore"
                          placeholder="Nome o email del genitore"
                          leftSection={<IconSearch size={16} />}
                          rightSection={searchingParents && <Loader size={16} />}
                          value={parentSearchTerm}
                          onChange={(e) => setParentSearchTerm(e.target.value)}
                        />

                        {availableParents.length > 0 && (
                          <Select
                            label="Risultati Ricerca"
                            placeholder="Seleziona dal risultato"
                            data={availableParents.map(parent => ({
                              value: parent.id,
                              label: `${parent.firstName} ${parent.lastName} - ${parent.email}`
                            }))}
                            {...form.getInputProps('existingParentId')}
                          />
                        )}

                        {parentSearchTerm.length >= 2 && availableParents.length === 0 && !searchingParents && (
                          <Text size="sm" c="dimmed">
                            Nessun genitore trovato. Prova con "Nuovo genitore" per crearne uno.
                          </Text>
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

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
            {student ? 'Aggiorna' : 'Crea'} Studente
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
