'use client';

import { Container, Title, Text, Stack, Paper, TextInput, Textarea, Button, Group, ThemeIcon, Box, SimpleGrid, Alert, Anchor } from '@mantine/core';
import { IconMail, IconPhone, IconMapPin, IconSend, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
    validate: {
      name: (value) => (value.trim().length < 2 ? 'Il nome deve avere almeno 2 caratteri' : null),
      // BUG-036 fix: Use stricter email regex
      email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Email non valida'),
      subject: (value) => (value.trim().length < 3 ? 'Inserisci un oggetto' : null),
      message: (value) => (value.trim().length < 10 ? 'Il messaggio deve avere almeno 10 caratteri' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Errore nell\'invio del messaggio');
      }

      setIsSuccess(true);
      form.reset();
      notifications.show({
        title: 'Messaggio inviato',
        message: 'Ti risponderemo il prima possibile!',
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Si è verificato un errore. Riprova più tardi.',
        color: 'red',
        icon: <IconAlertCircle size={18} />,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Box ta="center">
          <Title order={1} mb="md">Contattaci</Title>
          <Text c="dimmed" size="lg" maw={600} mx="auto">
            Hai domande su InsegnaMi.pro? Siamo qui per aiutarti.
            Compila il form e ti risponderemo il prima possibile.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          {/* Contact Info */}
          <Stack gap="lg">
            <Paper p="xl" radius="md" withBorder>
              <Title order={3} mb="lg">Informazioni di Contatto</Title>
              <Stack gap="md">
                <Group gap="md">
                  <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                    <IconMail size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" c="dimmed">Email</Text>
                    <Anchor href="mailto:info@insegnami.pro" fw={500}>info@insegnami.pro</Anchor>
                  </div>
                </Group>

                <Group gap="md">
                  <ThemeIcon size="lg" radius="md" variant="light" color="green">
                    <IconPhone size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" c="dimmed">Supporto</Text>
                    <Text fw={500}>Lun-Ven 9:00-18:00</Text>
                  </div>
                </Group>

                <Group gap="md">
                  <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                    <IconMapPin size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="sm" c="dimmed">Sede</Text>
                    <Text fw={500}>Italia</Text>
                    <Text size="sm" c="dimmed">P.IVA: 07327360488</Text>
                  </div>
                </Group>
              </Stack>
            </Paper>

            <Paper p="xl" radius="md" withBorder bg="blue.0">
              <Title order={4} mb="sm">Supporto Tecnico</Title>
              <Text size="sm" c="dimmed" mb="md">
                Per problemi tecnici o assistenza sull'utilizzo della piattaforma,
                i clienti attivi possono contattare il supporto dedicato.
              </Text>
              <Anchor href="mailto:support@insegnami.pro" size="sm">
                support@insegnami.pro
              </Anchor>
            </Paper>

            <Paper p="xl" radius="md" withBorder bg="green.0">
              <Title order={4} mb="sm">Richiesta Demo</Title>
              <Text size="sm" c="dimmed" mb="md">
                Vuoi vedere InsegnaMi.pro in azione? Richiedi una demo personalizzata
                e ti mostreremo tutte le funzionalità.
              </Text>
              <Anchor href="mailto:demo@insegnami.pro" size="sm">
                demo@insegnami.pro
              </Anchor>
            </Paper>
          </Stack>

          {/* Contact Form */}
          <Paper p="xl" radius="md" withBorder>
            {isSuccess ? (
              <Alert color="green" variant="light" icon={<IconCheck size={20} />} title="Messaggio inviato!">
                <Text size="sm">
                  Grazie per averci contattato! Abbiamo ricevuto il tuo messaggio e ti risponderemo
                  entro 24-48 ore lavorative.
                </Text>
                <Button
                  variant="light"
                  color="green"
                  mt="md"
                  onClick={() => setIsSuccess(false)}
                >
                  Invia un altro messaggio
                </Button>
              </Alert>
            ) : (
              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="md">
                  <Title order={3}>Inviaci un messaggio</Title>

                  <TextInput
                    label="Nome e Cognome"
                    placeholder="Il tuo nome"
                    required
                    {...form.getInputProps('name')}
                  />

                  <TextInput
                    label="Email"
                    placeholder="la-tua@email.com"
                    required
                    {...form.getInputProps('email')}
                  />

                  <TextInput
                    label="Oggetto"
                    placeholder="Di cosa vuoi parlarci?"
                    required
                    {...form.getInputProps('subject')}
                  />

                  <Textarea
                    label="Messaggio"
                    placeholder="Scrivi il tuo messaggio..."
                    required
                    minRows={5}
                    {...form.getInputProps('message')}
                  />

                  <Text size="xs" c="dimmed">
                    Inviando questo form, accetti la nostra{' '}
                    <Anchor href="/it/privacy" size="xs">Privacy Policy</Anchor>.
                    Non condivideremo le tue informazioni con terze parti.
                  </Text>

                  <Button
                    type="submit"
                    size="lg"
                    loading={isSubmitting}
                    leftSection={<IconSend size={18} />}
                  >
                    Invia Messaggio
                  </Button>
                </Stack>
              </form>
            )}
          </Paper>
        </SimpleGrid>

        {/* FAQ Section */}
        <Paper p="xl" radius="md" withBorder>
          <Title order={3} ta="center" mb="lg">Domande Frequenti</Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Box>
              <Text fw={600} mb="xs">Quanto tempo ci vuole per attivare il servizio?</Text>
              <Text size="sm" c="dimmed">
                Puoi iniziare subito con la prova gratuita di 30 giorni. L'attivazione è immediata.
              </Text>
            </Box>
            <Box>
              <Text fw={600} mb="xs">Posso importare i dati da un altro sistema?</Text>
              <Text size="sm" c="dimmed">
                Sì, offriamo supporto per l'importazione dati da file CSV e altri formati comuni.
              </Text>
            </Box>
            <Box>
              <Text fw={600} mb="xs">È disponibile supporto in italiano?</Text>
              <Text size="sm" c="dimmed">
                Assolutamente sì! Tutto il nostro team parla italiano e il supporto è completamente in italiano.
              </Text>
            </Box>
            <Box>
              <Text fw={600} mb="xs">Posso richiedere funzionalità personalizzate?</Text>
              <Text size="sm" c="dimmed">
                Contattaci per discutere le tue esigenze. Valutiamo ogni richiesta per i piani Enterprise.
              </Text>
            </Box>
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
