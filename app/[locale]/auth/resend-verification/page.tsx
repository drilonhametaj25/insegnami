'use client';

import { useState } from 'react';
import { Container, Paper, Title, Text, TextInput, Button, Alert, Anchor, Stack } from '@mantine/core';
import { IconMail, IconCheck, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ResendVerificationPage() {
  const { locale } = useParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Errore sconosciuto');
      }
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center">Reinvia Email di Verifica</Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Inserisci la tua email per ricevere un nuovo link di verifica
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="tua@email.com"
              required
              leftSection={<IconMail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />

            {success && (
              <Alert color="green" icon={<IconCheck size={16} />}>
                Email inviata! Controlla la tua casella di posta (anche spam).
              </Alert>
            )}

            {error && (
              <Alert color="red" icon={<IconX size={16} />}>
                {error}
              </Alert>
            )}

            <Button fullWidth type="submit" loading={loading}>
              Invia Email di Verifica
            </Button>

            <Text ta="center" size="sm">
              <Anchor component={Link} href={`/${locale}/auth/login`}>
                Torna al login
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
