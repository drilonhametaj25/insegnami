'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Text,
  Group,
  Button,
  Grid,
  LoadingOverlay,
  Paper,
  Breadcrumbs,
  Anchor,
  Table,
  ActionIcon,
  Tooltip,
  Badge,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconRefresh,
  IconEdit,
  IconCheck,
  IconX,
  IconDownload,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  useReportCard,
  useUpdateReportCard,
  useUpdateReportCardEntries,
  downloadReportCardPDF,
  getGradeColor,
} from '@/lib/hooks/useReportCards';
import { ReportCardPreview } from '@/components/report-cards/ReportCardPreview';
import { ScrutinioWorkflow } from '@/components/report-cards/ScrutinioWorkflow';
import { ReportCardEntryForm } from '@/components/forms/ReportCardEntryForm';

export default function ReportCardDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  // BUG-052 fix: Safe cast with fallback for useParams
  const locale = typeof params?.locale === 'string' ? params.locale : 'it';
  const reportCardId = typeof params?.id === 'string' ? params.id : '';
  const t = useTranslations('reportCards');
  const tCommon = useTranslations('common');

  const [editModalOpen, { open: openEditModal, close: closeEditModal }] =
    useDisclosure(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [overallComment, setOverallComment] = useState('');
  const [behaviorGrade, setBehaviorGrade] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: reportCard, isLoading, refetch } = useReportCard(reportCardId);
  const updateReportCard = useUpdateReportCard();
  const updateEntries = useUpdateReportCardEntries();

  const canEdit =
    reportCard?.status === 'DRAFT' &&
    ['ADMIN', 'SUPERADMIN', 'TEACHER'].includes(session?.user?.role || '');

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    openEditModal();
  };

  const handleSaveEntry = async (data: any) => {
    try {
      await updateEntries.mutateAsync({
        reportCardId,
        entries: [data],
      });

      notifications.show({
        title: 'Successo',
        message: 'Voto salvato',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      closeEditModal();
      setEditingEntry(null);
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Salvataggio fallito',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleSaveReportCard = async () => {
    try {
      await updateReportCard.mutateAsync({
        id: reportCardId,
        data: {
          overallComment: overallComment || undefined,
          behaviorGrade: behaviorGrade || undefined,
        },
      });

      notifications.show({
        title: 'Successo',
        message: 'Pagella salvata',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      setEditMode(false);
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Salvataggio fallito',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportCard) return;
    setDownloadingPdf(true);
    try {
      const filename = `pagella_${reportCard.student?.lastName}_${reportCard.student?.firstName}_${reportCard.period?.name?.replace(/\s/g, '_')}.pdf`;
      await downloadReportCardPDF(reportCardId, filename);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Download fallito',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const startEditMode = () => {
    setOverallComment(reportCard?.overallComment || '');
    setBehaviorGrade(reportCard?.behaviorGrade || '');
    setEditMode(true);
  };

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (!reportCard) {
    return (
      <Container size="xl" py="md">
        <Paper withBorder p="xl" ta="center">
          <Text c="dimmed">Pagella non trovata</Text>
          <Button
            mt="md"
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            component={Link}
            href={`/${locale}/dashboard/report-cards`}
          >
            Torna alla lista
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Anchor component={Link} href={`/${locale}/dashboard`}>
            Dashboard
          </Anchor>
          <Anchor component={Link} href={`/${locale}/dashboard/report-cards`}>
            Pagelle
          </Anchor>
          <Text>
            {reportCard.student?.lastName} {reportCard.student?.firstName}
          </Text>
        </Breadcrumbs>

        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>
              Pagella di {reportCard.student?.lastName} {reportCard.student?.firstName}
            </Title>
            <Text c="dimmed">
              {reportCard.class?.name} - {reportCard.period?.name} (
              {reportCard.period?.academicYear?.name})
            </Text>
          </div>
          <Group>
            <Button
              leftSection={<IconDownload size={16} />}
              variant="light"
              onClick={handleDownloadPDF}
              loading={downloadingPdf}
            >
              Scarica PDF
            </Button>
            <Button
              leftSection={<IconArrowLeft size={16} />}
              variant="subtle"
              component={Link}
              href={`/${locale}/dashboard/report-cards`}
            >
              Indietro
            </Button>
          </Group>
        </Group>

        <Grid>
          {/* Main Content */}
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="md">
              {/* Preview */}
              <ReportCardPreview reportCard={reportCard} />

              {/* Editable Entries Table (only in edit mode) */}
              {canEdit && (
                <Paper withBorder p="md" radius="md">
                  <Group justify="space-between" mb="md">
                    <Text fw={600}>Modifica Voti</Text>
                    {!editMode ? (
                      <Button
                        variant="light"
                        leftSection={<IconEdit size={16} />}
                        onClick={startEditMode}
                      >
                        Modifica Giudizio
                      </Button>
                    ) : (
                      <Group gap="xs">
                        <Button
                          variant="light"
                          onClick={() => setEditMode(false)}
                        >
                          Annulla
                        </Button>
                        <Button
                          leftSection={<IconDeviceFloppy size={16} />}
                          onClick={handleSaveReportCard}
                          loading={updateReportCard.isPending}
                        >
                          Salva
                        </Button>
                      </Group>
                    )}
                  </Group>

                  {editMode && (
                    <Stack gap="md" mb="md">
                      <TextInput
                        label="Voto Comportamento"
                        placeholder="Es: Ottimo, Buono, Sufficiente..."
                        value={behaviorGrade}
                        onChange={(e) => setBehaviorGrade(e.target.value)}
                      />
                      <Textarea
                        label="Giudizio Globale"
                        placeholder="Inserisci il giudizio globale dello studente..."
                        rows={3}
                        value={overallComment}
                        onChange={(e) => setOverallComment(e.target.value)}
                      />
                    </Stack>
                  )}

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Materia</Table.Th>
                        <Table.Th style={{ width: 80, textAlign: 'center' }}>
                          Media
                        </Table.Th>
                        <Table.Th style={{ width: 80, textAlign: 'center' }}>
                          Voto
                        </Table.Th>
                        <Table.Th style={{ width: 60, textAlign: 'center' }}>
                          Azioni
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {reportCard.entries?.map((entry) => {
                        const finalGrade = Number(entry.finalGrade);
                        return (
                          <Table.Tr key={entry.id}>
                            <Table.Td>
                              <Group gap="xs">
                                {entry.subject?.color && (
                                  <div
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: entry.subject.color,
                                    }}
                                  />
                                )}
                                {entry.subject?.name}
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {entry.overallAverage
                                  ? Number(entry.overallAverage).toFixed(2)
                                  : '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge
                                size="lg"
                                variant="filled"
                                color={getGradeColor(finalGrade)}
                              >
                                {finalGrade || '-'}
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Tooltip label="Modifica voto">
                                <ActionIcon
                                  variant="light"
                                  onClick={() => handleEditEntry(entry)}
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                              </Tooltip>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}
            </Stack>
          </Grid.Col>

          {/* Sidebar */}
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="md">
              {/* Workflow */}
              <ScrutinioWorkflow
                reportCardId={reportCardId}
                status={reportCard.status}
                userRole={session?.user?.role || ''}
                onStatusChange={() => refetch()}
              />

              {/* Info Card */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="md">
                  Informazioni
                </Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Creata il
                    </Text>
                    <Text size="sm">
                      {new Date(reportCard.createdAt).toLocaleDateString('it-IT')}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Ultima modifica
                    </Text>
                    <Text size="sm">
                      {new Date(reportCard.updatedAt).toLocaleDateString('it-IT')}
                    </Text>
                  </Group>
                  {reportCard.generatedAt && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        PDF generato
                      </Text>
                      <Text size="sm">
                        {new Date(reportCard.generatedAt).toLocaleDateString(
                          'it-IT'
                        )}
                      </Text>
                    </Group>
                  )}
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Numero voti
                    </Text>
                    <Text size="sm">{reportCard.entries?.length || 0}</Text>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Edit Entry Modal */}
      <ReportCardEntryForm
        opened={editModalOpen}
        onClose={() => {
          closeEditModal();
          setEditingEntry(null);
        }}
        entry={editingEntry}
        onSave={handleSaveEntry}
        loading={updateEntries.isPending}
      />
    </Container>
  );
}
