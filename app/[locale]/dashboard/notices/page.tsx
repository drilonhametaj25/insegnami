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
  Select,
  Textarea,
  Badge,
  Table,
  ActionIcon,
  Text,
  Tabs,
  Grid,
  Card,
  LoadingOverlay,
  Pagination,
  Menu,
  Divider,
  Avatar,
  Tooltip,
  Switch,
  MultiSelect,
  Skeleton,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconDownload,
  IconEye,
  IconSearch,
  IconPin,
  IconMessageCircle,
  IconAlertTriangle,
  IconSchool,
  IconMail,
  IconBell,
  IconDotsVertical,
  IconCheck,
  IconSend,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useNotices,
  useNoticeStats,
  useCreateNotice,
  useUpdateNotice,
  useDeleteNotice,
  usePublishNotice,
  useArchiveNotice,
  type Notice,
  type NoticeStats,
  type CreateNoticeData
} from '@/lib/hooks/useNotices';

interface NoticeFormData {
  title: string;
  content: string;
  type: 'GENERAL' | 'URGENT' | 'EVENT' | 'ANNOUNCEMENT';
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  publishedAt?: Date;
  expiresAt?: Date;
  targetAudience: string[];
}

export default function NoticesPage() {
  const t = useTranslations('notices');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // TanStack Query hooks
  const {
    data: noticesData,
    isLoading: noticesLoading,
    error: noticesError
  } = useNotices(currentPage, 10, {
    search: debouncedSearch,
    status: activeTab !== 'all' ? activeTab.toUpperCase() : undefined,
  });

  const {
    data: stats,
    isLoading: statsLoading
  } = useNoticeStats();

  const createNotice = useCreateNotice();
  const updateNotice = useUpdateNotice();
  const deleteNotice = useDeleteNotice();
  const publishNotice = usePublishNotice();
  const archiveNotice = useArchiveNotice();

  const notices = noticesData?.notices || [];
  const totalPages = noticesData?.pagination?.totalPages || 1;

  const form = useForm<NoticeFormData>({
    initialValues: {
      title: '',
      content: '',
      type: 'GENERAL',
      status: 'DRAFT',
      priority: 'MEDIUM',
      publishedAt: undefined,
      expiresAt: undefined,
      targetAudience: ['ALL'],
    },
    validate: {
      title: (value) => (!value ? 'Titolo richiesto' : null),
      content: (value) => (!value ? 'Contenuto richiesto' : null),
      targetAudience: (value) => (value.length === 0 ? 'Seleziona almeno un destinatario' : null),
    },
  });

  const handleSaveNotice = (values: NoticeFormData) => {
    const noticeData: CreateNoticeData = {
      title: values.title,
      content: values.content,
      type: values.type,
      status: values.status,
      priority: values.priority,
      publishedAt: values.publishedAt?.toISOString(),
      expiresAt: values.expiresAt?.toISOString(),
      targetAudience: values.targetAudience,
    };

    if (editingNotice) {
      updateNotice.mutate(
        { id: editingNotice.id, data: noticeData },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Successo',
              message: 'Avviso aggiornato con successo',
              color: 'green',
            });
            closeModal();
            form.reset();
          },
          onError: (error) => {
            notifications.show({
              title: 'Errore',
              message: error.message || 'Errore nell\'aggiornamento dell\'avviso',
              color: 'red',
            });
          },
        }
      );
    } else {
      createNotice.mutate(noticeData, {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Avviso creato con successo',
            color: 'green',
          });
          closeModal();
          form.reset();
        },
        onError: (error) => {
          notifications.show({
            title: 'Errore',
            message: error.message || 'Errore nella creazione dell\'avviso',
            color: 'red',
          });
        },
      });
    }
  };

  const handleEditNotice = (notice: Notice) => {
    setEditingNotice(notice);
    form.setValues({
      title: notice.title,
      content: notice.content,
      type: notice.type,
      status: notice.status,
      priority: notice.priority,
      publishedAt: notice.publishedAt ? new Date(notice.publishedAt) : undefined,
      expiresAt: notice.expiresAt ? new Date(notice.expiresAt) : undefined,
      targetAudience: notice.targetAudience,
    });
    openModal();
  };

  const handleDeleteNotice = (noticeId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo avviso?')) return;

    deleteNotice.mutate(noticeId, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Avviso eliminato con successo',
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nell\'eliminazione dell\'avviso',
          color: 'red',
        });
      },
    });
  };

  const handlePublishNotice = (noticeId: string) => {
    publishNotice.mutate(noticeId, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Avviso pubblicato con successo',
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nella pubblicazione dell\'avviso',
          color: 'red',
        });
      },
    });
  };

  const handleArchiveNotice = (noticeId: string) => {
    archiveNotice.mutate(noticeId, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Avviso archiviato con successo',
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nell\'archiviazione dell\'avviso',
          color: 'red',
        });
      },
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'URGENT': return 'red';
      case 'EVENT': return 'blue';
      case 'ANNOUNCEMENT': return 'green';
      case 'GENERAL': return 'gray';
      default: return 'gray';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'URGENT': return t('types.urgent');
      case 'EVENT': return t('types.event');
      case 'ANNOUNCEMENT': return t('types.announcement');
      case 'GENERAL': return t('types.general');
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return 'green';
      case 'DRAFT': return 'yellow';
      case 'ARCHIVED': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return t('statuses.published');
      case 'DRAFT': return t('statuses.draft');
      case 'ARCHIVED': return t('statuses.archived');
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'red';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'green';
      default: return 'gray';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'HIGH': return t('priorities.high');
      case 'MEDIUM': return t('priorities.medium');
      case 'LOW': return t('priorities.low');
      default: return priority;
    }
  };

  const getTargetAudienceLabel = (audience: string[]) => {
    if (!audience || !Array.isArray(audience)) return '';
    
    return audience.map(a => {
      switch (a) {
        case 'ALL': return t('audiences.all');
        case 'STUDENTS': return t('audiences.students');
        case 'TEACHERS': return t('audiences.teachers');
        case 'PARENTS': return t('audiences.parents');
        default: return a;
      }
    }).join(', ');
  };

  const isLoading = noticesLoading || statsLoading;
  const isSaving = createNotice.isPending || updateNotice.isPending || 
                   deleteNotice.isPending || publishNotice.isPending || 
                   archiveNotice.isPending;

  if (noticesError) {
    return (
      <Container size="xl" py="md">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title order={1}>Gestione Avvisi</Title>
          </Group>
          <Paper p="lg" withBorder>
            <Text c="red">Errore nel caricamento degli avvisi: {noticesError.message}</Text>
          </Paper>
        </Stack>
      </Container>
    );
  }

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
              {t('pageTitle')}
            </Title>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditingNotice(null);
                form.reset();
                openModal();
              }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
              }}
            >
              {t('createNotice')}
            </Button>
          </Group>

        {/* Statistics Cards */}
        {statsLoading ? (
          <Grid>
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
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('total')}</Text>
                    <Text size="xl" fw={700}>{stats.totalNotices}</Text>
                  </div>
                  <IconMessageCircle size={32} color="var(--mantine-color-blue-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('published')}</Text>
                    <Text size="xl" fw={700}>{stats.publishedNotices}</Text>
                  </div>
                  <IconCheck size={32} color="var(--mantine-color-green-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('drafts')}</Text>
                    <Text size="xl" fw={700}>{stats.draftNotices}</Text>
                  </div>
                  <IconEdit size={32} color="var(--mantine-color-yellow-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('urgent')}</Text>
                    <Text size="xl" fw={700}>{stats.urgentNotices}</Text>
                  </div>
                  <IconAlertTriangle size={32} color="var(--mantine-color-red-6)" />
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        ) : null}

        {/* Search and Filters */}
        <Paper p="md" withBorder>
          <Group>
            <TextInput
              placeholder="Cerca avvisi..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button variant="light" leftSection={<IconDownload size={16} />}>
              Esporta
            </Button>
          </Group>
        </Paper>

        {/* Notices Table with Tabs */}
        <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<IconMessageCircle size={16} />}>
              {t('all')} ({stats?.totalNotices || 0})
            </Tabs.Tab>
            <Tabs.Tab value="published" leftSection={<IconCheck size={16} />}>
              {t('published')} ({stats?.publishedNotices || 0})
            </Tabs.Tab>
            <Tabs.Tab value="draft" leftSection={<IconEdit size={16} />}>
              {t('drafts')} ({stats?.draftNotices || 0})
            </Tabs.Tab>
            <Tabs.Tab value="archived" leftSection={<IconTrash size={16} />}>
              {t('archived')} ({stats?.archivedNotices || 0})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value={activeTab} pt="lg">
            <Paper p="lg" withBorder>
              <LoadingOverlay visible={isLoading} />
              
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('title')}</Table.Th>
                    <Table.Th>{t('type')}</Table.Th>
                    <Table.Th>{t('status')}</Table.Th>
                    <Table.Th>{t('priority')}</Table.Th>
                    <Table.Th>{t('targetAudience')}</Table.Th>
                    <Table.Th>{t('date')}</Table.Th>
                    <Table.Th>{t('actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {notices.map((notice) => (
                    <Table.Tr key={notice.id}>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500} lineClamp={2}>
                            {notice.title}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {notice.content}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getTypeColor(notice.type)} variant="light">
                          {getTypeLabel(notice.type)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(notice.status)} variant="light">
                          {getStatusLabel(notice.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getPriorityColor(notice.priority)} variant="light" size="sm">
                          {getPriorityLabel(notice.priority)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {getTargetAudienceLabel(notice.targetAudience)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {notice.publishedAt ? 
                            dayjs(notice.publishedAt).format('DD/MM/YYYY') : 
                            dayjs(notice.createdAt).format('DD/MM/YYYY')
                          }
                        </Text>
                        {notice.expiresAt && (
                          <Text size="xs" c="dimmed">
                            {t('expires')}: {dayjs(notice.expiresAt).format('DD/MM/YYYY')}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          {notice.status === 'DRAFT' && (
                            <ActionIcon
                              variant="light"
                              color="green"
                              size="sm"
                              onClick={() => handlePublishNotice(notice.id)}
                              title={t('publish')}
                            >
                              <IconSend size={14} />
                            </ActionIcon>
                          )}
                          
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => handleEditNotice(notice)}
                            title={t('edit')}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>

                          <Menu shadow="md" width={200}>
                            <Menu.Target>
                              <ActionIcon variant="light" color="gray" size="sm">
                                <IconDotsVertical size={14} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item leftSection={<IconEye size={14} />}>
                                {t('view')}
                              </Menu.Item>
                              {notice.status === 'PUBLISHED' && (
                                <Menu.Item 
                                  leftSection={<IconPin size={14} />}
                                  onClick={() => handleArchiveNotice(notice.id)}
                                >
                                  {t('archive')}
                                </Menu.Item>
                              )}
                              <Menu.Divider />
                              <Menu.Item 
                                color="red" 
                                leftSection={<IconTrash size={14} />}
                                onClick={() => handleDeleteNotice(notice.id)}
                              >
                                {t('delete')}
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
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
        </Tabs>
      </Stack>

      {/* Notice Form Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingNotice ? t('editNotice') : t('createNotice')}
        size="lg"
      >
        <form onSubmit={form.onSubmit(handleSaveNotice)}>
          <Stack gap="md">
            <TextInput
              label={t('title')}
              placeholder={t('titlePlaceholder')}
              {...form.getInputProps('title')}
            />

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label={t('type')}
                  data={[
                    { value: 'GENERAL', label: t('types.general') },
                    { value: 'URGENT', label: t('types.urgent') },
                    { value: 'EVENT', label: t('types.event') },
                    { value: 'ANNOUNCEMENT', label: t('types.announcement') },
                  ]}
                  {...form.getInputProps('type')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label={t('priority')}
                  data={[
                    { value: 'LOW', label: t('priorities.low') },
                    { value: 'MEDIUM', label: t('priorities.medium') },
                    { value: 'HIGH', label: t('priorities.high') },
                  ]}
                  {...form.getInputProps('priority')}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label={t('status')}
                  data={[
                    { value: 'DRAFT', label: t('statuses.draft') },
                    { value: 'PUBLISHED', label: t('statuses.published') },
                    { value: 'ARCHIVED', label: t('statuses.archived') },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <MultiSelect
                  label={t('targetAudience')}
                  data={[
                    { value: 'ALL', label: t('audiences.all') },
                    { value: 'STUDENTS', label: t('audiences.students') },
                    { value: 'TEACHERS', label: t('audiences.teachers') },
                    { value: 'PARENTS', label: t('audiences.parents') },
                  ]}
                  {...form.getInputProps('targetAudience')}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label={t('content')}
              placeholder={t('contentPlaceholder')}
              {...form.getInputProps('content')}
              minRows={4}
            />

            <Grid>
              <Grid.Col span={6}>
                {form.values.status === 'PUBLISHED' && (
                  <DateTimePicker
                    label={t('publishDate')}
                    placeholder={t('selectDate')}
                    {...form.getInputProps('publishedAt')}
                  />
                )}
              </Grid.Col>
              <Grid.Col span={6}>
                <DateTimePicker
                  label={t('expiryDateOptional')}
                  placeholder={t('selectDate')}
                  {...form.getInputProps('expiresAt')}
                />
              </Grid.Col>
            </Grid>

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeModal}>
                {t('cancel')}
              </Button>
              <Button type="submit" loading={isSaving}>
                {editingNotice ? t('update') : t('create')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      </Container>
    </div>
  );
}
