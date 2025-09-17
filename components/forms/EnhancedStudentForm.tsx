'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import { useTranslations } from 'next-intl';
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
  Stepper,
  Paper,
  Title,
  Text,
  Badge,
  Alert,
  FileInput,
  MultiSelect,
  NumberInput,
  Divider,
  Card,
  Avatar,
  ActionIcon,
  Tooltip,
  Checkbox,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import {
  IconUser,
  IconSchool,
  IconMedicalCross,
  IconUpload,
  IconCheck,
  IconX,
  IconEdit,
  IconTrash,
  IconPlus,
  IconFileSpreadsheet,
  IconDownload,
  IconMapPin,
  IconPhone,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';

interface Student {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  studentCode?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  enrollmentDate?: Date;
  preferredLanguage?: string;
  profilePicture?: string;
  classIds?: string[];
  notes?: string;
}

interface EnhancedStudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student;
  onSave: (student: Student) => Promise<void>;
  onBulkSave?: (students: Student[]) => Promise<void>;
  loading?: boolean;
  mode?: 'single' | 'bulk' | 'import';
  availableClasses?: Array<{ value: string; label: string }>;
}

export function EnhancedStudentForm({
  opened,
  onClose,
  student,
  onSave,
  onBulkSave,
  loading = false,
  mode = 'single',
  availableClasses = [],
}: EnhancedStudentFormProps) {
  const t = useTranslations('students');
  const tc = useTranslations('common');
  
  const [activeStep, setActiveStep] = useState(0);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [bulkStudents, setBulkStudents] = useState<Student[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewMode, { toggle: togglePreview }] = useDisclosure(false);

  const form = useForm<Student>({
    initialValues: {
      firstName: student?.firstName || '',
      lastName: student?.lastName || '',
      dateOfBirth: student?.dateOfBirth || undefined,
      email: student?.email || '',
      phone: student?.phone || '',
      address: student?.address || '',
      city: student?.city || '',
      postalCode: student?.postalCode || '',
      country: student?.country || 'Italy',
      parentName: student?.parentName || '',
      parentEmail: student?.parentEmail || '',
      parentPhone: student?.parentPhone || '',
      emergencyContact: student?.emergencyContact || '',
      emergencyPhone: student?.emergencyPhone || '',
      medicalNotes: student?.medicalNotes || '',
      specialNeeds: student?.specialNeeds || '',
      status: student?.status || 'ACTIVE',
      enrollmentDate: student?.enrollmentDate || new Date(),
      preferredLanguage: student?.preferredLanguage || 'it',
      classIds: student?.classIds || [],
      notes: student?.notes || '',
    },
    validate: {
      firstName: (value) => {
        if (!value || value.length < 2) return t('validation.firstNameTooShort');
        if (value.length > 50) return t('validation.firstNameTooLong');
        if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value)) return t('validation.firstNameInvalid');
        return null;
      },
      lastName: (value) => {
        if (!value || value.length < 2) return t('validation.lastNameTooShort');
        if (value.length > 50) return t('validation.lastNameTooLong');
        if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value)) return t('validation.lastNameInvalid');
        return null;
      },
      email: (value) => {
        if (value && !/^\S+@\S+\.\S+$/.test(value)) {
          return t('validation.invalidEmail');
        }
        return null;
      },
      parentEmail: (value) => {
        if (value && !/^\S+@\S+\.\S+$/.test(value)) {
          return t('validation.invalidParentEmail');
        }
        return null;
      },
      phone: (value) => {
        if (value && !/^[\+]?[0-9\s\-\(\)]{8,}$/.test(value)) {
          return t('validation.invalidPhone');
        }
        return null;
      },
      parentPhone: (value) => {
        if (value && !/^[\+]?[0-9\s\-\(\)]{8,}$/.test(value)) {
          return t('validation.invalidParentPhone');
        }
        return null;
      },
      emergencyPhone: (value) => {
        if (value && !/^[\+]?[0-9\s\-\(\)]{8,}$/.test(value)) {
          return t('validation.invalidEmergencyPhone');
        }
        return null;
      },
      postalCode: (value) => {
        if (value && !/^\d{5}$/.test(value)) {
          return t('validation.invalidPostalCode');
        }
        return null;
      },
      dateOfBirth: (value) => {
        if (value) {
          const age = new Date().getFullYear() - value.getFullYear();
          if (age < 5 || age > 100) return t('validation.invalidAge');
        }
        return null;
      },
    },
  });

  // Reset form when student changes
  useEffect(() => {
    if (student) {
      form.setValues({
        ...student,
        classIds: student.classIds || [],
      });
    } else {
      form.reset();
    }
  }, [student]);

  // Handle file import for bulk mode
  const handleFileImport = async (file: File | null) => {
    if (!file) return;
    setImportFile(file);
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const students: Student[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length) {
          const studentData: any = {};
          headers.forEach((header, index) => {
            studentData[header] = values[index] || '';
          });
          
          // Map CSV headers to our fields
          students.push({
            firstName: studentData.firstName || studentData.nome || '',
            lastName: studentData.lastName || studentData.cognome || '',
            email: studentData.email || '',
            phone: studentData.phone || studentData.telefono || '',
            dateOfBirth: studentData.dateOfBirth ? new Date(studentData.dateOfBirth) : undefined,
            address: studentData.address || studentData.indirizzo || '',
            city: studentData.city || studentData.citta || '',
            postalCode: studentData.postalCode || studentData.cap || '',
            parentName: studentData.parentName || studentData.genitore || '',
            parentEmail: studentData.parentEmail || studentData.emailGenitore || '',
            parentPhone: studentData.parentPhone || studentData.telefonoGenitore || '',
            status: (studentData.status || 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
            enrollmentDate: new Date(),
            classIds: [],
          });
        }
      }
      
      setBulkStudents(students);
      notifications.show({
        title: tc('success'),
        message: t('importSuccess', { count: students.length }),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: tc('error'),
        message: t('importError'),
        color: 'red',
      });
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const headers = [
      'firstName', 'lastName', 'email', 'phone', 'dateOfBirth',
      'address', 'city', 'postalCode', 'parentName', 'parentEmail',
      'parentPhone', 'emergencyContact', 'emergencyPhone', 'status'
    ];
    
    const csvContent = headers.join(',') + '\n' +
      'Mario,Rossi,mario.rossi@email.com,123456789,1990-01-15,' +
      '"Via Roma 123","Milano",20100,"Giuseppe Rossi",' +
      'giuseppe@email.com,987654321,"Nonna - 555123456",' +
      '"Dott. Bianchi - 555987654",ACTIVE';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students_template.csv';
    link.click();
  };

  const handleSubmit = async (values: Student) => {
    setSubmitLoading(true);
    try {
      if (mode === 'bulk' && bulkStudents.length > 0) {
        await onBulkSave?.(bulkStudents);
        notifications.show({
          title: tc('success'),
          message: t('bulkSaveSuccess', { count: bulkStudents.length }),
          color: 'green',
        });
      } else {
        await onSave(values);
        notifications.show({
          title: tc('success'),
          message: student ? t('updateSuccess') : t('saveSuccess'),
          color: 'green',
        });
      }
      
      form.reset();
      setBulkStudents([]);
      setActiveStep(0);
      onClose();
    } catch (error) {
      notifications.show({
        title: tc('error'),
        message: student ? t('updateError') : t('saveError'),
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const nextStep = () => {
    if (activeStep === 0) {
      // Validate personal info before proceeding
      const errors = form.validate();
      if (errors.hasErrors) {
        notifications.show({
          title: tc('error'),
          message: t('validation.fixErrors'),
          color: 'red',
        });
        return;
      }
    }
    setActiveStep((current) => (current < 3 ? current + 1 : current));
  };

  const prevStep = () => setActiveStep((current) => (current > 0 ? current - 1 : current));

  const removeBulkStudent = (index: number) => {
    setBulkStudents(prev => prev.filter((_, i) => i !== index));
  };

  const editBulkStudent = (index: number) => {
    const studentToEdit = bulkStudents[index];
    form.setValues(studentToEdit);
    // Switch to single mode temporarily to edit
  };

  if (mode === 'bulk') {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={t('bulkImport')}
        size="xl"
      >
        <Stack gap="lg">
          <Alert icon={<IconUpload size={16} />} title={t('importInstructions')}>
            <Text size="sm">{t('importInstructionsText')}</Text>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconDownload size={14} />}
              mt="xs"
              onClick={downloadTemplate}
            >
              {t('downloadTemplate')}
            </Button>
          </Alert>

          <FileInput
            label={t('selectFile')}
            placeholder={t('selectCsvFile')}
            accept=".csv"
            onChange={handleFileImport}
            leftSection={<IconFileSpreadsheet size={16} />}
          />

          {bulkStudents.length > 0 && (
            <>
              <Title order={4}>{t('previewStudents')} ({bulkStudents.length})</Title>
              <Card withBorder>
                <Stack gap="xs" mah={300} style={{ overflowY: 'auto' }}>
                  {bulkStudents.map((student, index) => (
                    <Group key={index} justify="space-between" p="xs" bg="gray.0">
                      <Group gap="sm">
                        <Avatar size="sm">{student.firstName[0]}{student.lastName[0]}</Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {student.firstName} {student.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {student.email || 'No email'}
                          </Text>
                        </div>
                      </Group>
                      <Group gap="xs">
                        <ActionIcon size="sm" variant="light" onClick={() => editBulkStudent(index)}>
                          <IconEdit size={14} />
                        </ActionIcon>
                        <ActionIcon 
                          size="sm" 
                          variant="light" 
                          color="red"
                          onClick={() => removeBulkStudent(index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Card>

              <Group justify="flex-end">
                <Button variant="light" onClick={onClose}>
                  {tc('cancel')}
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  loading={submitLoading}
                  onClick={() => handleSubmit(form.values)}
                >
                  {t('importStudents', { count: bulkStudents.length })}
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={student ? t('editStudent') : t('addStudent')}
      size="xl"
    >
      <Stepper active={activeStep} onStepClick={setActiveStep} allowNextStepsSelect={false}>
        <Stepper.Step 
          label={t('personalInfo')} 
          description={t('personalInfoDesc')}
          icon={<IconUser size={18} />}
        >
          <Stack gap="md" mt="md">
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label={t('firstName')}
                  placeholder={t('firstNamePlaceholder')}
                  required
                  {...form.getInputProps('firstName')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label={t('lastName')}
                  placeholder={t('lastNamePlaceholder')}
                  required
                  {...form.getInputProps('lastName')}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <DatePickerInput
                  label={t('dateOfBirth')}
                  placeholder={t('selectDate')}
                  required
                  maxDate={new Date()}
                  valueFormat="DD/MM/YYYY"
                  {...form.getInputProps('dateOfBirth')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label={t('statusLabel')}
                  placeholder={t('selectStatus')}
                  data={[
                    { value: 'ACTIVE', label: t('status.active') },
                    { value: 'INACTIVE', label: t('status.inactive') },
                    { value: 'SUSPENDED', label: t('status.suspended') },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label={t('email')}
                  placeholder="email@example.com"
                  type="email"
                  {...form.getInputProps('email')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label={t('phone')}
                  placeholder="+39 123 456 7890"
                  {...form.getInputProps('phone')}
                />
              </Grid.Col>
            </Grid>

            <DatePickerInput
              label={t('enrollmentDate')}
              placeholder={t('selectDate')}
              required
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('enrollmentDate')}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step 
          label={t('addressInfo')} 
          description={t('addressInfoDesc')}
          icon={<IconMapPin size={18} />}
        >
          <Stack gap="md" mt="md">
            <Textarea
              label={t('address')}
              placeholder={t('fullAddress')}
              minRows={2}
              {...form.getInputProps('address')}
            />

            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label={t('city')}
                  placeholder={t('cityName')}
                  {...form.getInputProps('city')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <TextInput
                  label={t('postalCode')}
                  placeholder="12345"
                  {...form.getInputProps('postalCode')}
                />
              </Grid.Col>
              <Grid.Col span={3}>
                <Select
                  label={t('country')}
                  placeholder={t('selectCountry')}
                  data={[
                    { value: 'Italy', label: 'Italia' },
                    { value: 'France', label: 'Francia' },
                    { value: 'Spain', label: 'Spagna' },
                    { value: 'Germany', label: 'Germania' },
                  ]}
                  {...form.getInputProps('country')}
                />
              </Grid.Col>
            </Grid>

            <Select
              label={t('preferredLanguage')}
              placeholder={t('selectLanguage')}
              data={[
                { value: 'it', label: 'Italiano' },
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' },
                { value: 'pt', label: 'Português' },
              ]}
              {...form.getInputProps('preferredLanguage')}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Step 
          label={t('contactInfo')} 
          description={t('contactInfoDesc')}
          icon={<IconPhone size={18} />}
        >
          <Stack gap="md" mt="md">
            <Title order={5}>{t('parentInfo')}</Title>
            <Grid>
              <Grid.Col span={4}>
                <TextInput
                  label={t('parentName')}
                  placeholder={t('parentNamePlaceholder')}
                  {...form.getInputProps('parentName')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label={t('parentEmail')}
                  placeholder="parent@example.com"
                  type="email"
                  {...form.getInputProps('parentEmail')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label={t('parentPhone')}
                  placeholder="+39 123 456 7890"
                  {...form.getInputProps('parentPhone')}
                />
              </Grid.Col>
            </Grid>

            <Divider />

            <Title order={5}>{t('emergencyContact')}</Title>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label={t('emergencyContactName')}
                  placeholder={t('emergencyContactPlaceholder')}
                  {...form.getInputProps('emergencyContact')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label={t('emergencyPhone')}
                  placeholder="+39 123 456 7890"
                  {...form.getInputProps('emergencyPhone')}
                />
              </Grid.Col>
            </Grid>
          </Stack>
        </Stepper.Step>

        <Stepper.Step 
          label={t('additionalInfo')} 
          description={t('additionalInfoDesc')}
          icon={<IconMedicalCross size={18} />}
        >
          <Stack gap="md" mt="md">
            <MultiSelect
              label={t('assignToClasses')}
              placeholder={t('selectClasses')}
              data={availableClasses}
              {...form.getInputProps('classIds')}
            />

            <Textarea
              label={t('medicalNotes')}
              placeholder={t('medicalNotesPlaceholder')}
              minRows={3}
              {...form.getInputProps('medicalNotes')}
            />

            <Textarea
              label={t('specialNeeds')}
              placeholder={t('specialNeedsPlaceholder')}
              minRows={3}
              {...form.getInputProps('specialNeeds')}
            />

            <Textarea
              label={t('notes')}
              placeholder={t('additionalNotesPlaceholder')}
              minRows={2}
              {...form.getInputProps('notes')}
            />
          </Stack>
        </Stepper.Step>

        <Stepper.Completed>
          <Stack gap="md" mt="md">
            <Title order={4}>{t('reviewInformation')}</Title>
            <Paper p="md" withBorder>
              <Grid>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>{t('personalInfo')}</Text>
                    <Text size="sm">{form.values.firstName} {form.values.lastName}</Text>
                    <Text size="xs" c="dimmed">{form.values.email}</Text>
                    <Text size="xs" c="dimmed">{form.values.phone}</Text>
                  </Stack>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>{t('statusLabel')}</Text>
                    <Badge color={form.values.status === 'ACTIVE' ? 'green' : 'gray'}>
                      {t(`status.${form.values.status.toLowerCase()}`)}
                    </Badge>
                  </Stack>
                </Grid.Col>
              </Grid>
            </Paper>
          </Stack>
        </Stepper.Completed>
      </Stepper>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={activeStep === 0 ? onClose : prevStep}>
          {activeStep === 0 ? tc('cancel') : tc('back')}
        </Button>
        
        <Group>
          {activeStep === 3 && (
            <Button
              leftSection={<IconCheck size={16} />}
              type="submit"
              loading={submitLoading || loading}
              onClick={() => handleSubmit(form.values)}
            >
              {student ? t('updateStudent') : t('createStudent')}
            </Button>
          )}
          {activeStep < 3 && (
            <Button onClick={nextStep}>
              {tc('next')}
            </Button>
          )}
        </Group>
      </Group>
    </Modal>
  );
}
