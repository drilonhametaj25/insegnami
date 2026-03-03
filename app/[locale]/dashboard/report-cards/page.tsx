'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Text,
  Group,
  Button,
  Select,
  Paper,
  Grid,
  LoadingOverlay,
  Modal,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconRefresh,
  IconCheck,
  IconX,
  IconFileText,
  IconClock,
  IconEye,
  IconArchive,
  IconSend,
} from '@tabler/icons-react';
import {
  useReportCards,
  useGenerateReportCards,
  getStatusColor,
} from '@/lib/hooks/useReportCards';
import { useClasses } from '@/lib/hooks/useClasses';
import { useAcademicYears } from '@/lib/hooks/useAcademicYears';
import { ReportCardsList } from '@/components/report-cards/ReportCardsList';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

export default function ReportCardsPage() {
  const { data: session } = useSession();
  const params = useParams();
  // BUG-052 fix: Safe cast with fallback for useParams
  const locale = typeof params?.locale === 'string' ? params.locale : 'it';
  const t = useTranslations('reportCards');
  const tCommon = useTranslations('common');

  const [generateModalOpen, { open: openGenerateModal, close: closeGenerateModal }] =
    useDisclosure(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [generateClassId, setGenerateClassId] = useState<string | null>(null);
  const [generatePeriodId, setGeneratePeriodId] = useState<string | null>(null);

  const canManage =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Fetch data
  const { data: classesData } = useClasses();
  const classes = classesData?.classes || [];

  const { data: academicYearsData } = useAcademicYears();
  const currentYear = academicYearsData?.academicYears?.find((y: any) => y.isCurrent);
  const periods = currentYear?.periods || [];

  const {
    data: reportCardsData,
    isLoading,
    refetch,
  } = useReportCards({
    classId: selectedClassId || undefined,
    periodId: selectedPeriodId || undefined,
    status: filterStatus || undefined,
    page,
    limit: 20,
  });

  const generateReportCards = useGenerateReportCards();

  const handleGenerate = async () => {
    if (!generateClassId || !generatePeriodId) {
      notifications.show({
        title: 'Errore',
        message: 'Seleziona classe e periodo',
        color: 'red',
        icon: <IconX size={16} />,
      });
      return;
    }

    try {
      const result = await generateReportCards.mutateAsync({
        classId: generateClassId,
        periodId: generatePeriodId,
      });

      notifications.show({
        title: 'Successo',
        message: `Create ${result.summary.created} pagelle, ${result.summary.skipped} già esistenti`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      closeGenerateModal();
      setGenerateClassId(null);
      setGeneratePeriodId(null);
      refetch();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Generazione fallita',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const reportCards = reportCardsData?.data || [];
  const stats = reportCardsData?.stats || {
    total: 0,
    draft: 0,
    inReview: 0,
    approved: 0,
    published: 0,
    archived: 0,
  };
  const pagination = reportCardsData?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };

  const statusOptions = [
    { value: 'DRAFT', label: 'Bozza' },
    { value: 'IN_REVIEW', label: 'In Scrutinio' },
    { value: 'APPROVED', label: 'Approvata' },
    { value: 'PUBLISHED', label: 'Pubblicata' },
    { value: 'ARCHIVED', label: 'Archiviata' },
  ];

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && !reportCardsData} />

      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>{t('title')}</Title>
            <Text c="dimmed">{t('subtitle')}</Text>
          </div>
          <Group>
            {canManage && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={openGenerateModal}
              >
                {t('generate')}
              </Button>
            )}
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => refetch()}
              loading={isLoading}
            >
              {tCommon('refresh')}
            </Button>
          </Group>
        </Group>

        {/* Stats */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <ModernStatsCard
              title="Totale"
              value={stats.total}
              icon="📄"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <ModernStatsCard
              title="Bozze"
              value={stats.draft}
              icon="✏️"
              gradient="linear-gradient(135deg, #868e96 0%, #495057 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <ModernStatsCard
              title="In Scrutinio"
              value={stats.inReview}
              icon="👀"
              gradient="linear-gradient(135deg, #fab005 0%, #fd7e14 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <ModernStatsCard
              title="Approvate"
              value={stats.approved}
              icon="✅"
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 2.4 }}>
            <ModernStatsCard
              title="Pubblicate"
              value={stats.published}
              icon="📢"
              gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
            />
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Group gap="md" wrap="wrap">
            <Select
              placeholder="Filtra per classe"
              data={classes.map((c: any) => ({
                value: c.id,
                label: c.name,
              }))}
              value={selectedClassId}
              onChange={(value) => {
                setSelectedClassId(value);
                setPage(1);
              }}
              clearable
              w={200}
            />
            <Select
              placeholder="Filtra per periodo"
              data={periods.map((p: any) => ({
                value: p.id,
                label: p.name,
              }))}
              value={selectedPeriodId}
              onChange={(value) => {
                setSelectedPeriodId(value);
                setPage(1);
              }}
              clearable
              w={200}
            />
            <Select
              placeholder="Filtra per stato"
              data={statusOptions}
              value={filterStatus}
              onChange={(value) => {
                setFilterStatus(value);
                setPage(1);
              }}
              clearable
              w={200}
            />
          </Group>
        </Paper>

        {/* Report Cards List */}
        <ReportCardsList
          reportCards={reportCards}
          isLoading={isLoading}
          page={page}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          userRole={session?.user?.role || ''}
          locale={locale}
          onRefresh={() => refetch()}
        />
      </Stack>

      {/* Generate Modal */}
      <Modal
        opened={generateModalOpen}
        onClose={closeGenerateModal}
        title={t('generateForClass')}
        size="md"
      >
        <Stack gap="md">
          <Alert color="blue" icon={<IconFileText size={16} />}>
            Genera automaticamente le pagelle per tutti gli studenti della classe
            selezionata. Le medie verranno calcolate dai voti esistenti.
          </Alert>

          <Select
            label="Classe"
            placeholder="Seleziona la classe"
            data={classes.map((c: any) => ({
              value: c.id,
              label: c.name,
            }))}
            value={generateClassId}
            onChange={setGenerateClassId}
            required
          />

          <Select
            label="Periodo"
            placeholder="Seleziona il periodo"
            data={periods.map((p: any) => ({
              value: p.id,
              label: `${p.name} (${currentYear?.name})`,
            }))}
            value={generatePeriodId}
            onChange={setGeneratePeriodId}
            required
          />

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="light" onClick={closeGenerateModal}>
              Annulla
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleGenerate}
              loading={generateReportCards.isPending}
              disabled={!generateClassId || !generatePeriodId}
            >
              Genera Pagelle
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
