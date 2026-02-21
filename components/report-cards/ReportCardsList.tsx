'use client';

import { useState } from 'react';
import {
  Table,
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  LoadingOverlay,
  Pagination,
  Alert,
  ThemeIcon,
} from '@mantine/core';
import {
  IconEye,
  IconEdit,
  IconDownload,
  IconTrash,
  IconDotsVertical,
  IconCheck,
  IconSend,
  IconAlertCircle,
  IconFileText,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import {
  ReportCard,
  useDeleteReportCard,
  useApproveReportCard,
  downloadReportCardPDF,
  getStatusColor,
} from '@/lib/hooks/useReportCards';

interface ReportCardsListProps {
  reportCards: ReportCard[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  userRole: string;
  locale: string;
  onRefresh?: () => void;
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Bozza',
  IN_REVIEW: 'In Scrutinio',
  APPROVED: 'Approvata',
  PUBLISHED: 'Pubblicata',
  ARCHIVED: 'Archiviata',
};

export function ReportCardsList({
  reportCards,
  isLoading,
  page,
  totalPages,
  onPageChange,
  userRole,
  locale,
  onRefresh,
}: ReportCardsListProps) {
  const deleteReportCard = useDeleteReportCard();
  const approveReportCard = useApproveReportCard();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const canEdit = (rc: ReportCard) => {
    if (['ADMIN', 'SUPERADMIN'].includes(userRole)) return rc.status === 'DRAFT';
    if (userRole === 'TEACHER') return rc.status === 'DRAFT';
    return false;
  };

  const canDelete = (rc: ReportCard) => {
    return ['ADMIN', 'SUPERADMIN'].includes(userRole) && rc.status === 'DRAFT';
  };

  const canApprove = (rc: ReportCard) => {
    return ['ADMIN', 'SUPERADMIN'].includes(userRole) && rc.status === 'IN_REVIEW';
  };

  const canPublish = (rc: ReportCard) => {
    return ['ADMIN', 'SUPERADMIN'].includes(userRole) && rc.status === 'APPROVED';
  };

  const handleDelete = (rc: ReportCard) => {
    modals.openConfirmModal({
      title: 'Elimina Pagella',
      children: (
        <Text size="sm">
          Sei sicuro di voler eliminare la pagella di{' '}
          <strong>
            {rc.student?.lastName} {rc.student?.firstName}
          </strong>
          ? Questa azione non può essere annullata.
        </Text>
      ),
      labels: { confirm: 'Elimina', cancel: 'Annulla' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteReportCard.mutateAsync(rc.id);
          notifications.show({
            title: 'Successo',
            message: 'Pagella eliminata',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          onRefresh?.();
        } catch (error) {
          notifications.show({
            title: 'Errore',
            message: error instanceof Error ? error.message : 'Eliminazione fallita',
            color: 'red',
            icon: <IconAlertCircle size={16} />,
          });
        }
      },
    });
  };

  const handleQuickApprove = async (rc: ReportCard) => {
    try {
      await approveReportCard.mutateAsync({
        id: rc.id,
        action: 'approve',
      });
      notifications.show({
        title: 'Successo',
        message: 'Pagella approvata',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      onRefresh?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Approvazione fallita',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleQuickPublish = async (rc: ReportCard) => {
    try {
      await approveReportCard.mutateAsync({
        id: rc.id,
        action: 'publish',
      });
      notifications.show({
        title: 'Successo',
        message: 'Pagella pubblicata',
        color: 'green',
        icon: <IconSend size={16} />,
      });
      onRefresh?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Pubblicazione fallita',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleDownloadPDF = async (rc: ReportCard) => {
    setDownloadingId(rc.id);
    try {
      const filename = `pagella_${rc.student?.lastName}_${rc.student?.firstName}_${rc.period?.name?.replace(/\s/g, '_')}.pdf`;
      await downloadReportCardPDF(rc.id, filename);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Download fallito',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (reportCards.length === 0 && !isLoading) {
    return (
      <Paper withBorder p="xl" radius="md" ta="center">
        <ThemeIcon size={60} variant="light" color="gray" mx="auto">
          <IconFileText size={30} />
        </ThemeIcon>
        <Text c="dimmed" mt="md">
          Nessuna pagella trovata
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
      <LoadingOverlay visible={isLoading} />

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Studente</Table.Th>
            <Table.Th style={{ width: 120 }}>Classe</Table.Th>
            <Table.Th style={{ width: 150 }}>Periodo</Table.Th>
            <Table.Th style={{ width: 120 }}>Stato</Table.Th>
            <Table.Th style={{ width: 80, textAlign: 'center' }}>Voti</Table.Th>
            <Table.Th style={{ width: 120, textAlign: 'center' }}>Azioni</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {reportCards.map((rc) => (
            <Table.Tr key={rc.id}>
              <Table.Td>
                <div>
                  <Text size="sm" fw={500}>
                    {rc.student?.lastName} {rc.student?.firstName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {rc.student?.studentCode}
                  </Text>
                </div>
              </Table.Td>
              <Table.Td>
                <Badge variant="light">{rc.class?.name}</Badge>
              </Table.Td>
              <Table.Td>
                <div>
                  <Text size="sm">{rc.period?.name}</Text>
                  <Text size="xs" c="dimmed">
                    {rc.period?.academicYear?.name}
                  </Text>
                </div>
              </Table.Td>
              <Table.Td>
                <Badge color={getStatusColor(rc.status)} variant="filled">
                  {statusLabels[rc.status]}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm">{rc._count?.entries || rc.entries?.length || 0}</Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="center">
                  <Tooltip label="Visualizza">
                    <ActionIcon
                      variant="light"
                      component={Link}
                      href={`/${locale}/dashboard/report-cards/${rc.id}`}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Tooltip>

                  {canEdit(rc) && (
                    <Tooltip label="Modifica">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        component={Link}
                        href={`/${locale}/dashboard/report-cards/${rc.id}`}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}

                  <Tooltip label="Scarica PDF">
                    <ActionIcon
                      variant="light"
                      color="teal"
                      onClick={() => handleDownloadPDF(rc)}
                      loading={downloadingId === rc.id}
                    >
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>

                  {(canApprove(rc) || canPublish(rc) || canDelete(rc)) && (
                    <Menu shadow="md" width={180} position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        {canApprove(rc) && (
                          <Menu.Item
                            leftSection={<IconCheck size={14} />}
                            color="green"
                            onClick={() => handleQuickApprove(rc)}
                          >
                            Approva
                          </Menu.Item>
                        )}

                        {canPublish(rc) && (
                          <Menu.Item
                            leftSection={<IconSend size={14} />}
                            color="teal"
                            onClick={() => handleQuickPublish(rc)}
                          >
                            Pubblica
                          </Menu.Item>
                        )}

                        {canDelete(rc) && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={14} />}
                              color="red"
                              onClick={() => handleDelete(rc)}
                            >
                              Elimina
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && (
        <Group justify="center" p="md">
          <Pagination
            value={page}
            onChange={onPageChange}
            total={totalPages}
            size="sm"
          />
        </Group>
      )}
    </Paper>
  );
}
