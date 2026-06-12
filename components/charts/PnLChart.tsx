'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { PnLTrendPoint } from '@/lib/hooks/useAccounting';

interface PnLChartProps {
  trend: PnLTrendPoint[];
  height?: number;
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function euro(value: unknown): string {
  const n = Number(value ?? 0);
  return `€${(isNaN(n) ? 0 : n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Trend mensile del conto economico: barre ricavi/costi + linea margine.
 * Riceve la serie `trend` di usePnL({ trend: 12 }).
 */
export function PnLChart({ trend, height = 320 }: PnLChartProps) {
  if (!trend || trend.length === 0) {
    return (
      <Stack align="center" justify="center" h={height}>
        <IconInfoCircle size={48} color="gray" />
        <Text c="dimmed">Nessun dato disponibile per il trend</Text>
      </Stack>
    );
  }

  const data = trend.map((point) => ({
    label: `${MONTH_LABELS[point.month - 1] ?? point.month} ${String(point.year).slice(-2)}`,
    Ricavi: point.revenue,
    Costi: point.cost,
    Margine: point.margin,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis />
        <RechartsTooltip formatter={(value) => euro(value)} />
        <Legend />
        <Bar dataKey="Ricavi" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Costi" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="Margine" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
