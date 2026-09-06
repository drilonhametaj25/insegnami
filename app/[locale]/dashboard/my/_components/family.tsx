'use client';

// Helper condivisi del portale famiglia (/dashboard/my/*):
// selezione figlio per il genitore + fetch JSON con gestione errori.

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Select, Group, Title, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';
import { useParentMeetingOptions } from '@/lib/hooks/useParentMeetings';

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    let message = 'Errore nel caricamento dei dati';
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      // body non JSON: teniamo il messaggio generico
    }
    throw new Error(message);
  }
  return response.json();
}

export interface ChildOption {
  id: string;
  firstName: string;
  lastName: string;
}

// Stato di selezione figlio per le pagine del portale famiglia.
// Per il PARENT carica i figli da /api/parent-meetings/my-options;
// per lo STUDENT non serve alcun filtro.
export function useChildFilter() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isParent = role === 'PARENT';
  const isStudent = role === 'STUDENT';

  const optionsQuery = useParentMeetingOptions(isParent || isStudent);
  const children: ChildOption[] = optionsQuery.data?.children ?? [];

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  return {
    sessionStatus: status,
    role,
    isParent,
    isStudent,
    children,
    teachers: optionsQuery.data?.teachers ?? [],
    childrenLoading: (isParent || isStudent) && optionsQuery.isLoading,
    // Per lo STUDENT my-options ritorna il proprio profilo in children
    ownStudentId: isStudent ? children[0]?.id ?? null : null,
    selectedChildId,
    setSelectedChildId,
    // Query param pronto per le API che supportano ?studentId=
    childParam: isParent && selectedChildId ? `&studentId=${selectedChildId}` : '',
  };
}

export function ChildSelect({
  options,
  value,
  onChange,
  allowAll = true,
}: {
  options: ChildOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allowAll?: boolean;
}) {
  if (options.length <= 1) return null;

  return (
    <Select
      data-testid="my-child-select"
      label="Figlio"
      placeholder={allowAll ? 'Tutti i figli' : 'Seleziona il figlio'}
      clearable={allowAll}
      value={value}
      onChange={onChange}
      data={options.map((c) => ({
        value: c.id,
        label: `${c.firstName} ${c.lastName}`,
      }))}
      w={{ base: '100%', sm: 260 }}
    />
  );
}

export function MyPageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap">
      <Group gap="sm">
        <ThemeIcon size="xl" radius="md" variant="light">
          {icon}
        </ThemeIcon>
        <div>
          <Title order={2}>{title}</Title>
          <Text c="dimmed" size="sm">
            {subtitle}
          </Text>
        </div>
      </Group>
      {action}
    </Group>
  );
}
