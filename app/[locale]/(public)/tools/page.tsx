import { Metadata } from 'next';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Group,
  ThemeIcon,
  Badge,
  Anchor,
  Box,
} from '@mantine/core';
import {
  IconCalculator,
  IconCalendar,
  IconClipboardCheck,
  IconFileText,
  IconClock,
  IconCurrencyEuro,
  IconId,
  IconTable,
} from '@tabler/icons-react';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: 'Strumenti Gratuiti per Scuole | InsegnaMi.pro',
    description:
      'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori. Calcola medie voti, presenze, costi e molto altro.',
    keywords: [
      'strumenti scuola gratuiti',
      'calcolatore media voti',
      'calcolatore presenze',
      'generatore calendario scolastico',
      'validatore codice fiscale',
    ],
    openGraph: {
      title: 'Strumenti Gratuiti per Scuole | InsegnaMi.pro',
      description:
        'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori.',
      type: 'website',
    },
  };
}

const tools = [
  {
    slug: 'calcolatore-media-voti',
    title: 'Calcolatore Media Voti',
    description: 'Calcola la media dei voti con pesi personalizzati per materia o tipologia di verifica.',
    icon: IconCalculator,
    category: 'Calcolatori',
    color: 'blue',
  },
  {
    slug: 'calcolatore-presenze',
    title: 'Calcolatore Presenze',
    description: 'Calcola la percentuale di frequenza e verifica il raggiungimento del monte ore minimo.',
    icon: IconClipboardCheck,
    category: 'Calcolatori',
    color: 'green',
  },
  {
    slug: 'calcolatore-costo-studente',
    title: 'Calcolatore Costo per Studente',
    description: 'Calcola il costo effettivo per studente considerando tutte le spese della scuola.',
    icon: IconCurrencyEuro,
    category: 'Calcolatori',
    color: 'yellow',
  },
  {
    slug: 'validatore-codice-fiscale',
    title: 'Validatore Codice Fiscale',
    description: 'Verifica la correttezza di un codice fiscale ed estrai le informazioni anagrafiche.',
    icon: IconId,
    category: 'Validatori',
    color: 'red',
  },
  {
    slug: 'generatore-calendario-scolastico',
    title: 'Generatore Calendario Scolastico',
    description: 'Genera un calendario scolastico personalizzato con festività e periodi di vacanza.',
    icon: IconCalendar,
    category: 'Generatori',
    color: 'violet',
  },
  {
    slug: 'generatore-orario-settimanale',
    title: 'Generatore Orario Settimanale',
    description: 'Crea un orario settimanale delle lezioni da stampare o esportare.',
    icon: IconTable,
    category: 'Generatori',
    color: 'cyan',
  },
  {
    slug: 'calcolatore-ore-corso',
    title: 'Calcolatore Ore Corso',
    description: 'Calcola il totale delle ore di un corso e pianifica le lezioni necessarie.',
    icon: IconClock,
    category: 'Calcolatori',
    color: 'orange',
  },
  {
    slug: 'generatore-comunicazioni',
    title: 'Template Comunicazioni',
    description: 'Genera template per comunicazioni ai genitori, circolari e avvisi.',
    icon: IconFileText,
    category: 'Generatori',
    color: 'pink',
  },
];

const categories = ['Calcolatori', 'Generatori', 'Validatori'];

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Strumenti Gratuiti per Scuole',
    description: 'Strumenti gratuiti per la gestione scolastica: calcolatori, generatori e validatori.',
    publisher: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: tools.map((tool, index) => ({
        '@type': 'SoftwareApplication',
        position: index + 1,
        name: tool.title,
        description: tool.description,
        applicationCategory: 'EducationalApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <Box
        style={{
          background: 'linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-indigo-5) 100%)',
          color: 'white',
          padding: '4rem 0',
        }}
      >
        <Container size="xl">
          <Stack align="center" gap="lg">
            <Badge color="white" variant="filled" c="violet" size="lg">
              100% Gratuiti
            </Badge>
            <Title order={1} ta="center">
              Strumenti Gratuiti per la Tua Scuola
            </Title>
            <Text size="xl" ta="center" maw={700}>
              Calcolatori, generatori e validatori pensati per semplificare
              la gestione quotidiana della tua scuola. Nessuna registrazione richiesta.
            </Text>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" py="xl">
        <Stack gap="xl">
          {/* Categories */}
          {categories.map((category) => {
            const categoryTools = tools.filter((t) => t.category === category);
            if (categoryTools.length === 0) return null;

            return (
              <Box key={category}>
                <Title order={2} mb="lg">
                  {category}
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                  {categoryTools.map((tool) => (
                    <Card
                      key={tool.slug}
                      component={Link}
                      href={`/${locale}/tools/${tool.slug}`}
                      shadow="sm"
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{ textDecoration: 'none' }}
                    >
                      <Stack gap="md">
                        <Group justify="space-between">
                          <ThemeIcon size={50} radius="md" color={tool.color} variant="light">
                            <tool.icon size={28} />
                          </ThemeIcon>
                          <Badge color={tool.color} variant="light">
                            Gratuito
                          </Badge>
                        </Group>
                        <div>
                          <Title order={3} size="h4" mb="xs">
                            {tool.title}
                          </Title>
                          <Text size="sm" c="dimmed">
                            {tool.description}
                          </Text>
                        </div>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}

          {/* CTA Section */}
          <Card withBorder p="xl" radius="md" bg="violet.0" mt="xl">
            <Stack align="center" gap="md">
              <Title order={2} ta="center">
                Vuoi Automatizzare Tutto Questo?
              </Title>
              <Text c="dimmed" ta="center" maw={600}>
                Con InsegnaMi.pro puoi gestire automaticamente voti, presenze, pagamenti
                e comunicazioni. Tutti questi strumenti integrati in un&apos;unica piattaforma.
              </Text>
              <Group gap="md">
                <Anchor
                  component={Link}
                  href={`/${locale}/auth/register`}
                  style={{
                    backgroundColor: 'var(--mantine-color-violet-6)',
                    color: 'white',
                    padding: '0.75rem 2rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Prova Gratis 14 Giorni
                </Anchor>
                <Anchor
                  component={Link}
                  href={`/${locale}/pricing`}
                  style={{
                    borderColor: 'var(--mantine-color-violet-6)',
                    color: 'var(--mantine-color-violet-6)',
                    border: '1px solid',
                    padding: '0.75rem 2rem',
                    borderRadius: 'var(--mantine-radius-md)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Vedi i Prezzi
                </Anchor>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
