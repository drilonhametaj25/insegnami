'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Badge,
  Table,
  ActionIcon,
  Text,
  Tabs,
  Grid,
  Card,
  Alert,
  LoadingOverlay,
  Pagination,
  Skeleton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconEye,
  IconCurrencyEuro,
  IconCalendar,
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconReceipt,
  IconTrendingUp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { 
  usePayments,
  usePaymentStats,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  useMarkPaymentAsPaid,
  type Payment,
  type PaymentStats,
  type CreatePaymentData
} from '@/lib/hooks/usePayments';
import { useStudents } from '@/lib/hooks/useStudents';
import { useClasses } from '@/lib/hooks/useClasses';

interface PaymentFormData {
  studentId: string;
  classId?: string;
  amount: number;
  paymentMethod: string;
  status: 'PENDING' | 'PAID';
  dueDate: Date;
  paidDate?: Date;
  description: string;
  notes?: string;
  reference?: string;
}

export default function PaymentsPage() {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // TanStack Query hooks
  const { 
    data: paymentsData, 
    isLoading: paymentsLoading, 
    error: paymentsError 
  } = usePayments(currentPage, 10);

  const { 
    data: stats, 
    isLoading: statsLoading 
  } = usePaymentStats();

  const { 
    data: studentsData, 
    isLoading: studentsLoading 
  } = useStudents();

  const { 
    data: classesData, 
    isLoading: classesLoading 
  } = useClasses();

  const createPayment = useCreatePayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const markAsPaid = useMarkPaymentAsPaid();

  const payments = paymentsData?.payments || [];
  const totalPages = paymentsData?.pagination?.totalPages || 1;
  const students = studentsData?.students || [];
  const classes = classesData?.classes || [];

  const form = useForm<PaymentFormData>({
    initialValues: {
      studentId: '',
      classId: '',
      amount: 0,
      paymentMethod: 'CASH',
      status: 'PENDING',
      dueDate: new Date(),
      paidDate: undefined,
      description: '',
      notes: '',
      reference: '',
    },
    validate: {
      studentId: (value) => (!value ? 'Seleziona uno studente' : null),
      amount: (value) => (value <= 0 ? 'Importo deve essere maggiore di 0' : null),
      description: (value) => (!value ? 'Descrizione richiesta' : null),
    },
  });

  const handleSavePayment = (values: PaymentFormData) => {
    const paymentData: CreatePaymentData = {
      studentId: values.studentId,
      classId: values.classId,
      amount: values.amount,
      method: values.paymentMethod,
      status: values.status,
      dueDate: values.dueDate.toISOString(),
      paidDate: values.paidDate?.toISOString(),
      description: values.description,
      notes: values.notes,
    };

    if (editingPayment) {
      updatePayment.mutate(
        { id: editingPayment.id, data: paymentData },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Successo',
              message: 'Pagamento aggiornato con successo',
              color: 'green',
            });
            closeModal();
            form.reset();
          },
          onError: (error) => {
            notifications.show({
              title: 'Errore',
              message: error.message || 'Errore nell\'aggiornamento del pagamento',
              color: 'red',
            });
          },
        }
      );
    } else {
      createPayment.mutate(paymentData, {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Pagamento creato con successo',
            color: 'green',
          });
          closeModal();
          form.reset();
        },
        onError: (error) => {
          notifications.show({
            title: 'Errore',
            message: error.message || 'Errore nella creazione del pagamento',
            color: 'red',
          });
        },
      });
    }
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    form.setValues({
      studentId: payment.student.id,
      classId: payment.class?.id || '',
      amount: payment.amount,
      paymentMethod: payment.method || 'CASH',
      status: payment.status === 'PAID' ? 'PAID' : 'PENDING',
      dueDate: new Date(payment.dueDate),
      paidDate: payment.paidDate ? new Date(payment.paidDate) : undefined,
      description: payment.description || '',
      notes: payment.notes || '',
      reference: '',
    });
    openModal();
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    deletePayment.mutate(paymentId, {
      onSuccess: () => {
        notifications.show({
          title: tCommon('success'),
          message: t('deleteSuccess'),
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: tCommon('error'),
          message: error.message || t('deleteError'),
          color: 'red',
        });
      },
    });
  };

  const handleMarkAsPaid = (paymentId: string) => {
    markAsPaid.mutate(
      { id: paymentId, paidDate: new Date().toISOString() },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Pagamento segnato come pagato',
            color: 'green',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Errore',
            message: error.message || 'Errore nell\'aggiornamento del pagamento',
            color: 'red',
          });
        },
      }
    );
  };

  const exportPaymentReport = async () => {
    try {
      const response = await fetch('/api/payments/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-report-${dayjs().format('YYYY-MM-DD')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: t('exportError'),
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'green';
      case 'PENDING': return 'blue';
      case 'OVERDUE': return 'red';
      case 'CANCELLED': return 'gray';
      case 'REFUNDED': return 'orange';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID': return 'Pagato';
      case 'PENDING': return 'In attesa';
      case 'OVERDUE': return 'Scaduto';
      case 'CANCELLED': return 'Annullato';
      case 'REFUNDED': return 'Rimborsato';
      default: return status;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return t('cash');
      case 'BANK_TRANSFER': return t('bankTransfer');
      case 'CREDIT_CARD': return t('creditCard');
      case 'CHECK': return t('check');
      case 'OTHER': return t('other');
      default: return method || '-';
    }
  };

  // Loading states
  const isLoading = paymentsLoading || statsLoading || studentsLoading || classesLoading;
  const isSaving = createPayment.isPending || updatePayment.isPending || deletePayment.isPending || markAsPaid.isPending;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>{t('title')}</Title>
          <Group>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={exportPaymentReport}
            >
              {t('exportReport')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingPayment(null);
                form.reset();
                openModal();
              }}
            >
              {t('addPayment')}
            </Button>
          </Group>
        </Group>

        <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconTrendingUp size={16} />}>
              {t('overview')}
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconCurrencyEuro size={16} />}>
              {t('payments')}
            </Tabs.Tab>
            <Tabs.Tab value="overdue" leftSection={<IconAlertTriangle size={16} />}>
              {t('overdue')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            {statsLoading ? (
              <Grid mb="xl">
                {[1, 2, 3, 4].map((i) => (
                  <Grid.Col key={i} span={{ base: 12, sm: 6, md: 3 }}>
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                      <Skeleton height={20} mb="xs" />
                      <Skeleton height={32} mb="xs" />
                      <Skeleton height={16} />
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            ) : stats ? (
              <Grid mb="xl">
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" c="dimmed">{t('totalRevenue')}</Text>
                        <Text size="xl" fw={700}>€{stats?.totalPayments?.toLocaleString() || '0'}</Text>
                      </div>
                      <IconCurrencyEuro size={32} color="var(--mantine-color-green-6)" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" c="dimmed">In Attesa</Text>
                        <Text size="xl" fw={700}>€{stats.pendingAmount.toLocaleString()}</Text>
                        <Text size="xs" c="dimmed">{stats.pendingPayments} pagamenti</Text>
                      </div>
                      <IconClock size={32} color="var(--mantine-color-blue-6)" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" c="dimmed">Scaduti</Text>
                        <Text size="xl" fw={700} c="red">€{stats.overdueAmount.toLocaleString()}</Text>
                        <Text size="xs" c="dimmed">{stats.overduePayments} pagamenti</Text>
                      </div>
                      <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" c="dimmed">Questo Mese</Text>
                        <Text size="xl" fw={700}>€{stats.monthlyRevenue.toLocaleString()}</Text>
                      </div>
                      <IconTrendingUp size={32} color="var(--mantine-color-teal-6)" />
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>
            ) : null}

            {/* Recent Payments */}
            <Paper p="lg" withBorder>
              <Title order={3} mb="md">Pagamenti Recenti</Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Importo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    <Table.Th>Scadenza</Table.Th>
                    <Table.Th>Azioni</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.slice(0, 5).map((payment) => (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {payment.student.firstName} {payment.student.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">{payment.class?.name || 'Nessuna classe'}</Text>
                        </div>
                      </Table.Td>
                      <Table.Td>€{payment.amount.toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(payment.status)} variant="light">
                          {getStatusLabel(payment.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{dayjs(payment.dueDate).format('DD/MM/YYYY')}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {payment.status === 'PENDING' && (
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment.id)}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          )}
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Paper p="lg" withBorder>
              <LoadingOverlay visible={isLoading} />
              
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Classe</Table.Th>
                    <Table.Th>Importo</Table.Th>
                    <Table.Th>Metodo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    <Table.Th>Scadenza</Table.Th>
                    <Table.Th>Azioni</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {payments.map((payment) => (
                    <Table.Tr key={payment.id}>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {payment.student.firstName} {payment.student.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">{payment.student.email}</Text>
                        </div>
                      </Table.Td>
                      <Table.Td>{payment.class?.name || '-'}</Table.Td>
                      <Table.Td>€{payment.amount.toLocaleString()}</Table.Td>
                      <Table.Td>{getMethodLabel(payment.method || '')}</Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(payment.status)} variant="light">
                          {getStatusLabel(payment.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {dayjs(payment.dueDate).format('DD/MM/YYYY')}
                        </Text>
                        {payment.status === 'OVERDUE' && (
                          <Text size="xs" c="red">
                            {dayjs().diff(dayjs(payment.dueDate), 'day')} giorni in ritardo
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {payment.status === 'PENDING' && (
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment.id)}
                              title="Segna come pagato"
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          )}
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleEditPayment(payment)}
                            title="Modifica"
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="gray"
                            size="sm"
                            title="Ricevuta"
                          >
                            <IconReceipt size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleDeletePayment(payment.id)}
                            title="Elimina"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    value={currentPage}
                    onChange={setCurrentPage}
                    total={totalPages}
                  />
                </Group>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="overdue" pt="lg">
            <Paper p="lg" withBorder>
              <Stack gap="md">
                <Alert icon={<IconAlertTriangle size={16} />} color="red">
                  Ci sono {stats?.overduePayments || 0} pagamenti scaduti per un totale di €{stats?.overdueAmount.toLocaleString() || 0}
                </Alert>

                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Studente</Table.Th>
                      <Table.Th>Classe</Table.Th>
                      <Table.Th>Importo</Table.Th>
                      <Table.Th>Giorni di ritardo</Table.Th>
                      <Table.Th>Azioni</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.filter(p => p.status === 'OVERDUE').map((payment) => (
                      <Table.Tr key={payment.id}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500}>
                              {payment.student.firstName} {payment.student.lastName}
                            </Text>
                            <Text size="xs" c="dimmed">{payment.student.email}</Text>
                          </div>
                        </Table.Td>
                        <Table.Td>{payment.class?.name || '-'}</Table.Td>
                        <Table.Td>€{payment.amount.toLocaleString()}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c="red">
                            {dayjs().diff(dayjs(payment.dueDate), 'day')} giorni
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => handleMarkAsPaid(payment.id)}
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => handleEditPayment(payment)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Payment Form Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingPayment ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSavePayment)}>
          <Stack gap="md">
            <Select
              label="Studente"
              placeholder="Seleziona studente"
              data={students.map(s => ({ 
                value: s.id, 
                label: `${s.firstName} ${s.lastName} (${s.email})` 
              }))}
              {...form.getInputProps('studentId')}
              searchable
            />

            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Importo"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  leftSection={<IconCurrencyEuro size={16} />}
                  {...form.getInputProps('amount')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Metodo di Pagamento"
                  data={[
                    { value: 'CASH', label: 'Contanti' },
                    { value: 'BANK_TRANSFER', label: 'Bonifico Bancario' },
                    { value: 'CREDIT_CARD', label: 'Carta di Credito' },
                    { value: 'CHECK', label: 'Assegno' },
                    { value: 'OTHER', label: 'Altro' },
                  ]}
                  {...form.getInputProps('paymentMethod')}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Stato"
                  data={[
                    { value: 'PENDING', label: 'In Attesa' },
                    { value: 'PAID', label: 'Pagato' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Classe (Opzionale)"
                  placeholder="Seleziona classe"
                  data={classes.map(c => ({ 
                    value: c.id, 
                    label: `${c.name} - ${c.course?.name || 'Nessun corso'}`
                  }))}
                  {...form.getInputProps('classId')}
                  searchable
                  clearable
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Data di Scadenza"
                  placeholder="Seleziona data"
                  {...form.getInputProps('dueDate')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                {form.values.status === 'PAID' && (
                  <DatePickerInput
                    label="Data di Pagamento"
                    placeholder="Seleziona data"
                    {...form.getInputProps('paidDate')}
                  />
                )}
              </Grid.Col>
            </Grid>

            <TextInput
              label="Descrizione"
              placeholder="Es: Quota mensile corso inglese"
              {...form.getInputProps('description')}
            />

            <TextInput
              label="Riferimento"
              placeholder="Numero fattura, codice bonifico, etc."
              {...form.getInputProps('reference')}
            />

            <Textarea
              label="Note"
              placeholder="Note aggiuntive..."
              {...form.getInputProps('notes')}
              minRows={2}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeModal}>
                Annulla
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingPayment ? 'Aggiorna' : 'Crea'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
