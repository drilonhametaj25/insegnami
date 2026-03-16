'use client';

import { useEffect } from 'react';
import { Container, Title, Text, Button, Stack, Group } from '@mantine/core';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <Container size="sm" py={80}>
      <Stack align="center" gap="lg">
        <Title
          order={1}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Errore nel Dashboard
        </Title>
        <Text c="dimmed" ta="center" size="lg">
          Si è verificato un problema nel caricamento della pagina.
        </Text>
        <Group>
          <Button
            onClick={reset}
            size="md"
            variant="gradient"
            gradient={{ from: '#7c3aed', to: '#a78bfa' }}
          >
            Riprova
          </Button>
          <Button
            component={Link}
            href="../dashboard"
            size="md"
            variant="outline"
            color="#7c3aed"
          >
            Torna alla Dashboard
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
