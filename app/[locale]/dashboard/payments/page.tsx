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
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px'
    }}>
      <Container size="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title 
              order={1} 
              style={{ 
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {t('title')}
            </Title>
            <Group>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={exportPaymentReport}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  backdropFilter: 'blur(10px)'
                }}
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
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                }}
              >
                {t('addPayment')}
              </Button>
            </Group>
          </Group>

        <Tabs 
          value={activeTab} 
          onChange={(value) => value && setActiveTab(value)}
          style={{
            '--mantine-tabs-list-border-color': 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Tabs.List 
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <Tabs.Tab 
              value="overview" 
              leftSection={<IconTrendingUp size={16} />}
              style={{
                color: activeTab === 'overview' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'overview' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
              {t('overview')}
            </Tabs.Tab>
            <Tabs.Tab 
              value="payments" 
              leftSection={<IconCurrencyEuro size={16} />}
              style={{
                color: activeTab === 'payments' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'payments' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
              {t('payments')}
            </Tabs.Tab>
            <Tabs.Tab 
              value="overdue" 
              leftSection={<IconAlertTriangle size={16} />}
              style={{
                color: activeTab === 'overdue' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'overdue' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
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
                  <Card 
                    shadow="lg" 
                    padding="lg" 
                    radius="md"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {t('totalRevenue')}
                        </Text>
                        <Text size="xl" fw={700} style={{ color: 'white' }}>
                          €{stats?.totalPayments?.toLocaleString() || '0'}
                        </Text>
                      </div>
                      <IconCurrencyEuro size={32} color="#10b981" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card 
                    shadow="lg" 
                    padding="lg" 
                    radius="md"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          In Attesa
                        </Text>
                        <Text size="xl" fw={700} style={{ color: 'white' }}>
                          €{stats.pendingAmount.toLocaleString()}
                        </Text>
                        <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                          {stats.pendingPayments} pagamenti
                        </Text>
                      </div>
                      <IconClock size={32} color="#3b82f6" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card 
                    shadow="lg" 
                    padding="lg" 
                    radius="md"
                    style={{
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Scaduti
                        </Text>
                        <Text size="xl" fw={700} style={{ color: '#ef4444' }}>
                          €{stats.overdueAmount.toLocaleString()}
                        </Text>
                        <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                          {stats.overduePayments} pagamenti
                        </Text>
                      </div>
                      <IconAlertTriangle size={32} color="#ef4444" />
                    </Group>
                  </Card>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <Card 
                    shadow="lg" 
                    padding="lg" 
                    radius="md"
                    style={{
                      background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(13, 148, 136, 0.1) 100%)',
                      border: '1px solid rgba(20, 184, 166, 0.2)',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          Questo Mese
                        </Text>
                        <Text size="xl" fw={700} style={{ color: 'white' }}>
                          €{stats.monthlyRevenue.toLocaleString()}
                        </Text>
                      </div>
                      <IconTrendingUp size={32} color="#14b8a6" />
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>
            ) : null}

            {/* Recent Payments */}
            <Paper 
              p="lg" 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px'
              }}
            >
              <Title order={3} mb="md" style={{ color: 'white' }}>
                Pagamenti Recenti
              </Title>
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Table 
                  striped 
                  highlightOnHover
                  style={{
                    '--table-hover-color': 'rgba(255, 255, 255, 0.05)',
                    '--table-striped-color': 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <Table.Thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                    <Table.Tr>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Studente</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Importo</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Stato</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Scadenza</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Azioni</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.slice(0, 5).map((payment) => (
                      <Table.Tr key={payment.id}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500} style={{ color: 'white' }}>
                              {payment.student.firstName} {payment.student.lastName}
                            </Text>
                            <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                              {payment.class?.name || 'Nessuna classe'}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td style={{ color: 'white', fontWeight: 500 }}>
                          €{payment.amount.toLocaleString()}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getStatusColor(payment.status)} variant="light">
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {dayjs(payment.dueDate).format('DD/MM/YYYY')}
                        </Table.Td>
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
              </div>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Paper 
              p="lg" 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px'
              }}
            >
              <LoadingOverlay visible={isLoading} />
              
              <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Table 
                  striped 
                  highlightOnHover
                  style={{
                    '--table-hover-color': 'rgba(255, 255, 255, 0.05)',
                    '--table-striped-color': 'rgba(255, 255, 255, 0.02)'
                  }}
                >
                  <Table.Thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                    <Table.Tr>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Studente</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Classe</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Importo</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Metodo</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Stato</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Scadenza</Table.Th>
                      <Table.Th style={{ color: 'white', fontWeight: 600 }}>Azioni</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {payments.map((payment) => (
                      <Table.Tr key={payment.id}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500} style={{ color: 'white' }}>
                              {payment.student.firstName} {payment.student.lastName}
                            </Text>
                            <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                              {payment.student.email}
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {payment.class?.name || '-'}
                        </Table.Td>
                        <Table.Td style={{ color: 'white', fontWeight: 500 }}>
                          €{payment.amount.toLocaleString()}
                        </Table.Td>
                        <Table.Td style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {getMethodLabel(payment.method || '')}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getStatusColor(payment.status)} variant="light">
                            {getStatusLabel(payment.status)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
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
              </div>

              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    value={currentPage}
                    onChange={setCurrentPage}
                    total={totalPages}
                    style={{
                      '--pagination-color': 'rgba(255, 255, 255, 0.8)',
                      '--pagination-hover': 'rgba(255, 255, 255, 0.1)'
                    }}
                  />
                </Group>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="overdue" pt="lg">
            <Paper 
              p="lg" 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px'
              }}
            >
              <Stack gap="md">
                <Alert 
                  icon={<IconAlertTriangle size={16} />} 
                  color="red"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5'
                  }}
                >
                  Ci sono {stats?.overduePayments || 0} pagamenti scaduti per un totale di €{stats?.overdueAmount.toLocaleString() || 0}
                </Alert>

                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <Table 
                    striped 
                    highlightOnHover
                    style={{
                      '--table-hover-color': 'rgba(255, 255, 255, 0.05)',
                      '--table-striped-color': 'rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    <Table.Thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      <Table.Tr>
                        <Table.Th style={{ color: 'white', fontWeight: 600 }}>Studente</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 600 }}>Classe</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 600 }}>Importo</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 600 }}>Giorni di ritardo</Table.Th>
                        <Table.Th style={{ color: 'white', fontWeight: 600 }}>Azioni</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {payments.filter(p => p.status === 'OVERDUE').map((payment) => (
                        <Table.Tr key={payment.id}>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500} style={{ color: 'white' }}>
                                {payment.student.firstName} {payment.student.lastName}
                              </Text>
                              <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                                {payment.student.email}
                              </Text>
                            </div>
                          </Table.Td>
                          <Table.Td style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                            {payment.class?.name || '-'}
                          </Table.Td>
                          <Table.Td style={{ color: 'white', fontWeight: 500 }}>
                            €{payment.amount.toLocaleString()}
                          </Table.Td>
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
                </div>
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
        styles={{
          content: {
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          },
          title: {
            color: 'white',
            fontSize: '1.25rem',
            fontWeight: 600,
          },
          close: {
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.1)',
            },
          },
        }}
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
              styles={{
                label: { color: 'white', fontWeight: 500 },
                input: {
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                },
                dropdown: {
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                option: {
                  color: 'white',
                  '&[data-selected]': {
                    background: 'rgba(59, 130, 246, 0.3)',
                  },
                },
              }}
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
                  styles={{
                    label: { color: 'white', fontWeight: 500 },
                    input: {
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                    },
                    section: { color: 'rgba(255, 255, 255, 0.7)' },
                  }}
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
                  styles={{
                    label: { color: 'white', fontWeight: 500 },
                    input: {
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'white',
                    },
                    dropdown: {
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                    option: {
                      color: 'white',
                      '&[data-selected]': {
                        background: 'rgba(59, 130, 246, 0.3)',
                      },
                    },
                  }}
                />
              </Grid.Col>
            </Grid>

            <TextInput
              label="Descrizione"
              placeholder="Es: Quota mensile corso inglese"
              {...form.getInputProps('description')}
              styles={{
                label: { color: 'white', fontWeight: 500 },
                input: {
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                },
              }}
            />

            <Group justify="flex-end" mt="md">
              <Button 
                variant="light" 
                onClick={closeModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  border: 'none',
                }}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                loading={isSaving}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                }}
              >
                {editingPayment ? 'Aggiorna' : 'Crea'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      </Container>
    </div>
  );
}
