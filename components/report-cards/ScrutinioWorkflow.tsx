'use client';

import { useState } from 'react';
import {
  Paper,
  Stepper,
  Group,
  Button,
  Text,
  Stack,
  Modal,
  Textarea,
  Alert,
} from '@mantine/core';
import {
  IconEdit,
  IconEye,
  IconCheck,
  IconSend,
  IconFileText,
  IconArchive,
  IconAlertCircle,
  IconDownload,
} from '@tabler/icons-react';
import { ReportCardStatus } from '@prisma/client';
import { useApproveReportCard, downloadReportCardPDF } from '@/lib/hooks/useReportCards';
import { notifications } from '@mantine/notifications';

interface ScrutinioWorkflowProps {
  reportCardId: string;
  status: ReportCardStatus;
  userRole: string;
  onStatusChange?: () => void;
}

const WORKFLOW_STEPS = [
  { status: 'DRAFT', label: 'Bozza', icon: IconEdit },
  { status: 'IN_REVIEW', label: 'In Scrutinio', icon: IconEye },
  { status: 'APPROVED', label: 'Approvata', icon: IconCheck },
  { status: 'PUBLISHED', label: 'Pubblicata', icon: IconSend },
  { status: 'ARCHIVED', label: 'Archiviata', icon: IconArchive },
];

export function ScrutinioWorkflow({
  reportCardId,
  status,
  userRole,
  onStatusChange,
}: ScrutinioWorkflowProps) {
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const approveReportCard = useApproveReportCard();

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.status === status);

  const handleAction = async (action: string) => {
    if (action === 'reject') {
      setPendingAction(action);
      setConfirmModalOpen(true);
      return;
    }

    try {
      await approveReportCard.mutateAsync({
        id: reportCardId,
        action: action as any,
        comment: comment || undefined,
      });

      notifications.show({
        title: 'Successo',
        message: getSuccessMessage(action),
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      onStatusChange?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Operazione fallita',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    try {
      await approveReportCard.mutateAsync({
        id: reportCardId,
        action: pendingAction as any,
        comment: comment || undefined,
      });

      notifications.show({
        title: 'Successo',
        message: getSuccessMessage(pendingAction),
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setConfirmModalOpen(false);
      setComment('');
      setPendingAction(null);
      onStatusChange?.();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Operazione fallita',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      await downloadReportCardPDF(reportCardId);
      notifications.show({
        title: 'Successo',
        message: 'PDF scaricato con successo',
        color: 'green',
        icon: <IconDownload size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Download fallito',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getSuccessMessage = (action: string) => {
    switch (action) {
      case 'submit':
        return 'Pagella inviata allo scrutinio';
      case 'approve':
        return 'Pagella approvata';
      case 'reject':
        return 'Pagella rimandato in bozza';
      case 'publish':
        return 'Pagella pubblicata';
      case 'archive':
        return 'Pagella archiviata';
      default:
        return 'Operazione completata';
    }
  };

  const getAvailableActions = () => {
    const actions: Array<{
      action: string;
      label: string;
      color: string;
      icon: typeof IconSend;
      allowedRoles: string[];
    }> = [];

    switch (status) {
      case 'DRAFT':
        actions.push({
          action: 'submit',
          label: 'Invia allo Scrutinio',
          color: 'blue',
          icon: IconSend,
          allowedRoles: ['TEACHER', 'ADMIN', 'SUPERADMIN'],
        });
        break;
      case 'IN_REVIEW':
        actions.push({
          action: 'approve',
          label: 'Approva',
          color: 'green',
          icon: IconCheck,
          allowedRoles: ['ADMIN', 'SUPERADMIN'],
        });
        actions.push({
          action: 'reject',
          label: 'Richiedi Modifiche',
          color: 'orange',
          icon: IconEdit,
          allowedRoles: ['ADMIN', 'SUPERADMIN'],
        });
        break;
      case 'APPROVED':
        actions.push({
          action: 'publish',
          label: 'Pubblica',
          color: 'teal',
          icon: IconSend,
          allowedRoles: ['ADMIN', 'SUPERADMIN'],
        });
        break;
      case 'PUBLISHED':
        actions.push({
          action: 'archive',
          label: 'Archivia',
          color: 'gray',
          icon: IconArchive,
          allowedRoles: ['ADMIN', 'SUPERADMIN'],
        });
        break;
    }

    return actions.filter((a) => a.allowedRoles.includes(userRole));
  };

  const availableActions = getAvailableActions();

  return (
    <>
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Text fw={600}>Stato Approvazione</Text>

          <Stepper
            active={currentStepIndex}
            size="sm"
            styles={{
              step: {
                minWidth: 100,
              },
            }}
          >
            {WORKFLOW_STEPS.map((step, index) => (
              <Stepper.Step
                key={step.status}
                label={step.label}
                icon={<step.icon size={16} />}
                completedIcon={<IconCheck size={16} />}
                color={index <= currentStepIndex ? 'blue' : 'gray'}
              />
            ))}
          </Stepper>

          {/* Actions */}
          {availableActions.length > 0 && (
            <Group gap="sm" mt="md">
              {availableActions.map((action) => (
                <Button
                  key={action.action}
                  color={action.color}
                  leftSection={<action.icon size={16} />}
                  onClick={() => handleAction(action.action)}
                  loading={approveReportCard.isPending}
                >
                  {action.label}
                </Button>
              ))}
            </Group>
          )}

          {/* PDF Download - available for everyone who can view */}
          <Group gap="sm">
            <Button
              variant="light"
              leftSection={<IconFileText size={16} />}
              onClick={handleDownloadPDF}
              loading={downloadingPdf}
            >
              Scarica PDF
            </Button>
          </Group>

          {/* Info message based on status */}
          {status === 'DRAFT' && userRole === 'TEACHER' && (
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              Completa i voti e invia la pagella allo scrutinio quando pronta.
            </Alert>
          )}

          {status === 'IN_REVIEW' && ['ADMIN', 'SUPERADMIN'].includes(userRole) && (
            <Alert color="yellow" icon={<IconEye size={16} />}>
              Verifica i voti e approva la pagella per procedere alla pubblicazione.
            </Alert>
          )}

          {status === 'PUBLISHED' && (
            <Alert color="green" icon={<IconCheck size={16} />}>
              La pagella è stata pubblicata ed è visibile a studenti e genitori.
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Confirm Modal for reject */}
      <Modal
        opened={confirmModalOpen}
        onClose={() => {
          setConfirmModalOpen(false);
          setComment('');
          setPendingAction(null);
        }}
        title="Conferma Azione"
      >
        <Stack gap="md">
          <Text>
            {pendingAction === 'reject'
              ? 'La pagella verrà rimandata in bozza per le modifiche. Aggiungi un commento (opzionale):'
              : 'Sei sicuro di voler procedere?'}
          </Text>

          <Textarea
            placeholder="Aggiungi un commento..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                setConfirmModalOpen(false);
                setComment('');
                setPendingAction(null);
              }}
            >
              Annulla
            </Button>
            <Button
              color={pendingAction === 'reject' ? 'orange' : 'blue'}
              onClick={handleConfirmAction}
              loading={approveReportCard.isPending}
            >
              Conferma
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
