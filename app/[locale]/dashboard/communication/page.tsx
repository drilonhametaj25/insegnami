'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  Alert,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSend,
  IconClock,
  IconUsers,
  IconMail,
  IconMessage,
  IconTemplate,
  IconUsersGroup,
  IconEye,
  IconDotsVertical,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconArchive,
  IconShare,
  IconArrowForward,
  IconCalendar,
  IconFilter,
  IconSearch,
  IconBell,
  IconPhone,
} from '@tabler/icons-react';
import {
  useMessages,
  useMessageTemplates,
  useCommunicationGroups,
  useCreateMessage,
  useSendMessage,
  useDeleteMessage,
  type CreateMessageData,
} from '@/lib/hooks/useMessages';
  // const { data: usersData } = useUsers({ limit: 100 }); // Get users for recipient selection
  const usersData = { users: [] }; // Temporary placeholder
import { StatsCard } from '@/components/cards/StatsCard';

export default function CommunicationPage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [newMessageOpened, { open: openNewMessage, close: closeNewMessage }] = useDisclosure(false);
  const [newTemplateOpened, { open: openNewTemplate, close: closeNewTemplate }] = useDisclosure(false);
  const [newGroupOpened, { open: openNewGroup, close: closeNewGroup }] = useDisclosure(false);

  // Query hooks
  const { data: messagesData, isLoading: messagesLoading } = useMessages({
    page,
    limit: 10,
    status: selectedFilter === 'drafts' ? 'DRAFT' : 
           selectedFilter === 'scheduled' ? 'SCHEDULED' :
           selectedFilter === 'sent' ? 'SENT' : undefined,
    urgent: selectedFilter === 'urgent' ? true : undefined,
  });

  const { data: templates, isLoading: templatesLoading } = useMessageTemplates();
  const { data: groups, isLoading: groupsLoading } = useCommunicationGroups();
  // const { data: usersData } = useUsers({ limit: 100 }); // Get users for recipient selection

  // Mutation hooks
  const createMessageMutation = useCreateMessage();
  const sendMessageMutation = useSendMessage();
  const deleteMessageMutation = useDeleteMessage();

  // Forms
  const messageForm = useForm<CreateMessageData>({
    initialValues: {
      title: '',
      content: '',
      type: 'DIRECT',
      recipientIds: [],
      groupIds: [],
      sendEmail: true,
      sendSms: false,
      sendPush: true,
      priority: 0,
      isUrgent: false,
      requiresResponse: false,
    },
    validate: {
      title: (value) => (!value ? t('communication.errors.titleRequired') : null),
      content: (value) => (!value ? t('communication.errors.contentRequired') : null),
      recipientIds: (value) => (value.length === 0 ? t('communication.errors.noRecipients') : null),
    },
  });

  const templateForm = useForm({
    initialValues: {
      name: '',
      description: '',
      subject: '',
      content: '',
      type: 'MESSAGE',
      variables: [],
    },
  });

  const groupForm = useForm({
    initialValues: {
      name: '',
      description: '',
      type: 'CUSTOM',
      memberIds: [],
      autoSync: false,
    },
  });

  const handleCreateMessage = async (values: CreateMessageData) => {
    try {
      await createMessageMutation.mutateAsync(values);
      notifications.show({
        title: t('success'),
        message: t('communication.notifications.messageDraft'),
        color: 'green',
      });
      messageForm.reset();
      closeNewMessage();
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('communication.errors.sendFailed'),
        color: 'red',
      });
    }
  };

  const handleSendMessage = async (messageId: string) => {
    try {
      await sendMessageMutation.mutateAsync(messageId);
      notifications.show({
        title: t('success'),
        message: t('communication.notifications.messageSent'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('communication.errors.sendFailed'),
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      DRAFT: 'gray',
      SCHEDULED: 'blue',
      SENT: 'green',
      DELIVERED: 'teal',
      READ: 'violet',
      FAILED: 'red',
    };
    return (
      <Badge color={colors[status as keyof typeof colors] || 'gray'} variant="light">
        {t(`communication.messageStatus.${status}`)}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 0) return null;
    const colors = { 1: 'orange', 2: 'red' };
    return (
      <Badge color={colors[priority as keyof typeof colors]} variant="filled" size="sm">
        {t(`communication.priority.${priority}`)}
      </Badge>
    );
  };

  const messages = messagesData?.messages || [];
  const pagination = messagesData?.pagination;
  const users: any[] = usersData?.users || [];

  const userOptions = users.map((user: any) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName} (${user.email})`,
  }));

  // Calculate stats
  const totalMessages = pagination?.total || 0;
  const sentMessages = messages.filter(m => m.status === 'SENT').length;
  const draftMessages = messages.filter(m => m.status === 'DRAFT').length;
  const scheduledMessages = messages.filter(m => m.status === 'SCHEDULED').length;

  return (
    <Container size="xl">
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{t('communication.title')}</Title>
          <Text c="dimmed" mt="xs">
            Sistema di comunicazione avanzato per messaggi, notifiche e comunicazioni mirate
          </Text>
        </div>
        <Group>
          <Button leftSection={<IconTemplate size="1rem" />} variant="light" onClick={openNewTemplate}>
            {t('communication.templates.newTemplate')}
          </Button>
          <Button leftSection={<IconUsersGroup size="1rem" />} variant="light" onClick={openNewGroup}>
            {t('communication.groups.newGroup')}
          </Button>
          <Button leftSection={<IconPlus size="1rem" />} onClick={openNewMessage}>
            {t('communication.newMessage')}
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('communication.filters.all')}
            value={totalMessages}
            icon={<IconMessage size="1.5rem" />}
            color="blue"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('communication.filters.sent')}
            value={sentMessages}
            icon={<IconSend size="1.5rem" />}
            color="green"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('communication.filters.drafts')}
            value={draftMessages}
            icon={<IconEdit size="1.5rem" />}
            color="gray"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('communication.filters.scheduled')}
            value={scheduledMessages}
            icon={<IconClock size="1.5rem" />}
            color="orange"
          />
        </Grid.Col>
      </Grid>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'messages')}>
        <Tabs.List>
          <Tabs.Tab value="messages" leftSection={<IconMessage size="0.8rem" />}>
            {t('communication.messages')}
          </Tabs.Tab>
          <Tabs.Tab value="templates" leftSection={<IconTemplate size="0.8rem" />}>
            {t('communication.templates.title')}
          </Tabs.Tab>
          <Tabs.Tab value="groups" leftSection={<IconUsersGroup size="0.8rem" />}>
            {t('communication.groups.title')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Messages Tab */}
        <Tabs.Panel value="messages">
          <Paper withBorder p="md" mb="md">
            <Group justify="space-between">
              <Group>
                <Select
                  placeholder={t('communication.filters.all')}
                  value={selectedFilter}
                  onChange={(value) => setSelectedFilter(value || 'all')}
                  data={[
                    { value: 'all', label: t('communication.filters.all') },
                    { value: 'inbox', label: t('communication.filters.inbox') },
                    { value: 'sent', label: t('communication.filters.sent') },
                    { value: 'drafts', label: t('communication.filters.drafts') },
                    { value: 'scheduled', label: t('communication.filters.scheduled') },
                    { value: 'urgent', label: t('communication.filters.urgent') },
                  ]}
                />
                <TextInput
                  placeholder={t('search')}
                  leftSection={<IconSearch size="1rem" />}
                />
              </Group>
            </Group>
          </Paper>

          <Paper withBorder>
            <LoadingOverlay visible={messagesLoading} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('communication.messageTitle')}</Table.Th>
                  <Table.Th>{t('sender')}</Table.Th>
                  <Table.Th>{t('communication.recipients')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                  <Table.Th>{t('priority')}</Table.Th>
                  <Table.Th>{t('dateCreated')}</Table.Th>
                  <Table.Th>{t('actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {messages.map((message) => (
                  <Table.Tr key={message.id}>
                    <Table.Td>
                      <Group>
                        <div>
                          <Text fw={500}>{message.title}</Text>
                          {message.isUrgent && (
                            <Badge color="red" variant="filled" size="xs">
                              {t('urgent')}
                            </Badge>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" />
                        <div>
                          <Text size="sm">
                            {message.sender.firstName} {message.sender.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {message.sender.email}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">
                        {message._count?.recipients || 0} {t('recipients')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{getStatusBadge(message.status)}</Table.Td>
                    <Table.Td>{getPriorityBadge(message.priority)}</Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(message.createdAt).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDotsVertical size="1rem" />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={<IconEye size="1rem" />}>
                            {t('view')}
                          </Menu.Item>
                          {message.status === 'DRAFT' && (
                            <>
                              <Menu.Item leftSection={<IconEdit size="1rem" />}>
                                {t('edit')}
                              </Menu.Item>
                              <Menu.Item
                                leftSection={<IconSend size="1rem" />}
                                onClick={() => handleSendMessage(message.id)}
                                disabled={sendMessageMutation.isPending}
                              >
                                {t('communication.actions.send')}
                              </Menu.Item>
                            </>
                          )}
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<IconTrash size="1rem" />}
                            color="red"
                            onClick={() => deleteMessageMutation.mutate(message.id)}
                            disabled={message.status === 'SENT'}
                          >
                            {t('delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={pagination.totalPages}
                  size="sm"
                />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Templates Tab */}
        <Tabs.Panel value="templates">
          <Paper withBorder p="md">
            <LoadingOverlay visible={templatesLoading} />
            <Stack gap="md">
              {templates?.map((template) => (
                <Card key={template.id} withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>{template.name}</Text>
                    <Badge variant="light">
                      {template.usageCount} {t('communication.templates.usageCount')}
                    </Badge>
                  </Group>
                  {template.description && (
                    <Text size="sm" c="dimmed" mb="xs">
                      {template.description}
                    </Text>
                  )}
                  <Text size="sm" mb="xs">
                    <strong>{t('communication.templates.subject')}:</strong> {template.subject}
                  </Text>
                  <Group justify="flex-end">
                    <Button variant="light" size="xs">
                      {t('communication.templates.useTemplate')}
                    </Button>
                    <ActionIcon variant="subtle" color="red">
                      <IconTrash size="1rem" />
                    </ActionIcon>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Groups Tab */}
        <Tabs.Panel value="groups">
          <Paper withBorder p="md">
            <LoadingOverlay visible={groupsLoading} />
            <Stack gap="md">
              {groups?.map((group) => (
                <Card key={group.id} withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>{group.name}</Text>
                    <Badge variant="light">
                      {group._count?.memberships || 0} {t('communication.groups.members')}
                    </Badge>
                  </Group>
                  {group.description && (
                    <Text size="sm" c="dimmed" mb="xs">
                      {group.description}
                    </Text>
                  )}
                  <Group justify="space-between">
                    <Badge size="sm" color="blue">
                      {t(`communication.groups.groupType.${group.type}`)}
                    </Badge>
                    <Group gap="xs">
                      <Button variant="light" size="xs">
                        {t('edit')}
                      </Button>
                      <ActionIcon variant="subtle" color="red">
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* New Message Modal */}
      <Modal
        opened={newMessageOpened}
        onClose={closeNewMessage}
        title={t('communication.newMessage')}
        size="lg"
      >
        <form onSubmit={messageForm.onSubmit(handleCreateMessage)}>
          <Stack gap="md">
            <TextInput
              label={t('communication.messageTitle')}
              placeholder={t('communication.messageTitle')}
              {...messageForm.getInputProps('title')}
              required
            />

            <MultiSelect
              label={t('communication.recipients')}
              placeholder={t('communication.selectRecipients')}
              data={userOptions}
              {...messageForm.getInputProps('recipientIds')}
              searchable
              required
            />

            <Select
              label={t('type')}
              data={[
                { value: 'DIRECT', label: t('communication.messageType.DIRECT') },
                { value: 'GROUP', label: t('communication.messageType.GROUP') },
                { value: 'BROADCAST', label: t('communication.messageType.BROADCAST') },
              ]}
              {...messageForm.getInputProps('type')}
            />

            <Textarea
              label={t('communication.messageContent')}
              placeholder={t('communication.messageContent')}
              {...messageForm.getInputProps('content')}
              minRows={4}
              required
            />

            <Group>
              <Text size="sm" fw={500}>{t('communication.channels.title')}:</Text>
              <Switch
                label={t('communication.channels.email')}
                {...messageForm.getInputProps('sendEmail', { type: 'checkbox' })}
              />
              <Switch
                label={t('communication.channels.sms')}
                {...messageForm.getInputProps('sendSms', { type: 'checkbox' })}
              />
              <Switch
                label={t('communication.channels.push')}
                {...messageForm.getInputProps('sendPush', { type: 'checkbox' })}
              />
            </Group>

            <Group>
              <Switch
                label={t('urgent')}
                {...messageForm.getInputProps('isUrgent', { type: 'checkbox' })}
              />
              <Switch
                label={t('communication.requiresResponse')}
                {...messageForm.getInputProps('requiresResponse', { type: 'checkbox' })}
              />
            </Group>

            <DateTimePicker
              label={t('communication.scheduling.scheduleAt')}
              placeholder={t('communication.scheduling.sendNow')}
              {...messageForm.getInputProps('scheduledAt')}
            />

            <Group justify="flex-end">
              <Button variant="light" onClick={closeNewMessage}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                loading={createMessageMutation.isPending}
                leftSection={<IconSend size="1rem" />}
              >
                {messageForm.values.scheduledAt 
                  ? t('communication.actions.schedule') 
                  : t('communication.actions.saveDraft')
                }
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Template Modal would go here */}
      <Modal
        opened={newTemplateOpened}
        onClose={closeNewTemplate}
        title={t('communication.templates.newTemplate')}
      >
        {/* Template form implementation */}
        <Text>Template creation form coming soon...</Text>
      </Modal>

      {/* Group Modal would go here */}
      <Modal
        opened={newGroupOpened}
        onClose={closeNewGroup}
        title={t('communication.groups.newGroup')}
      >
        {/* Group form implementation */}
        <Text>Group creation form coming soon...</Text>
      </Modal>
    </Container>
  );
}
