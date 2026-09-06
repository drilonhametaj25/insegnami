'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Container,
  Title,
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Table,
  Tabs,
  Button,
  Skeleton,
  Alert,
  ThemeIcon,
  Select,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconRobot,
  IconAlertCircle,
  IconMail,
  IconListDetails,
  IconRefresh,
  IconPlayerPlay,
  IconHeartRateMonitor,
} from '@tabler/icons-react';

// Pagina automazioni: SUPERADMIN (vista piattaforma) e ADMIN (vista tenant).
// Voce sidebar da aggiungere a parte: path /dashboard/automations.

interface AutomationRun {
  id: string;
  jobName: string;
  tenantId: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  error: string | null;
}

interface WorkerHeartbeat {
  lastBeat: string | null;
  freshSeconds: number | null;
  healthy: boolean;
}

interface AutomationData {
  scope: 'platform' | 'tenant';
  recentRuns: AutomationRun[];
  lastDailyRun: { startedAt: string; finishedAt: string | null } | null;
  workerHeartbeat: WorkerHeartbeat;
}

interface EmailLogRow {
  id: string;
  to: string;
  subject: string;
  sourceType: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

const RUN_STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'teal',
  FAILED: 'red',
  RUNNING: 'blue',
};

const LOG_STATUS_COLORS: Record<string, string> = {
  SENT: 'teal',
  QUEUED: 'blue',
  FAILED: 'red',
};

const CRON_JOBS = [
  'daily-automation',
  'mark-payments-overdue',
  'parent-attendance-digest',
  'deactivate-expired-tenants',
  'auto-complete-lessons',
  'trial-ending-reminder',
  'cleanup-notifications',
  'retention-automation-runs',
  'email-queue-clean',
  'expire-stale-subscriptions',
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('it-IT');
}

function durationSeconds(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '—';
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function AutomationsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [data, setData] = useState<AutomationData | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [triggerJob, setTriggerJob] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const loadAutomation = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [meRes, runsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/automation/runs'),
      ]);
      if (!meRes.ok) throw new Error('Impossibile verificare il profilo');
      if (runsRes.status === 403) {
        throw new Error('Accesso riservato agli amministratori');
      }
      if (!runsRes.ok) throw new Error('Impossibile caricare le automazioni');
      const me = await meRes.json();
      const runs = await runsRes.json();
      setRole(me?.user?.role ?? null);
      setData({
        scope: runs.meta?.scope ?? 'tenant',
        recentRuns: runs.data ?? [],
        lastDailyRun: runs.meta?.lastDailyRun ?? null,
        workerHeartbeat: runs.meta?.workerHeartbeat ?? {
          lastBeat: null,
          freshSeconds: null,
          healthy: false,
        },
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Errore di caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmailLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/email-log?limit=50');
      if (!res.ok) {
        setEmailLogs([]);
        return;
      }
      const json = await res.json();
      setEmailLogs(json.data ?? []);
    } catch {
      setEmailLogs([]);
    }
  }, []);

  useEffect(() => {
    void loadAutomation();
  }, [loadAutomation]);

  const handleTrigger = async () => {
    if (!triggerJob) return;
    setTriggering(true);
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger-cron', data: { jobName: triggerJob } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.show({
          title: 'Errore',
          message: json?.error || 'Impossibile accodare il job',
          color: 'red',
        });
        return;
      }
      notifications.show({
        title: 'Job accodato',
        message: json?.message || `${triggerJob} in esecuzione`,
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Errore di rete durante il trigger del job',
        color: 'red',
      });
    } finally {
      setTriggering(false);
    }
  };

  const heartbeat = data?.workerHeartbeat;

  return (
    <Container size="xl" py="md">
      <Group gap="sm" mb="lg" justify="space-between">
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="navy">
            <IconRobot size={22} />
          </ThemeIcon>
          <Title order={2}>Automazioni</Title>
          {data && (
            <Badge variant="light" color="gray">
              {data.scope === 'platform' ? 'Piattaforma' : 'La tua scuola'}
            </Badge>
          )}
        </Group>
        <Group gap="sm">
          {heartbeat && (
            <Tooltip
              label={
                heartbeat.lastBeat
                  ? `Ultimo battito: ${formatDate(heartbeat.lastBeat)}`
                  : 'Nessun battito registrato'
              }
            >
              <Badge
                variant="light"
                color={heartbeat.healthy ? 'teal' : 'red'}
                leftSection={<IconHeartRateMonitor size={14} />}
                data-testid="automations-worker-health"
              >
                Worker {heartbeat.healthy ? 'attivo' : 'non attivo'}
              </Badge>
            </Tooltip>
          )}
          <Button
            variant="light"
            size="xs"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void loadAutomation();
              if (emailLogs !== null) void loadEmailLogs();
            }}
            data-testid="automations-refresh"
          >
            Aggiorna
          </Button>
        </Group>
      </Group>

      {loadError ? (
        <Alert variant="light" color="red" icon={<IconAlertCircle size={18} />} title="Errore">
          {loadError}
        </Alert>
      ) : (
        <Stack gap="lg">
          {role === 'SUPERADMIN' && (
            <Card withBorder padding="lg">
              <Text fw={600} mb="xs">
                Esecuzione manuale
              </Text>
              <Text fz="sm" c="dimmed" mb="md">
                Accoda subito un job ricorrente (solo Super Admin).
              </Text>
              <Group gap="sm" align="flex-end">
                <Select
                  label="Job"
                  placeholder="Scegli un job"
                  data={CRON_JOBS}
                  value={triggerJob}
                  onChange={setTriggerJob}
                  w={280}
                  data-testid="automations-trigger-select"
                />
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  loading={triggering}
                  disabled={!triggerJob}
                  onClick={handleTrigger}
                  data-testid="automations-trigger-run"
                >
                  Esegui ora
                </Button>
              </Group>
            </Card>
          )}

          <Card withBorder padding="lg">
            <Tabs
              defaultValue="runs"
              onChange={(tab) => {
                if (tab === 'email' && emailLogs === null) void loadEmailLogs();
              }}
            >
              <Tabs.List>
                <Tabs.Tab value="runs" leftSection={<IconListDetails size={16} />}>
                  Esecuzioni
                </Tabs.Tab>
                <Tabs.Tab
                  value="email"
                  leftSection={<IconMail size={16} />}
                  data-testid="automations-tab-email"
                >
                  Registro email
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="runs" pt="md">
                {loading ? (
                  <Stack gap="xs">
                    <Skeleton height={28} radius="sm" />
                    <Skeleton height={28} radius="sm" />
                    <Skeleton height={28} radius="sm" />
                  </Stack>
                ) : !data || data.recentRuns.length === 0 ? (
                  <Text c="dimmed" fz="sm">
                    Nessuna esecuzione registrata
                    {data?.scope === 'tenant'
                      ? ' per la tua scuola (i job di piattaforma non compaiono qui).'
                      : '.'}
                  </Text>
                ) : (
                  <Table.ScrollContainer minWidth={640}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Job</Table.Th>
                          <Table.Th>Avvio</Table.Th>
                          <Table.Th>Durata</Table.Th>
                          <Table.Th>Esito</Table.Th>
                          <Table.Th>Errore</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {data.recentRuns.map((run) => (
                          <Table.Tr key={run.id}>
                            <Table.Td>
                              <Text fz="sm" ff="monospace">
                                {run.jobName}
                              </Text>
                            </Table.Td>
                            <Table.Td>{formatDate(run.startedAt)}</Table.Td>
                            <Table.Td>{durationSeconds(run.startedAt, run.finishedAt)}</Table.Td>
                            <Table.Td>
                              <Badge variant="light" color={RUN_STATUS_COLORS[run.status] ?? 'gray'}>
                                {run.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="xs" c="red" lineClamp={2}>
                                {run.error ?? ''}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="email" pt="md">
                {emailLogs === null ? (
                  <Stack gap="xs">
                    <Skeleton height={28} radius="sm" />
                    <Skeleton height={28} radius="sm" />
                  </Stack>
                ) : emailLogs.length === 0 ? (
                  <Text c="dimmed" fz="sm">
                    Nessuna email registrata.
                  </Text>
                ) : (
                  <Table.ScrollContainer minWidth={640}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Destinatario</Table.Th>
                          <Table.Th>Oggetto</Table.Th>
                          <Table.Th>Origine</Table.Th>
                          <Table.Th>Stato</Table.Th>
                          <Table.Th>Data</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {emailLogs.map((log) => (
                          <Table.Tr key={log.id}>
                            <Table.Td>
                              <Text fz="sm" style={{ wordBreak: 'break-all' }}>
                                {log.to}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="sm" lineClamp={1}>
                                {log.subject}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fz="xs" c="dimmed">
                                {log.sourceType ?? '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Tooltip label={log.error ?? ''} disabled={!log.error}>
                                <Badge
                                  variant="light"
                                  color={LOG_STATUS_COLORS[log.status] ?? 'gray'}
                                >
                                  {log.status}
                                </Badge>
                              </Tooltip>
                            </Table.Td>
                            <Table.Td>{formatDate(log.sentAt ?? log.createdAt)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </Stack>
      )}
    </Container>
  );
}
