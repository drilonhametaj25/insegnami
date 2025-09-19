'use client';

import React from 'react';
import { Container, Title, Card, Stack, Group, Badge, Text } from '@mantine/core';
import { AdvancedLessonCalendar } from '@/components/calendar/AdvancedLessonCalendar';
import { IconCalendarEvent, IconClock } from '@tabler/icons-react';

export default function CalendarTestPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group align="center">
          <IconCalendarEvent size={32} color="#3b82f6" />
          <div>
            <Title order={1}>Calendario Avanzato</Title>
            <Text c="dimmed">
              Test del sistema di calendario con drag & drop, gestione conflitti e lezioni ricorrenti
            </Text>
          </div>
        </Group>

        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" mb="md">
            <Group align="center">
              <IconClock size={20} />
              <Title order={3}>Calendario Completo</Title>
            </Group>
            <Group>
              <Badge color="blue" variant="light">
                Drag & Drop
              </Badge>
              <Badge color="green" variant="light">
                Conflitti
              </Badge>
              <Badge color="purple" variant="light">
                Ricorrenti
              </Badge>
            </Group>
          </Group>

          <AdvancedLessonCalendar
            height={700}
            initialView="week"
            showCreateButton={true}
            onLessonSelect={(lesson) => {
              console.log('Lezione selezionata:', lesson);
            }}
          />
        </Card>

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Title order={4}>Funzionalità Avanzate</Title>
            
            <Group gap="md">
              <div>
                <Text fw={500} size="sm">🎯 Drag & Drop</Text>
                <Text size="xs" c="dimmed">Trascina le lezioni per modificare orario</Text>
              </div>
              
              <div>
                <Text fw={500} size="sm">⚠️ Gestione Conflitti</Text>
                <Text size="xs" c="dimmed">Rilevamento automatico conflitti docente/aula</Text>
              </div>
              
              <div>
                <Text fw={500} size="sm">🔄 Ricorrenze</Text>
                <Text size="xs" c="dimmed">Creazione lezioni settimanali/mensili</Text>
              </div>
              
              <div>
                <Text fw={500} size="sm">📊 Bulk Operations</Text>
                <Text size="xs" c="dimmed">Operazioni multiple su selezione</Text>
              </div>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
