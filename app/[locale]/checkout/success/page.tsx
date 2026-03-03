import { Container, Title, Text, Stack, Paper, Button, Group, ThemeIcon, Box, Center } from '@mantine/core';
import { IconCheck, IconArrowRight, IconRocket, IconMail } from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pagamento Completato | InsegnaMi.pro',
  description: 'Il tuo pagamento è stato completato con successo. Benvenuto in InsegnaMi.pro!',
};

export default async function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
      <Container size="sm" py={100}>
        <Center>
          <Paper p="xl" radius="xl" shadow="xl" style={{ maxWidth: 500, width: '100%' }}>
            <Stack gap="lg" align="center">
              <ThemeIcon size={100} radius={100} color="green" variant="light">
                <IconCheck size={60} />
              </ThemeIcon>

              <Title order={1} ta="center" size="h2">
                Pagamento Completato!
              </Title>

              <Text c="dimmed" ta="center" size="lg">
                Grazie per aver scelto InsegnaMi.pro. Il tuo abbonamento è stato attivato con successo.
              </Text>

              <Paper p="md" radius="md" bg="green.0" w="100%">
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconCheck size={18} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>Abbonamento attivato</Text>
                  </Group>
                  <Group gap="xs">
                    <IconCheck size={18} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>Accesso completo a tutte le funzionalità</Text>
                  </Group>
                  <Group gap="xs">
                    <IconCheck size={18} color="var(--mantine-color-green-6)" />
                    <Text size="sm" fw={500}>Riceverai una email di conferma</Text>
                  </Group>
                </Stack>
              </Paper>

              <Stack gap="sm" w="100%">
                <Button
                  component={Link}
                  href={`/${locale}/dashboard`}
                  size="lg"
                  radius="xl"
                  fullWidth
                  rightSection={<IconArrowRight size={18} />}
                >
                  Vai alla Dashboard
                </Button>

                <Button
                  component={Link}
                  href={`/${locale}/dashboard/billing`}
                  variant="light"
                  size="md"
                  radius="xl"
                  fullWidth
                >
                  Visualizza Fatturazione
                </Button>
              </Stack>

              <Text size="xs" c="dimmed" ta="center">
                Hai bisogno di aiuto? Contattaci a{' '}
                <Text component="a" href="mailto:support@insegnami.pro" c="blue" inherit>
                  support@insegnami.pro
                </Text>
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    </Box>
  );
}
