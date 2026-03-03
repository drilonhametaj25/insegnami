import { Container, Title, Text, Stack, Paper, Button, Group, ThemeIcon, Box, Center, Alert } from '@mantine/core';
import { IconX, IconArrowLeft, IconMail, IconPhone, IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pagamento Annullato | InsegnaMi.pro',
  description: 'Il processo di pagamento è stato annullato. Puoi riprovare quando vuoi.',
};

export default async function CheckoutCancelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
      <Container size="sm" py={100}>
        <Center>
          <Paper p="xl" radius="xl" shadow="xl" style={{ maxWidth: 500, width: '100%' }}>
            <Stack gap="lg" align="center">
              <ThemeIcon size={100} radius={100} color="gray" variant="light">
                <IconX size={60} />
              </ThemeIcon>

              <Title order={1} ta="center" size="h2">
                Pagamento Annullato
              </Title>

              <Text c="dimmed" ta="center" size="lg">
                Il processo di pagamento è stato annullato. Non preoccuparti, non ti è stato addebitato nulla.
              </Text>

              <Alert
                icon={<IconAlertCircle size={20} />}
                color="blue"
                variant="light"
                w="100%"
              >
                <Text size="sm">
                  Puoi riprovare in qualsiasi momento. La tua prova gratuita di 14 giorni è ancora disponibile!
                </Text>
              </Alert>

              <Stack gap="sm" w="100%">
                <Button
                  component={Link}
                  href={`/${locale}/pricing`}
                  size="lg"
                  radius="xl"
                  fullWidth
                  leftSection={<IconArrowLeft size={18} />}
                >
                  Torna ai Piani
                </Button>

                <Button
                  component={Link}
                  href={`/${locale}`}
                  variant="light"
                  size="md"
                  radius="xl"
                  fullWidth
                >
                  Torna alla Home
                </Button>
              </Stack>

              <Paper p="md" radius="md" bg="gray.0" w="100%">
                <Text size="sm" fw={500} mb="xs">Hai bisogno di aiuto?</Text>
                <Stack gap="xs">
                  <Group gap="xs">
                    <IconMail size={16} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" c="dimmed">
                      <Text component="a" href="mailto:info@insegnami.pro" c="blue" inherit>
                        info@insegnami.pro
                      </Text>
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <IconPhone size={16} color="var(--mantine-color-dimmed)" />
                    <Text size="sm" c="dimmed">Lun-Ven 9:00-18:00</Text>
                  </Group>
                </Stack>
              </Paper>

              <Text size="xs" c="dimmed" ta="center">
                Se hai riscontrato problemi durante il pagamento, contattaci e saremo felici di aiutarti.
              </Text>
            </Stack>
          </Paper>
        </Center>
      </Container>
    </Box>
  );
}
