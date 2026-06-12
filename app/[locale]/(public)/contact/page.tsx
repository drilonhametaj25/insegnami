'use client';

import {
  Accordion,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconMail,
  IconMapPin,
  IconSend,
} from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { CtaBanner, PUB_GRADIENT, PageHero, SectionHeader } from '@/components/public/PublicUI';

// Mappa oggetto del messaggio in base ai query param
const SUBJECT_MAP: Record<string, string> = {
  'enterprise': 'Richiesta informazioni Piano Enterprise',
  'full-installation': 'Richiesta preventivo Installazione Full',
  'demo': 'Richiesta demo personalizzata',
  'support': 'Richiesta supporto',
};

// Domande frequenti (testi invariati)
const FAQ_ITEMS = [
  {
    question: 'Quanto tempo ci vuole per attivare il servizio?',
    answer:
      "Puoi iniziare subito con la prova gratuita di 14 giorni. L'attivazione è immediata.",
  },
  {
    question: 'Posso importare i dati da un altro sistema?',
    answer:
      "Sì, offriamo supporto per l'importazione dati da file CSV e altri formati comuni.",
  },
  {
    question: 'È disponibile supporto in italiano?',
    answer:
      'Assolutamente sì! Tutto il nostro team parla italiano e il supporto è completamente in italiano.',
  },
  {
    question: 'Posso richiedere funzionalità personalizzate?',
    answer:
      'Contattaci per discutere le tue esigenze. Valutiamo ogni richiesta per i piani Enterprise.',
  },
];

export default function ContactPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
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

  // Precompila l'oggetto in base al query param
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam && SUBJECT_MAP[subjectParam]) {
      form.setFieldValue('subject', SUBJECT_MAP[subjectParam]);
    }
  }, [searchParams]);

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
    <Box>
      {/* Hero */}
      <PageHero
        badge="Contatti"
        title="Siamo qui per"
        highlight="aiutarti"
        subtitle="Hai domande su InsegnaMi.pro? Compila il form e ti risponderemo il prima possibile."
      />

      {/* Form + informazioni di contatto */}
      <Container size="xl" py={{ base: 32, sm: 48 }}>
        <Grid gutter={{ base: 'lg', md: 'xl' }}>
          {/* Form di contatto */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Card padding="xl" radius="lg" withBorder bg="white">
              {isSuccess ? (
                <Alert
                  color="teal"
                  variant="light"
                  icon={<IconCheck size={20} />}
                  title="Messaggio inviato!"
                >
                  <Text size="sm">
                    Grazie per averci contattato! Abbiamo ricevuto il tuo messaggio e ti risponderemo
                    entro 24-48 ore lavorative.
                  </Text>
                  <Button variant="light" color="teal" radius="xl" mt="md" onClick={() => setIsSuccess(false)}>
                    Invia un altro messaggio
                  </Button>
                </Alert>
              ) : (
                <form onSubmit={form.onSubmit(handleSubmit)}>
                  <Stack gap="md">
                    <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)">
                      Inviaci un messaggio
                    </Title>

                    <TextInput
                      label="Nome e Cognome"
                      placeholder="Il tuo nome"
                      size="md"
                      required
                      {...form.getInputProps('name')}
                    />

                    <TextInput
                      label="Email"
                      placeholder="la-tua@email.com"
                      size="md"
                      required
                      {...form.getInputProps('email')}
                    />

                    <TextInput
                      label="Oggetto"
                      placeholder="Di cosa vuoi parlarci?"
                      size="md"
                      required
                      {...form.getInputProps('subject')}
                    />

                    <Textarea
                      label="Messaggio"
                      placeholder="Scrivi il tuo messaggio..."
                      size="md"
                      required
                      minRows={5}
                      {...form.getInputProps('message')}
                    />

                    <Text size="xs" c="dimmed">
                      Inviando questo form, accetti la nostra{' '}
                      <Anchor component={Link} href={`/${locale}/privacy`} size="xs" c="indigo.6" underline="hover">
                        Privacy Policy
                      </Anchor>
                      . Non condivideremo le tue informazioni con terze parti.
                    </Text>

                    <Button
                      type="submit"
                      size="md"
                      radius="xl"
                      variant="gradient"
                      gradient={PUB_GRADIENT}
                      fw={600}
                      loading={isSubmitting}
                      leftSection={<IconSend size={18} />}
                    >
                      Invia Messaggio
                    </Button>
                  </Stack>
                </form>
              )}
            </Card>
          </Grid.Col>

          {/* Informazioni di contatto */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="lg" style={{ position: 'sticky', top: 88 }}>
              <Card padding="xl" radius="lg" className="pub-card">
                <Title order={2} fz={rem(20)} fw={700} c="var(--pub-ink)" mb="lg">
                  Informazioni di Contatto
                </Title>
                <Stack gap="md">
                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                      <IconMail size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">Email</Text>
                      <Anchor href="mailto:info@drilonhametaj.it" fw={500} c="indigo.6" underline="hover">
                        info@drilonhametaj.it
                      </Anchor>
                    </div>
                  </Group>

                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                      <IconClock size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">Supporto</Text>
                      <Text fw={500}>Lun-Ven 9:00-18:00</Text>
                    </div>
                  </Group>

                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                      <IconMapPin size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">Sede</Text>
                      <Text fw={500}>Italia</Text>
                      <Text size="sm" c="dimmed">P.IVA: 07327360488</Text>
                    </div>
                  </Group>
                </Stack>
              </Card>

              <Card padding="xl" radius="lg" className="pub-card">
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)" mb="sm">
                  Supporto Tecnico
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  Per problemi tecnici o assistenza sull'utilizzo della piattaforma,
                  i clienti attivi possono contattare il supporto dedicato.
                </Text>
                <Anchor href="mailto:info@drilonhametaj.it" size="sm" c="indigo.6" underline="hover">
                  info@drilonhametaj.it
                </Anchor>
              </Card>

              <Card padding="xl" radius="lg" className="pub-card">
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)" mb="sm">
                  Richiesta Demo
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  Vuoi vedere InsegnaMi.pro in azione? Richiedi una demo personalizzata
                  e ti mostreremo tutte le funzionalità.
                </Text>
                <Anchor href="mailto:info@drilonhametaj.it" size="sm" c="indigo.6" underline="hover">
                  info@drilonhametaj.it
                </Anchor>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      {/* FAQ */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="md">
          <SectionHeader title="Domande" highlight="Frequenti" />
          <Accordion variant="separated" radius="md" bg="transparent">
            {FAQ_ITEMS.map((faq) => (
              <Accordion.Item key={faq.question} value={faq.question} bg="white">
                <Accordion.Control>
                  <Text fw={600} size="sm">
                    {faq.question}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {faq.answer}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>

          {/* Cross-link legali */}
          <Group justify="center" gap="lg" mt={48}>
            <Anchor component={Link} href={`/${locale}/privacy`} size="sm" c="indigo.6" underline="hover">
              Privacy Policy
            </Anchor>
            <Anchor component={Link} href={`/${locale}/terms`} size="sm" c="indigo.6" underline="hover">
              Termini di Servizio
            </Anchor>
            <Anchor component={Link} href={`/${locale}/cookies`} size="sm" c="indigo.6" underline="hover">
              Cookie Policy
            </Anchor>
          </Group>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner locale={locale} />
    </Box>
  );
}
