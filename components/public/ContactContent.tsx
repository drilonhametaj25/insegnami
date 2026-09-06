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
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CtaBanner, PUB_GRADIENT, PageHero, SectionHeader } from '@/components/public/PublicUI';

export interface ContactFaqItem {
  question: string;
  answer: string;
}

/**
 * Client island della pagina /contact: form con anti-spam (honeypot 'website'
 * + timestamp 'startedAt' valorizzato al mount, verificati da POST /api/contact),
 * info di contatto e FAQ. Oggetto precompilato letto server-side dai query param.
 */
export function ContactContent({
  locale,
  initialSubject,
  faqs,
}: {
  locale: string;
  initialSubject: string | null;
  faqs: ContactFaqItem[];
}) {
  const t = useTranslations('public.contact');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Anti-spam: timestamp di apertura del form. I bot che postano subito
  // (now - startedAt < 3s) vengono rifiutati dall'API.
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const form = useForm({
    initialValues: {
      name: '',
      email: '',
      subject: initialSubject ?? '',
      message: '',
      // Honeypot: campo invisibile agli umani; se arriva compilato è un bot.
      website: '',
    },
    validate: {
      name: (value) => (value.trim().length < 2 ? t('form.nameError') : null),
      // BUG-036 fix: Use stricter email regex
      email: (value) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : t('form.emailError')),
      subject: (value) => (value.trim().length < 3 ? t('form.subjectError') : null),
      message: (value) => (value.trim().length < 10 ? t('form.messageError') : null),
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
        body: JSON.stringify({ ...values, startedAt }),
      });

      if (!response.ok) {
        throw new Error(t('form.notifyErrorMessage'));
      }

      setIsSuccess(true);
      form.reset();
      setStartedAt(Date.now());
      notifications.show({
        title: t('form.notifySuccessTitle'),
        message: t('form.notifySuccessMessage'),
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch {
      notifications.show({
        title: t('form.notifyErrorTitle'),
        message: t('form.notifyErrorMessage'),
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
        badge={t('hero.badge')}
        title={t('hero.title')}
        highlight={t('hero.highlight')}
        subtitle={t('hero.subtitle')}
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
                  title={t('form.successTitle')}
                >
                  <Text size="sm">{t('form.successText')}</Text>
                  <Button variant="light" color="teal" radius="xl" mt="md" onClick={() => setIsSuccess(false)}>
                    {t('form.successButton')}
                  </Button>
                </Alert>
              ) : (
                <form onSubmit={form.onSubmit(handleSubmit)}>
                  <Stack gap="md">
                    <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)">
                      {t('form.title')}
                    </Title>

                    <TextInput
                      label={t('form.name')}
                      placeholder={t('form.namePlaceholder')}
                      size="md"
                      required
                      {...form.getInputProps('name')}
                    />

                    <TextInput
                      label={t('form.email')}
                      placeholder={t('form.emailPlaceholder')}
                      size="md"
                      required
                      {...form.getInputProps('email')}
                    />

                    <TextInput
                      label={t('form.subject')}
                      placeholder={t('form.subjectPlaceholder')}
                      size="md"
                      required
                      {...form.getInputProps('subject')}
                    />

                    <Textarea
                      label={t('form.message')}
                      placeholder={t('form.messagePlaceholder')}
                      size="md"
                      required
                      minRows={5}
                      {...form.getInputProps('message')}
                    />

                    {/* Honeypot anti-spam: invisibile e fuori dal tab order.
                        Gli umani non lo compilano mai; l'API rifiuta se pieno. */}
                    <div style={{ display: 'none' }} aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        {...form.getInputProps('website')}
                      />
                      <input type="hidden" name="startedAt" value={startedAt} readOnly />
                    </div>

                    <Text size="xs" c="dimmed">
                      {t('form.privacyPrefix')}{' '}
                      <Anchor component={Link} href={`/${locale}/privacy`} size="xs" c="indigo.6" underline="hover">
                        {t('form.privacyLink')}
                      </Anchor>
                      {t('form.privacySuffix')}
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
                      data-testid="contact-submit"
                    >
                      {t('form.submit')}
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
                  {t('info.title')}
                </Title>
                <Stack gap="md">
                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                      <IconMail size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">{t('info.emailLabel')}</Text>
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
                      <Text size="sm" c="dimmed">{t('info.supportLabel')}</Text>
                      <Text fw={500}>{t('info.supportHours')}</Text>
                    </div>
                  </Group>

                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size="lg" radius="md" variant="light" color="indigo">
                      <IconMapPin size={20} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" c="dimmed">{t('info.locationLabel')}</Text>
                      <Text fw={500}>{t('info.locationValue')}</Text>
                      <Text size="sm" c="dimmed">P.IVA: 07327360488</Text>
                    </div>
                  </Group>
                </Stack>
              </Card>

              <Card padding="xl" radius="lg" className="pub-card">
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)" mb="sm">
                  {t('support.title')}
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  {t('support.text')}
                </Text>
                <Anchor href="mailto:info@drilonhametaj.it" size="sm" c="indigo.6" underline="hover">
                  info@drilonhametaj.it
                </Anchor>
              </Card>

              <Card padding="xl" radius="lg" className="pub-card">
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)" mb="sm">
                  {t('demo.title')}
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  {t('demo.text')}
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
          <SectionHeader title={t('faqTitle')} highlight={t('faqHighlight')} />
          <Accordion variant="separated" radius="md" bg="transparent">
            {faqs.map((faq) => (
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
              {t('legal.privacy')}
            </Anchor>
            <Anchor component={Link} href={`/${locale}/terms`} size="sm" c="indigo.6" underline="hover">
              {t('legal.terms')}
            </Anchor>
            <Anchor component={Link} href={`/${locale}/cookies`} size="sm" c="indigo.6" underline="hover">
              {t('legal.cookies')}
            </Anchor>
          </Group>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner locale={locale} />
    </Box>
  );
}
