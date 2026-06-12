// Import nominali (no dot-notation): il modulo è condiviso col grafo server
// dei page.tsx dei tool, dove Grid.Col/Accordion.Item risolvono a undefined.
import {
  Accordion,
  AccordionControl,
  AccordionItem,
  AccordionPanel,
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Grid,
  GridCol,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { PUB_GRADIENT } from './PublicUI';

/**
 * Scheletro condiviso delle pagine /tools/*: hero, layout main+sidebar,
 * card sezione, CTA sidebar, strumenti correlati e FAQ hanno un solo stile.
 */

/** Anno scolastico di default per i tool: da giugno in poi propone quello che inizia a settembre. */
export function getDefaultSchoolYear(today = new Date()): { start: Date; end: Date; label: string } {
  const startYear = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    start: new Date(startYear, 8, 9),
    end: new Date(startYear + 1, 5, 10),
    label: `${startYear}/${startYear + 1}`,
  };
}

export function ToolHero({
  locale,
  icon: Icon,
  title,
  description,
}: {
  locale: string;
  icon: ComponentType<{ size?: number | string }>;
  title: string;
  description: string;
}) {
  return (
    <Box className="pub-hero" py={{ base: 40, sm: 56 }}>
      <Container size="xl">
        <Anchor
          component={Link}
          href={`/${locale}/tools`}
          size="sm"
          c="indigo.6"
          fw={500}
          underline="hover"
          display="inline-block"
          mb="lg"
        >
          <Group gap={6} wrap="nowrap">
            <IconArrowLeft size={16} />
            Tutti gli strumenti
          </Group>
        </Anchor>
        <Group gap="lg" wrap="nowrap" align="flex-start">
          <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
            <Icon size={34} />
          </ThemeIcon>
          <Box>
            <Title fz={{ base: rem(28), sm: rem(38) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
              {title}
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              {description}
            </Text>
          </Box>
        </Group>
      </Container>
    </Box>
  );
}

/** Layout a due colonne: contenuto principale + sidebar sticky. */
export function ToolLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <Container size="xl" py={{ base: 32, sm: 48 }}>
      <Grid gutter={{ base: 'lg', md: 'xl' }}>
        <GridCol span={{ base: 12, md: 8 }}>
          <Stack gap="lg">{children}</Stack>
        </GridCol>
        <GridCol span={{ base: 12, md: 4 }}>
          <Stack gap="lg" style={{ position: 'sticky', top: 88 }}>
            {aside}
          </Stack>
        </GridCol>
      </Grid>
    </Container>
  );
}

/** Card sezione standard del contenuto principale. */
export function ToolSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Card padding="xl" radius="lg" withBorder bg="white">
      {title && (
        <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)" mb="md">
          {title}
        </Title>
      )}
      {children}
    </Card>
  );
}

/** CTA sidebar verso la registrazione, identica per tutti gli strumenti. */
export function ToolCtaCard({ locale }: { locale: string }) {
  return (
    <Card padding="xl" radius="lg" style={{ background: 'var(--pub-brand-gradient)' }}>
      <Stack gap="sm">
        <Title order={3} fz={rem(20)} fw={700} c="white">
          Gestisci tutto con InsegnaMi.pro
        </Title>
        <Text size="sm" c="white" opacity={0.9}>
          Registro elettronico, presenze, pagamenti e comunicazioni in un&apos;unica piattaforma.
        </Text>
        <Stack gap={6} my={4}>
          {['Prova gratis 14 giorni', 'Nessuna carta richiesta', 'Supporto in italiano'].map((item) => (
            <Group key={item} gap={6} wrap="nowrap">
              <IconCheck size={14} color="white" />
              <Text size="sm" c="white" opacity={0.92}>
                {item}
              </Text>
            </Group>
          ))}
        </Stack>
        <Button
          component={Link}
          href={`/${locale}/auth/register`}
          variant="white"
          c="indigo.7"
          radius="xl"
          fw={700}
          fullWidth
          rightSection={<IconArrowRight size={16} />}
        >
          Prova gratis
        </Button>
      </Stack>
    </Card>
  );
}

/** Card sidebar informativa (riferimenti, suggerimenti...). */
export function ToolInfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="xl" radius="lg" withBorder bg="white">
      <Title order={3} fz={rem(16)} fw={700} c="var(--pub-ink)" mb="sm">
        {title}
      </Title>
      {children}
    </Card>
  );
}

/** Link agli altri strumenti, in sidebar. */
export function RelatedToolsCard({
  locale,
  tools,
}: {
  locale: string;
  tools: { slug: string; title: string }[];
}) {
  return (
    <Card padding="xl" radius="lg" withBorder bg="white">
      <Title order={3} fz={rem(16)} fw={700} c="var(--pub-ink)" mb="sm">
        Strumenti correlati
      </Title>
      <Stack gap={10}>
        {tools.map((tool) => (
          <Anchor
            key={tool.slug}
            component={Link}
            href={`/${locale}/tools/${tool.slug}`}
            size="sm"
            c="indigo.6"
            fw={500}
            underline="hover"
          >
            <Group gap={6} wrap="nowrap">
              <IconArrowRight size={14} />
              {tool.title}
            </Group>
          </Anchor>
        ))}
      </Stack>
    </Card>
  );
}

export type FaqItem = { question: string; answer: string };

/** FAQ in Accordion, stile unico per tutti gli strumenti. */
export function ToolFaq({ items }: { items: FaqItem[] }) {
  return (
    <Card padding="xl" radius="lg" withBorder bg="white">
      <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)" mb="md">
        Domande frequenti
      </Title>
      <Accordion variant="separated" radius="md">
        {items.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionControl>
              <Text fw={600} size="sm">
                {faq.question}
              </Text>
            </AccordionControl>
            <AccordionPanel>
              <Text size="sm" c="dimmed" lh={1.6}>
                {faq.answer}
              </Text>
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}

/** JSON-LD FAQPage da usare nei page.tsx server dei tool. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}
