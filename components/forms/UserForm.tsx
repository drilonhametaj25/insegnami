'use client';

import { useForm } from '@mantine/form';
import {
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Paper,
  Title,
  Divider,
  Alert,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { Role } from '@prisma/client';

export interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  password?: string;
  confirmPassword?: string;
}

interface UserFormProps {
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
  title?: string;
  availableRoles?: { value: Role; label: string }[];
}

const defaultRoles = [
  { value: 'ADMIN' as Role, label: 'Amministratore' },
  { value: 'TEACHER' as Role, label: 'Docente' },
  { value: 'STUDENT' as Role, label: 'Studente' },
  { value: 'PARENT' as Role, label: 'Genitore' },
];

export function UserForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
  title,
  availableRoles = defaultRoles,
}: UserFormProps) {
  const form = useForm<UserFormData>({
    initialValues: {
      firstName: initialData?.firstName || '',
      lastName: initialData?.lastName || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      role: initialData?.role || 'STUDENT',
      password: '',
      confirmPassword: '',
    },
    validate: {
      firstName: (value) => 
        value.trim().length < 2 ? 'Il nome deve contenere almeno 2 caratteri' : null,
      lastName: (value) => 
        value.trim().length < 2 ? 'Il cognome deve contenere almeno 2 caratteri' : null,
      email: (value) => 
        /^\S+@\S+$/.test(value) ? null : 'Email non valida',
      phone: (value) => 
        !value || /^[\d\s\+\-\(\)]{6,}$/.test(value) ? null : 'Numero di telefono non valido',
      password: (value) => {
        if (isEdit && !value) return null; // Password optional for edit
        return !value || value.length < 6 ? 'La password deve contenere almeno 6 caratteri' : null;
      },
      confirmPassword: (value, values) => {
        if (isEdit && !values.password && !value) return null;
        return value !== values.password ? 'Le password non coincidono' : null;
      },
    },
  });

  const handleSubmit = (values: UserFormData) => {
    // Remove password fields if editing and password is empty
    if (isEdit && !values.password) {
      const { password, confirmPassword, ...dataWithoutPassword } = values;
      onSubmit(dataWithoutPassword);
    } else {
      onSubmit(values);
    }
  };

  return (
    <Paper p="lg">
      <Stack>
        <Title order={3}>{title || (isEdit ? 'Modifica Utente' : 'Nuovo Utente')}</Title>
        
        {isEdit && (
          <Alert icon={<IconInfoCircle />} color="blue" variant="light">
            Lascia i campi password vuoti se non vuoi modificare la password
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            {/* Personal Information */}
            <div>
              <Title order={5} mb="sm">Informazioni Personali</Title>
              <Group grow>
                <TextInput
                  label="Nome"
                  placeholder="Mario"
                  required
                  {...form.getInputProps('firstName')}
                />
                <TextInput
                  label="Cognome"
                  placeholder="Rossi"
                  required
                  {...form.getInputProps('lastName')}
                />
              </Group>
            </div>

            {/* Contact Information */}
            <div>
              <Title order={5} mb="sm">Contatti</Title>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  placeholder="mario.rossi@example.com"
                  type="email"
                  required
                  {...form.getInputProps('email')}
                />
                <TextInput
                  label="Telefono"
                  placeholder="+39 123 456 7890"
                  {...form.getInputProps('phone')}
                />
              </Stack>
            </div>

            {/* Role */}
            <div>
              <Title order={5} mb="sm">Ruolo</Title>
              <Select
                label="Ruolo"
                placeholder="Seleziona ruolo"
                data={availableRoles}
                required
                {...form.getInputProps('role')}
              />
            </div>

            {/* Password Section */}
            <div>
              <Title order={5} mb="sm">
                {isEdit ? 'Modifica Password (opzionale)' : 'Password'}
              </Title>
              <Group grow>
                <TextInput
                  label="Password"
                  placeholder="Minimo 6 caratteri"
                  type="password"
                  required={!isEdit}
                  {...form.getInputProps('password')}
                />
                <TextInput
                  label="Conferma Password"
                  placeholder="Ripeti la password"
                  type="password"
                  required={!isEdit}
                  {...form.getInputProps('confirmPassword')}
                />
              </Group>
            </div>

            <Divider />

            {/* Actions */}
            <Group justify="flex-end">
              <Button
                variant="light"
                onClick={onCancel}
                disabled={loading}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                loading={loading}
              >
                {isEdit ? 'Aggiorna' : 'Crea'} Utente
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
