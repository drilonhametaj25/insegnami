'use client';

import { Container, Title, Text, Button, Stack } from '@mantine/core';
import Link from 'next/link';

export default function LocaleNotFound() {
  return (
    <Container size="sm" py={80}>
      <Stack align="center" gap="lg">
        <Title
          order={1}
          fz={80}
          fw={900}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          404
        </Title>
        <Title order={2}>Pagina non trovata</Title>
        <Text c="dimmed" ta="center" size="lg">
          La pagina che stai cercando non esiste o è stata spostata.
        </Text>
        <Button
          component={Link}
          href="/"
          size="md"
          variant="gradient"
          gradient={{ from: '#7c3aed', to: '#a78bfa' }}
        >
          Torna alla Home
        </Button>
      </Stack>
    </Container>
  );
}
