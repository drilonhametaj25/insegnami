'use client';

import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Table,
  Divider,
  Box,
  Title,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconSchool, IconUser, IconCalendar, IconFileText } from '@tabler/icons-react';
import { ReportCard, getStatusColor, getGradeColor } from '@/lib/hooks/useReportCards';

interface ReportCardPreviewProps {
  reportCard: ReportCard;
  showHeader?: boolean;
  compact?: boolean;
}

export function ReportCardPreview({
  reportCard,
  showHeader = true,
  compact = false,
}: ReportCardPreviewProps) {
  const statusLabels: Record<string, string> = {
    DRAFT: 'Bozza',
    IN_REVIEW: 'In Scrutinio',
    APPROVED: 'Approvata',
    PUBLISHED: 'Pubblicata',
    ARCHIVED: 'Archiviata',
  };

  // Calculate overall average from entries
  const calculateOverallAverage = () => {
    if (!reportCard.entries || reportCard.entries.length === 0) return null;
    const validGrades = reportCard.entries.filter((e) => Number(e.finalGrade) > 0);
    if (validGrades.length === 0) return null;
    const sum = validGrades.reduce((acc, e) => acc + Number(e.finalGrade), 0);
    return (sum / validGrades.length).toFixed(2);
  };

  const overallAverage = calculateOverallAverage();

  return (
    <Paper
      withBorder
      radius="md"
      style={{
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
      }}
    >
      {/* Header */}
      {showHeader && (
        <Box
          p="md"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="sm" fw={500} style={{ opacity: 0.9 }}>
                {reportCard.tenant?.name || 'Scuola'}
              </Text>
              <Title order={3} mt={4}>
                PAGELLA SCOLASTICA
              </Title>
              <Text size="sm" mt={4}>
                {reportCard.period?.name} - {reportCard.period?.academicYear?.name}
              </Text>
            </div>
            <Badge
              color={getStatusColor(reportCard.status)}
              variant="filled"
              size="lg"
            >
              {statusLabels[reportCard.status]}
            </Badge>
          </Group>
        </Box>
      )}

      {/* Student Info */}
      <Box p="md" bg="gray.0">
        <Group gap="xl" wrap="wrap">
          <Group gap="xs">
            <ThemeIcon variant="light" size="sm">
              <IconUser size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Studente
              </Text>
              <Text size="sm" fw={600}>
                {reportCard.student?.lastName} {reportCard.student?.firstName}
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            <ThemeIcon variant="light" size="sm">
              <IconSchool size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Classe
              </Text>
              <Text size="sm" fw={600}>
                {reportCard.class?.name}
              </Text>
            </div>
          </Group>

          <Group gap="xs">
            <ThemeIcon variant="light" size="sm">
              <IconCalendar size={14} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">
                Matricola
              </Text>
              <Text size="sm" fw={600}>
                {reportCard.student?.studentCode}
              </Text>
            </div>
          </Group>

          {overallAverage && (
            <Group gap="xs">
              <ThemeIcon variant="light" size="sm" color={getGradeColor(parseFloat(overallAverage))}>
                <IconFileText size={14} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Media Generale
                </Text>
                <Text size="sm" fw={600} c={getGradeColor(parseFloat(overallAverage))}>
                  {overallAverage}
                </Text>
              </div>
            </Group>
          )}
        </Group>
      </Box>

      <Divider />

      {/* Grades Table */}
      <Box p={compact ? 'sm' : 'md'}>
        <Text fw={600} mb="sm">
          Valutazioni
        </Text>

        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Materia</Table.Th>
              {!compact && (
                <>
                  <Table.Th style={{ width: 70, textAlign: 'center' }}>Orale</Table.Th>
                  <Table.Th style={{ width: 70, textAlign: 'center' }}>Scritto</Table.Th>
                  <Table.Th style={{ width: 70, textAlign: 'center' }}>Pratico</Table.Th>
                  <Table.Th style={{ width: 70, textAlign: 'center' }}>Media</Table.Th>
                </>
              )}
              <Table.Th style={{ width: 70, textAlign: 'center' }}>Voto</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {reportCard.entries?.map((entry) => {
              const finalGrade = Number(entry.finalGrade);
              const gradeColor = getGradeColor(finalGrade);

              return (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {entry.subject?.color && (
                        <Box
                          w={8}
                          h={8}
                          style={{
                            borderRadius: '50%',
                            backgroundColor: entry.subject.color,
                          }}
                        />
                      )}
                      <Text size="sm">{entry.subject?.name}</Text>
                    </Group>
                  </Table.Td>
                  {!compact && (
                    <>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="dimmed">
                          {entry.averageOral ? Number(entry.averageOral).toFixed(1) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="dimmed">
                          {entry.averageWritten ? Number(entry.averageWritten).toFixed(1) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="dimmed">
                          {entry.averagePractical ? Number(entry.averagePractical).toFixed(1) : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" fw={500}>
                          {entry.overallAverage ? Number(entry.overallAverage).toFixed(2) : '-'}
                        </Text>
                      </Table.Td>
                    </>
                  )}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Tooltip
                      label={entry.teacherComment || 'Nessun commento'}
                      disabled={!entry.teacherComment}
                    >
                      <Badge
                        size="lg"
                        variant="filled"
                        color={gradeColor}
                        style={{ minWidth: 40 }}
                      >
                        {finalGrade || '-'}
                      </Badge>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Behavior and Comments */}
      {(reportCard.behaviorGrade || reportCard.overallComment) && (
        <>
          <Divider />
          <Box p={compact ? 'sm' : 'md'}>
            <Stack gap="sm">
              {reportCard.behaviorGrade && (
                <Group gap="md">
                  <Text size="sm" fw={500}>
                    Comportamento:
                  </Text>
                  <Badge variant="light" size="lg">
                    {reportCard.behaviorGrade}
                  </Badge>
                </Group>
              )}

              {reportCard.overallComment && (
                <div>
                  <Text size="sm" fw={500} mb={4}>
                    Giudizio Globale:
                  </Text>
                  <Text size="sm" c="dimmed" style={{ fontStyle: 'italic' }}>
                    "{reportCard.overallComment}"
                  </Text>
                </div>
              )}
            </Stack>
          </Box>
        </>
      )}

      {/* Footer with approval info */}
      {reportCard.approvedAt && (
        <>
          <Divider />
          <Box p="sm" bg="gray.0">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Approvato il:{' '}
                {new Date(reportCard.approvedAt).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Text size="xs" c="dimmed">
                Il Dirigente Scolastico
              </Text>
            </Group>
          </Box>
        </>
      )}
    </Paper>
  );
}
