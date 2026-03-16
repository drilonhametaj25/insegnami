'use client';

import { useEffect } from 'react';
import { Container, Title, Text, Button, Stack } from '@mantine/core';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Locale error:', error);
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
          Si è verificato un errore
        </Title>
        <Text c="dimmed" ta="center" size="lg">
          Qualcosa è andato storto. Riprova tra qualche istante.
        </Text>
        <Button
          onClick={reset}
          size="md"
          variant="gradient"
          gradient={{ from: '#7c3aed', to: '#a78bfa' }}
        >
          Riprova
        </Button>
      </Stack>
    </Container>
  );
}
