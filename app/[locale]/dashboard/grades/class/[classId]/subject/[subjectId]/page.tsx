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
  Alert,
  LoadingOverlay,
  Grid,
  Paper,
  Group,
  Badge,
  Button,
  Table,
  ActionIcon,
  Tooltip,
  Select,
  Progress,
  Card,
  ThemeIcon,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconChartBar,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCurrentAcademicYear } from '@/lib/hooks/useAcademicYears';
import {
  useClassSubjectGrades,
  useCreateGrade,
  useUpdateGrade,
  useDeleteGrade,
  Grade,
  getGradeColor,
} from '@/lib/hooks/useGrades';
import { GradeForm } from '@/components/forms/GradeForm';
import { GradeCell, GradeAverage } from '@/components/grades/GradeCell';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

export default function ClassGradesPage() {
  const { data: session } = useSession();
  const params = useParams();
  // BUG-052 fix: Safe cast with fallback for useParams
  const locale = typeof params?.locale === 'string' ? params.locale : 'it';
  const classId = typeof params?.classId === 'string' ? params.classId : '';
  const subjectId = typeof params?.subjectId === 'string' ? params.subjectId : '';
  const t = useTranslations('grades');
  const tCommon = useTranslations('common');

  const [opened, { open, close }] = useDisclosure(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const canManage =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'TEACHER';

  // Fetch current academic year for period selection
  const { data: currentYear } = useCurrentAcademicYear();

  // Fetch class grades
  const {
    data: classGrades,
    isLoading,
    refetch,
  } = useClassSubjectGrades(classId, subjectId, {
    periodId: selectedPeriodId || undefined,
  });

  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const deleteGrade = useDeleteGrade();

  const handleAddGrade = (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
    setEditingGrade(null);
    open();
  };

  const handleEditGrade = (grade: Grade) => {
    setEditingGrade(grade);
    setSelectedStudent({
      id: grade.studentId,
      name: `${grade.student?.firstName} ${grade.student?.lastName}`,
    });
    open();
  };

  const handleDeleteGrade = (grade: Grade) => {
    modals.openConfirmModal({
      title: t('confirmDelete'),
      children: <Text size="sm">{t('confirmDeleteMessage')}</Text>,
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteGrade.mutateAsync(grade.id);
          notifications.show({
            title: tCommon('success'),
            message: t('deleteSuccess'),
            color: 'green',
            icon: <IconCheck />,
          });
        } catch (error) {
          notifications.show({
            title: tCommon('error'),
            message: error instanceof Error ? error.message : t('deleteError'),
            color: 'red',
            icon: <IconX />,
          });
        }
      },
    });
  };

  const handleSaveGrade = async (data: any) => {
    if (!selectedStudent) return;

    if (editingGrade) {
      await updateGrade.mutateAsync({
        id: editingGrade.id,
        data,
      });
    } else {
      await createGrade.mutateAsync({
        ...data,
        studentId: selectedStudent.id,
        classId,
        subjectId,
        periodId: selectedPeriodId,
      });
    }
  };

  if (!canManage) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          {t('noPermission')}
        </Alert>
      </Container>
    );
  }

  const statistics = classGrades?.statistics;
  const students = classGrades?.students || [];

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && !classGrades} />

      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              component={Link}
              href={`/${locale}/dashboard/grades`}
            >
              {tCommon('back')}
            </Button>
            <div>
              <Title order={2}>
                {classGrades?.class?.name} - {classGrades?.subject?.name}
              </Title>
              <Text c="dimmed">{t('classGradesGrid')}</Text>
            </div>
          </Group>
          <Group>
            {currentYear?.periods && currentYear.periods.length > 0 && (
              <Select
                placeholder={t('allPeriods')}
                data={currentYear.periods.map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                value={selectedPeriodId}
                onChange={setSelectedPeriodId}
                clearable
                w={200}
              />
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
        {statistics && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('students')}
                value={statistics.totalStudents}
                icon="👥"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('classAverage')}
                value={statistics.classAverage?.toFixed(2) || '-'}
                icon="📊"
                gradient={`linear-gradient(135deg, ${statistics.classAverage && statistics.classAverage >= 6 ? '#48bb78' : '#f56565'} 0%, ${statistics.classAverage && statistics.classAverage >= 6 ? '#38a169' : '#c53030'} 100%)`}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <Card withBorder radius="md" p="md">
                <Text size="sm" c="dimmed" mb="xs">{t('distribution')}</Text>
                <Group gap="xs" wrap="nowrap">
                  <Tooltip label={`Insufficienti: ${statistics.distribution.insufficienti}`}>
                    <Progress
                      value={(statistics.distribution.insufficienti / statistics.studentsWithGrades) * 100 || 0}
                      color="red"
                      size="lg"
                      style={{ flex: 1 }}
                    />
                  </Tooltip>
                  <Tooltip label={`Sufficienti: ${statistics.distribution.sufficienti}`}>
                    <Progress
                      value={(statistics.distribution.sufficienti / statistics.studentsWithGrades) * 100 || 0}
                      color="yellow"
                      size="lg"
                      style={{ flex: 1 }}
                    />
                  </Tooltip>
                  <Tooltip label={`Buoni: ${statistics.distribution.buoni}`}>
                    <Progress
                      value={(statistics.distribution.buoni / statistics.studentsWithGrades) * 100 || 0}
                      color="lime"
                      size="lg"
                      style={{ flex: 1 }}
                    />
                  </Tooltip>
                  <Tooltip label={`Ottimi: ${statistics.distribution.ottimi}`}>
                    <Progress
                      value={(statistics.distribution.ottimi / statistics.studentsWithGrades) * 100 || 0}
                      color="green"
                      size="lg"
                      style={{ flex: 1 }}
                    />
                  </Tooltip>
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('insufficienti')}
                value={statistics.distribution.insufficienti}
                icon="⚠️"
                gradient="linear-gradient(135deg, #f56565 0%, #c53030 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        {/* Students Table with Grades */}
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 200 }}>Studente</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Media</Table.Th>
                <Table.Th>Voti</Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.map((student) => (
                <Table.Tr key={student.id}>
                  <Table.Td>
                    <div>
                      <Text fw={500}>{student.lastName} {student.firstName}</Text>
                      <Text size="xs" c="dimmed">{student.studentCode}</Text>
                    </div>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <GradeAverage
                      average={student.average}
                      size="md"
                      label={`Media: ${student.average?.toFixed(2) || '-'} (${student.gradeCount} voti)`}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="wrap">
                      {student.grades.map((grade) => (
                        <GradeCell
                          key={grade.id}
                          grade={grade}
                          onClick={handleEditGrade}
                          size="sm"
                        />
                      ))}
                      {student.grades.length === 0 && (
                        <Text size="sm" c="dimmed">{t('noGrades')}</Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Tooltip label={t('addGrade')}>
                      <ActionIcon
                        variant="light"
                        color="green"
                        onClick={() =>
                          handleAddGrade(
                            student.id,
                            `${student.firstName} ${student.lastName}`
                          )
                        }
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {students.length === 0 && !isLoading && (
          <Paper withBorder p="xl" radius="md" ta="center">
            <ThemeIcon size={60} variant="light" color="gray" mx="auto">
              <IconUsers size={30} />
            </ThemeIcon>
            <Text c="dimmed" mt="md">Nessuno studente in questa classe</Text>
          </Paper>
        )}
      </Stack>

      {/* Grade Form Modal */}
      <GradeForm
        opened={opened}
        onClose={close}
        grade={editingGrade}
        studentName={selectedStudent?.name}
        subjectName={classGrades?.subject?.name}
        onSave={handleSaveGrade}
        loading={createGrade.isPending || updateGrade.isPending}
      />
    </Container>
  );
}
