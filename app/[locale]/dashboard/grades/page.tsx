'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Text,
  Alert,
  LoadingOverlay,
  Grid,
  Card,
  Group,
  Select,
  Button,
  Paper,
  Badge,
  ActionIcon,
  Tooltip,
  ThemeIcon,
  Box,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconSchool,
  IconBook,
  IconChevronRight,
  IconUsers,
  IconChartBar,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

export default function GradesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('grades');
  const tCommon = useTranslations('common');

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const canManage =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'TEACHER';

  // Fetch classes
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['classes', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/classes?all=true');
      if (!response.ok) throw new Error('Errore nel caricamento delle classi');
      return response.json();
    },
    enabled: !!session?.user,
  });

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/subjects?all=true');
      if (!response.ok) throw new Error('Errore nel caricamento delle materie');
      return response.json();
    },
    enabled: !!session?.user,
  });

  // Fetch recent grades for stats
  const { data: recentGrades, isLoading: gradesLoading } = useQuery({
    queryKey: ['grades', 'recent'],
    queryFn: async () => {
      const response = await fetch('/api/grades?limit=100');
      if (!response.ok) throw new Error('Errore nel caricamento dei voti');
      return response.json();
    },
    enabled: !!session?.user,
  });

  const classes = classesData?.classes || [];
  const subjects = subjectsData?.subjects || [];
  const grades = recentGrades?.grades || [];

  // Calculate stats
  const totalGrades = recentGrades?.pagination?.total || 0;
  const todayGrades = grades.filter((g: any) => {
    const today = new Date().toDateString();
    return new Date(g.date).toDateString() === today;
  }).length;

  const avgGrade = grades.length > 0
    ? (grades.reduce((sum: number, g: any) => sum + Number(g.value), 0) / grades.length).toFixed(2)
    : '-';

  const insufficienti = grades.filter((g: any) => Number(g.value) < 6).length;

  const handleNavigateToGrid = () => {
    if (selectedClassId && selectedSubjectId) {
      router.push(`/${locale}/dashboard/grades/class/${selectedClassId}/subject/${selectedSubjectId}`);
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

  const isLoading = classesLoading || subjectsLoading;

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && classes.length === 0} />

      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>{t('title')}</Title>
            <Text c="dimmed">{t('subtitle')}</Text>
          </div>
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('totalGrades')}
              value={totalGrades}
              icon="📝"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('todayGrades')}
              value={todayGrades}
              icon="📅"
              gradient="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('averageGrade')}
              value={avgGrade}
              icon="📊"
              gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('insufficienti')}
              value={insufficienti}
              icon="⚠️"
              gradient="linear-gradient(135deg, #f56565 0%, #c53030 100%)"
            />
          </Grid.Col>
        </Grid>

        {/* Class/Subject Selection */}
        <Paper withBorder p="xl" radius="lg">
          <Stack gap="lg">
            <Group>
              <ThemeIcon size="lg" variant="light" color="blue">
                <IconChartBar size={20} />
              </ThemeIcon>
              <div>
                <Text fw={600}>{t('selectClassSubject')}</Text>
                <Text size="sm" c="dimmed">{t('selectClassSubjectDesc')}</Text>
              </div>
            </Group>

            <Grid>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Select
                  label={t('selectClass')}
                  placeholder={t('selectClassPlaceholder')}
                  data={classes.map((c: any) => ({
                    value: c.id,
                    label: `${c.name} (${c.code})`,
                  }))}
                  value={selectedClassId}
                  onChange={setSelectedClassId}
                  searchable
                  clearable
                  leftSection={<IconSchool size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Select
                  label={t('selectSubject')}
                  placeholder={t('selectSubjectPlaceholder')}
                  data={subjects.map((s: any) => ({
                    value: s.id,
                    label: `${s.name} (${s.code})`,
                  }))}
                  value={selectedSubjectId}
                  onChange={setSelectedSubjectId}
                  searchable
                  clearable
                  leftSection={<IconBook size={16} />}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 2 }}>
                <Button
                  fullWidth
                  mt={25}
                  rightSection={<IconChevronRight size={16} />}
                  disabled={!selectedClassId || !selectedSubjectId}
                  onClick={handleNavigateToGrid}
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
                >
                  {t('viewGrades')}
                </Button>
              </Grid.Col>
            </Grid>
          </Stack>
        </Paper>

        {/* Quick Access Cards */}
        <Title order={4}>{t('quickAccess')}</Title>
        <Grid>
          {classes.slice(0, 6).map((classItem: any) => (
            <Grid.Col key={classItem.id} span={{ base: 12, sm: 6, lg: 4 }}>
              <Card
                withBorder
                padding="lg"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedClassId(classItem.id)}
              >
                <Group justify="space-between" mb="xs">
                  <Group>
                    <ThemeIcon size="lg" variant="light" color="indigo">
                      <IconUsers size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>{classItem.name}</Text>
                      <Text size="xs" c="dimmed">{classItem.code}</Text>
                    </div>
                  </Group>
                  <Badge variant="light">
                    {classItem._count?.students || 0} {t('students')}
                  </Badge>
                </Group>
                {classItem.course && (
                  <Text size="sm" c="dimmed">
                    {classItem.course.name}
                  </Text>
                )}
              </Card>
            </Grid.Col>
          ))}
        </Grid>

        {/* Recent Grades */}
        {grades.length > 0 && (
          <>
            <Title order={4}>{t('recentGrades')}</Title>
            <Paper withBorder p="md" radius="md">
              <Stack gap="xs">
                {grades.slice(0, 10).map((grade: any) => (
                  <Group key={grade.id} justify="space-between" p="xs" style={{ borderBottom: '1px solid #eee' }}>
                    <Group>
                      <Badge
                        variant="filled"
                        color={Number(grade.value) < 6 ? 'red' : Number(grade.value) < 7 ? 'yellow' : 'green'}
                        size="lg"
                      >
                        {Number(grade.value).toFixed(1)}
                      </Badge>
                      <div>
                        <Text size="sm" fw={500}>
                          {grade.student?.firstName} {grade.student?.lastName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {grade.subject?.name} - {grade.class?.name}
                        </Text>
                      </div>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {new Date(grade.date).toLocaleDateString('it-IT')}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
