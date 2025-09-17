'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Paper, Title as MantineTitle, Text, Group, Stack, Grid } from '@mantine/core';
import { IconUsers, IconCoin, IconCalendar, IconTrendingUp } from '@tabler/icons-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  LineElement,
  PointElement
);

interface AttendanceChartProps {
  data: {
    labels: string[];
    attendanceRates: number[];
  };
  title?: string;
}

export function AttendanceChart({ data, title = 'Tasso di Presenza per Classe' }: AttendanceChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Tasso di Presenza (%)',
        data: data.attendanceRates,
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  return (
    <Paper p="md" withBorder>
      <Bar data={chartData} options={options} />
    </Paper>
  );
}

interface PaymentStatusChartProps {
  data: {
    paid: number;
    pending: number;
    overdue: number;
  };
  title?: string;
}

export function PaymentStatusChart({ data, title = 'Status Pagamenti' }: PaymentStatusChartProps) {
  const chartData = {
    labels: ['Pagati', 'In Attesa', 'Scaduti'],
    datasets: [
      {
        data: [data.paid, data.pending, data.overdue],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
  };

  return (
    <Paper p="md" withBorder>
      <Pie data={chartData} options={options} />
    </Paper>
  );
}

interface EnrollmentTrendProps {
  data: {
    labels: string[];
    enrollments: number[];
  };
  title?: string;
}

export function EnrollmentTrend({ data, title = 'Andamento Iscrizioni' }: EnrollmentTrendProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Nuove Iscrizioni',
        data: data.enrollments,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <Paper p="md" withBorder>
      <Line data={chartData} options={options} />
    </Paper>
  );
}

interface RevenueChartProps {
  data: {
    labels: string[];
    revenue: number[];
  };
  title?: string;
}

export function RevenueChart({ data, title = 'Ricavi Mensili' }: RevenueChartProps) {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'Ricavi (€)',
        data: data.revenue,
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return '€' + value.toLocaleString();
          },
        },
      },
    },
  };

  return (
    <Paper p="md" withBorder>
      <Bar data={chartData} options={options} />
    </Paper>
  );
}

interface DashboardChartsProps {
  attendanceData?: {
    labels: string[];
    attendanceRates: number[];
  };
  paymentData?: {
    paid: number;
    pending: number;
    overdue: number;
  };
  enrollmentData?: {
    labels: string[];
    enrollments: number[];
  };
  revenueData?: {
    labels: string[];
    revenue: number[];
  };
}

export function DashboardCharts({
  attendanceData,
  paymentData,
  enrollmentData,
  revenueData,
}: DashboardChartsProps) {
  // Sample data if not provided
  const defaultAttendanceData = {
    labels: ['Inglese A1', 'Inglese B1', 'Inglese B2', 'Spagnolo A1'],
    attendanceRates: [85, 92, 78, 88],
  };

  const defaultPaymentData = {
    paid: 150,
    pending: 25,
    overdue: 8,
  };

  const defaultEnrollmentData = {
    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
    enrollments: [12, 18, 25, 22, 30, 28],
  };

  const defaultRevenueData = {
    labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
    revenue: [8500, 12300, 15200, 13800, 18500, 16700],
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <MantineTitle order={2}>Statistiche e Grafici</MantineTitle>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <AttendanceChart data={attendanceData || defaultAttendanceData} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <PaymentStatusChart data={paymentData || defaultPaymentData} />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <EnrollmentTrend data={enrollmentData || defaultEnrollmentData} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <RevenueChart data={revenueData || defaultRevenueData} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

// KPI Cards component
interface KPICardsProps {
  stats?: {
    totalStudents?: number;
    totalRevenue?: number;
    totalClasses?: number;
    averageAttendance?: number;
  };
}

export function KPICards({ stats }: KPICardsProps) {
  const defaultStats = {
    totalStudents: 183,
    totalRevenue: 84700,
    totalClasses: 12,
    averageAttendance: 85.5,
  };

  const data = stats || defaultStats;

  const kpis = [
    {
      title: 'Studenti Totali',
      value: data.totalStudents,
      icon: IconUsers,
      color: 'blue',
    },
    {
      title: 'Ricavi Totali',
      value: `€${data.totalRevenue?.toLocaleString()}`,
      icon: IconCoin,
      color: 'green',
    },
    {
      title: 'Classi Attive',
      value: data.totalClasses,
      icon: IconCalendar,
      color: 'violet',
    },
    {
      title: 'Presenza Media',
      value: `${data.averageAttendance}%`,
      icon: IconTrendingUp,
      color: 'orange',
    },
  ];

  return (
    <Grid>
      {kpis.map((kpi, index) => (
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
          <Paper p="md" withBorder>
            <Group justify="space-between">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  {kpi.title}
                </Text>
                <Text size="xl" fw={700}>
                  {kpi.value}
                </Text>
              </Stack>
              <kpi.icon size={32} color={`var(--mantine-color-${kpi.color}-6)`} />
            </Group>
          </Paper>
        </Grid.Col>
      ))}
    </Grid>
  );
}
