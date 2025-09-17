'use client';

import { useForm } from '@mantine/form';
import {
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Title,
  Alert,
  Modal,
  Grid,
  Card,
  Badge,
} from '@mantine/core';
import { IconInfoCircle, IconUser, IconMail, IconPhone, IconLock, IconShield } from '@tabler/icons-react';
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
  opened: boolean;
  onClose: () => void;
  initialData?: Partial<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  loading?: boolean;
  isEdit?: boolean;
  availableRoles?: { value: Role; label: string }[];
}

const defaultRoles = [
  { value: 'ADMIN' as Role, label: 'Amministratore' },
  { value: 'TEACHER' as Role, label: 'Docente' },
  { value: 'STUDENT' as Role, label: 'Studente' },
  { value: 'PARENT' as Role, label: 'Genitore' },
];

const roleColors: Record<Role, string> = {
  SUPERADMIN: 'violet',
  ADMIN: 'red',
  TEACHER: 'blue',
  STUDENT: 'green',
  PARENT: 'orange',
};

export function UserForm({
  opened,
  onClose,
  initialData,
  onSubmit,
  loading = false,
  isEdit = false,
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
        if (isEdit && !value) return null;
        return !value || value.length < 6 ? 'La password deve contenere almeno 6 caratteri' : null;
      },
      confirmPassword: (value, values) => {
        if (isEdit && !values.password && !value) return null;
        return value !== values.password ? 'Le password non coincidono' : null;
      },
    },
  });

  const handleSubmit = (values: UserFormData) => {
    if (isEdit && !values.password) {
      const { password, confirmPassword, ...dataWithoutPassword } = values;
      onSubmit(dataWithoutPassword);
    } else {
      onSubmit(values);
    }
    onClose();
  };

  return (
    <Modal 
      opened={opened} 
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconUser size={20} />
          <Title order={3}>{isEdit ? 'Modifica Utente' : 'Nuovo Utente'}</Title>
          {isEdit && initialData?.role && (
            <Badge color={roleColors[initialData.role]} variant="light">
              {availableRoles.find(r => r.value === initialData.role)?.label}
            </Badge>
          )}
        </Group>
      }
      size="lg"
      styles={{
        header: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        },
        title: {
          color: 'white',
          fontWeight: 600,
        },
        close: {
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {isEdit && (
            <Alert icon={<IconInfoCircle />} color="blue" variant="light" radius="md">
              Lascia i campi password vuoti se non vuoi modificare la password
            </Alert>
          )}

          {/* Personal Information Card */}
          <Card withBorder radius="md" p="lg" style={{ backgroundColor: 'rgba(102, 126, 234, 0.05)' }}>
            <Group mb="md">
              <IconUser size={20} color="#667eea" />
              <Title order={4} style={{ color: '#667eea' }}>Informazioni Personali</Title>
            </Group>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Nome"
                  placeholder="Mario"
                  required
                  leftSection={<IconUser size="1rem" />}
                  styles={{
                    input: {
                      '&:focus': {
                        borderColor: '#667eea',
                      },
                    },
                  }}
                  {...form.getInputProps('firstName')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Cognome"
                  placeholder="Rossi"
                  required
                  leftSection={<IconUser size="1rem" />}
                  styles={{
                    input: {
                      '&:focus': {
                        borderColor: '#667eea',
                      },
                    },
                  }}
                  {...form.getInputProps('lastName')}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Contact Information Card */}
          <Card withBorder radius="md" p="lg" style={{ backgroundColor: 'rgba(118, 75, 162, 0.05)' }}>
            <Group mb="md">
              <IconMail size={20} color="#764ba2" />
              <Title order={4} style={{ color: '#764ba2' }}>Contatti</Title>
            </Group>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="mario.rossi@example.com"
                type="email"
                required
                leftSection={<IconMail size="1rem" />}
                styles={{
                  input: {
                    '&:focus': {
                      borderColor: '#764ba2',
                    },
                  },
                }}
                {...form.getInputProps('email')}
              />
              <TextInput
                label="Telefono"
                placeholder="+39 123 456 7890"
                leftSection={<IconPhone size="1rem" />}
                styles={{
                  input: {
                    '&:focus': {
                      borderColor: '#764ba2',
                    },
                  },
                }}
                {...form.getInputProps('phone')}
              />
            </Stack>
          </Card>

          {/* Role Card */}
          <Card withBorder radius="md" p="lg" style={{ backgroundColor: 'rgba(102, 126, 234, 0.05)' }}>
            <Group mb="md">
              <IconShield size={20} color="#667eea" />
              <Title order={4} style={{ color: '#667eea' }}>Ruolo e Permessi</Title>
            </Group>
            <Select
              label="Ruolo"
              placeholder="Seleziona ruolo"
              data={availableRoles}
              required
              leftSection={<IconShield size="1rem" />}
              styles={{
                input: {
                  '&:focus': {
                    borderColor: '#667eea',
                  },
                },
              }}
              {...form.getInputProps('role')}
            />
          </Card>

          {/* Password Card */}
          <Card withBorder radius="md" p="lg" style={{ backgroundColor: 'rgba(118, 75, 162, 0.05)' }}>
            <Group mb="md">
              <IconLock size={20} color="#764ba2" />
              <Title order={4} style={{ color: '#764ba2' }}>
                {isEdit ? 'Modifica Password (opzionale)' : 'Password'}
              </Title>
            </Group>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Password"
                  placeholder="Minimo 6 caratteri"
                  type="password"
                  required={!isEdit}
                  leftSection={<IconLock size="1rem" />}
                  styles={{
                    input: {
                      '&:focus': {
                        borderColor: '#764ba2',
                      },
                    },
                  }}
                  {...form.getInputProps('password')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Conferma Password"
                  placeholder="Ripeti la password"
                  type="password"
                  required={!isEdit}
                  leftSection={<IconLock size="1rem" />}
                  styles={{
                    input: {
                      '&:focus': {
                        borderColor: '#764ba2',
                      },
                    },
                  }}
                  {...form.getInputProps('confirmPassword')}
                />
              </Grid.Col>
            </Grid>
          </Card>

          {/* Actions */}
          <Group justify="flex-end" mt="lg">
            <Button
              variant="light"
              onClick={onClose}
              disabled={loading}
              color="gray"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              loading={loading}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              {isEdit ? 'Aggiorna' : 'Crea'} Utente
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
